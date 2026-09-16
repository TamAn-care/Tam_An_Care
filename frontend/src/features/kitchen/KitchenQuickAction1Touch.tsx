import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { createWorkEvent } from '../../api/operational-work';

export interface FloorDeliveryState {
  floorId: string;
  floorName: string;
  trayCount: number;
  breakdown: string;
  status: 'PENDING' | 'PREPARING' | 'DELIVERED';
  deliveredAt?: string;
  deliveredBy?: string;
}

export interface HygieneCheckItem {
  id: string;
  label: string;
  icon: string;
  status: 'PENDING' | 'COMPLETED';
  completedAt?: string;
}

const STORAGE_KEY_DELIVERY = 'taman_kitchen_floor_delivery_v2';
const STORAGE_KEY_HYGIENE = 'taman_kitchen_hygiene_checks_v2';
const STORAGE_KEY_MEAL_STAGE = 'taman_kitchen_meal_stage_v2';

export function KitchenQuickAction1Touch() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const actorName = actor?.displayName || 'Nhân viên Dinh dưỡng';
  const actorRole = actor?.actorRole || 'NUTRITIONIST';

  // Live Time Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Meal Stage State (SÁNG / TRƯA / TỐI)
  const [activeMealSlot, setActiveMealSlot] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER'>('LUNCH');
  const [mealStageStatus, setMealStageStatus] = useState<Record<string, 'NOT_STARTED' | 'COOKING' | 'PORTIONING' | 'COMPLETED'>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEAL_STAGE);
      return saved ? JSON.parse(saved) : { BREAKFAST: 'COMPLETED', LUNCH: 'PORTIONING', DINNER: 'NOT_STARTED' };
    } catch {
      return { BREAKFAST: 'COMPLETED', LUNCH: 'PORTIONING', DINNER: 'NOT_STARTED' };
    }
  });

  // Floor Delivery 1-Tap State
  const [floorDeliveries, setFloorDeliveries] = useState<FloorDeliveryState[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DELIVERY);
      return saved ? JSON.parse(saved) : [
        { floorId: 'F1', floorName: 'Tầng 1 (Khu A & B)', trayCount: 25, breakdown: 'Cơm 15, Cháo 8, Sonde 2', status: 'PENDING' },
        { floorId: 'F2', floorName: 'Tầng 2 (Khu C & D)', trayCount: 30, breakdown: 'Cơm 20, Cháo 7, Xay 3', status: 'PENDING' },
        { floorId: 'F3', floorName: 'Tầng 3 (Khu Đặc Biệt)', trayCount: 30, breakdown: 'Cơm 18, Cháo 8, Sonde 4', status: 'DELIVERED', deliveredAt: '10:52 AM', deliveredBy: actorName },
        { floorId: 'F4', floorName: 'Tầng 4 (Khu Chăm Sóc ĐB)', trayCount: 25, breakdown: 'Cơm 12, Cháo 8, Xay 5', status: 'PENDING' },
      ];
    } catch {
      return [];
    }
  });

  // Hygiene & 24h Food Sample Preservation Checklist State
  const [hygieneChecks, setHygieneChecks] = useState<HygieneCheckItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HYGIENE);
      return saved ? JSON.parse(saved) : [
        { id: 'SAMPLE_LUNCH', label: 'Lưu mẫu thức ăn Bữa Trưa (24h chuẩn Bộ Y Tế)', icon: '🧪', status: 'COMPLETED', completedAt: '10:45 AM' },
        { id: 'DISINFECT_TRAY', label: 'Khử trùng khay ăn & dụng cụ bát đĩa ca trực', icon: '🧽', status: 'PENDING' },
        { id: 'CLEAN_KITCHEN_SURFACE', label: 'Vệ sinh mặt bếp, sàn bếp & khu chế biến', icon: '🧹', status: 'PENDING' },
        { id: 'FIRE_SAFETY_CHECK', label: 'Kiểm tra an toàn điện, hệ thống gas & PCCC bếp', icon: '🧯', status: 'COMPLETED', completedAt: '06:15 AM' },
      ];
    } catch {
      return [];
    }
  });

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DELIVERY, JSON.stringify(floorDeliveries));
  }, [floorDeliveries]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HYGIENE, JSON.stringify(hygieneChecks));
  }, [hygieneChecks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MEAL_STAGE, JSON.stringify(mealStageStatus));
  }, [mealStageStatus]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (window.navigator && window.navigator.vibrate) {
      try { window.navigator.vibrate(50); } catch { }
    }
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Advance Meal Stage
  const handleAdvanceMealStage = async (mealKey: 'BREAKFAST' | 'LUNCH' | 'DINNER') => {
    const current = mealStageStatus[mealKey];
    let nextStatus: 'NOT_STARTED' | 'COOKING' | 'PORTIONING' | 'COMPLETED' = 'NOT_STARTED';
    let label = '';

    if (current === 'NOT_STARTED') {
      nextStatus = 'COOKING';
      label = 'BẮT ĐẦU CHẾ BIẾN';
    } else if (current === 'COOKING') {
      nextStatus = 'PORTIONING';
      label = 'ĐANG CHIA SUẤT ĂN';
    } else if (current === 'PORTIONING') {
      nextStatus = 'COMPLETED';
      label = 'HOÀN THÀNH BỮA ĂN';
    } else {
      nextStatus = 'NOT_STARTED';
      label = 'ĐẶT LẠI TRẠNG THÁI';
    }

    setMealStageStatus(prev => ({ ...prev, [mealKey]: nextStatus }));

    if (actor) {
      try {
        await createWorkEvent(actor, {
          workEventTypeId: 'MEAL_COOKING_MEDICAL',
          sourceDomain: 'KITCHEN_OPERATIONS',
          plannedClassification: 'PLANNED',
          note: `⚡ [1-TAP] ${label} cho ${mealKey === 'BREAKFAST' ? 'Bữa Sáng' : mealKey === 'LUNCH' ? 'Bữa Trưa' : 'Bữa Tối'}`,
          status: 'COMPLETED',
        });
        queryClient.invalidateQueries({ queryKey: ['dashboard-work-events'] });
      } catch { }
    }

    showToast(`⚡ Đã chuyển Bữa ${mealKey === 'BREAKFAST' ? 'Sáng' : mealKey === 'LUNCH' ? 'Trưa' : 'Tối'} ➔ ${label}`);
  };

  // Deliver Floor 1-Tap
  const handleDeliverFloor = async (floorId: string) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const targetFloor = floorDeliveries.find(f => f.floorId === floorId);

    setFloorDeliveries(prev => prev.map(f => {
      if (f.floorId === floorId) {
        const isDelivered = f.status === 'DELIVERED';
        return {
          ...f,
          status: isDelivered ? 'PENDING' : 'DELIVERED',
          deliveredAt: isDelivered ? undefined : timeStr,
          deliveredBy: isDelivered ? undefined : actorName,
        };
      }
      return f;
    }));

    if (actor && targetFloor) {
      try {
        await createWorkEvent(actor, {
          workEventTypeId: 'MEAL_PORTION_DISPATCH',
          sourceDomain: 'KITCHEN_OPERATIONS',
          plannedClassification: 'PLANNED',
          note: `🍱 [1-TAP BÀN GIAO BẾP] Đã bàn giao ${targetFloor.trayCount} khay ăn cho ${targetFloor.floorName}`,
          status: 'COMPLETED',
        });
        queryClient.invalidateQueries({ queryKey: ['dashboard-work-events'] });
      } catch { }
    }

    showToast(`📦 [1-TAP] Đã bàn giao khay ăn cho ${targetFloor?.floorName || floorId} lúc ${timeStr}!`);
  };

  // Toggle Hygiene Item
  const handleToggleHygieneCheck = async (checkId: string) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const targetItem = hygieneChecks.find(h => h.id === checkId);

    setHygieneChecks(prev => prev.map(item => {
      if (item.id === checkId) {
        const isDone = item.status === 'COMPLETED';
        return {
          ...item,
          status: isDone ? 'PENDING' : 'COMPLETED',
          completedAt: isDone ? undefined : timeStr,
        };
      }
      return item;
    }));

    if (actor && targetItem) {
      try {
        const eventTypeId = checkId === 'SAMPLE_LUNCH' ? 'FOOD_SAMPLE_PRESERVATION' : 'KITCHEN_CLEANING_DISINFECTION';
        await createWorkEvent(actor, {
          workEventTypeId: eventTypeId,
          sourceDomain: 'KITCHEN_OPERATIONS',
          plannedClassification: 'PLANNED',
          note: `🛡 [1-TAP AN TOÀN BẾP] ${targetItem.label} - Hoàn thành lúc ${timeStr}`,
          status: 'COMPLETED',
        });
        queryClient.invalidateQueries({ queryKey: ['dashboard-work-events'] });
      } catch { }
    }

    showToast(`✅ [1-TAP] Ghi nhận: ${targetItem?.label}`);
  };

  // Incident Presets
  const handleReportIncident = async (incidentType: string, label: string) => {
    setIsSubmitting(true);
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    if (actor) {
      try {
        await createWorkEvent(actor, {
          workEventTypeId: 'OTHER_INCIDENTAL',
          sourceDomain: 'KITCHEN_OPERATIONS',
          plannedClassification: 'UNPLANNED',
          note: `🚨 [1-TAP SỰ CỐ BẾP] ${label} - Báo lúc ${timeStr} bởi ${actorName}`,
          status: 'COMPLETED',
        });
        queryClient.invalidateQueries({ queryKey: ['dashboard-work-events'] });
      } catch { }
    }

    setIsSubmitting(false);
    showToast(`🚨 Đã gửi báo cáo sự cố: "${label}"`);
  };

  // Live KPI Score Calculation
  const kpiScore = useMemo(() => {
    let score = 0;
    const deliveredCount = floorDeliveries.filter(f => f.status === 'DELIVERED').length;
    const totalFloors = floorDeliveries.length || 1;
    score += Math.round((deliveredCount / totalFloors) * 35);

    const stage = mealStageStatus[activeMealSlot];
    if (stage === 'COMPLETED') score += 35;
    else if (stage === 'PORTIONING') score += 25;
    else if (stage === 'COOKING') score += 15;
    else score += 5;

    const doneHygiene = hygieneChecks.filter(h => h.status === 'COMPLETED').length;
    const totalHygiene = hygieneChecks.length || 1;
    score += Math.round((doneHygiene / totalHygiene) * 20);

    score += 10;
    return Math.min(100, score);
  }, [floorDeliveries, mealStageStatus, activeMealSlot, hygieneChecks]);

  return (
    <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#064e3b',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.85rem',
          padding: '0.75rem 1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          border: '1px solid #34d399',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>⚡</span> {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
        borderRadius: '0.75rem',
        padding: '1.25rem 1.5rem',
        color: '#ffffff',
        boxShadow: '0 4px 12px rgba(22, 101, 52, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
              TÂM AN CARE — BẾP DINH DƯỠNG (THAO TÁC 1-CHẠM REALTIME)
            </h1>
          </div>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#bbf7d0' }}>
            Ca Sáng (06:00 - 14:00) • Người phụ trách: <strong>{actorName}</strong> ({actorRole === 'NUTRITIONIST' ? 'Nhân viên Dinh dưỡng' : actorRole})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: '#022c22', border: '1px solid #15803d', borderRadius: '0.5rem', padding: '0.4rem 0.85rem', textAlign: 'right' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#6ee7b7', fontFamily: 'monospace' }}>
              ⏰ {currentTime || '10:58:24 AM'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#a7f3d0', fontWeight: 600 }}>
              Đồng bộ Real-time 🟢
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 KPI & Status Cards (Responsive Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: KPI Live Calculator */}
        <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', borderLeft: '5px solid #166534', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ĐIỂM KPI CA TRỰC HÔM NAY
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{kpiScore}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>/ 100 điểm</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.4rem', fontWeight: 600 }}>
              🎯 Đạt chuẩn chất lượng Bếp Tâm An
            </div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534' }}>BÁO CÁO 1-CHẠM</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#15803d', marginTop: '0.1rem' }}>TỰ ĐỘNG KPI</div>
            <div style={{ fontSize: '0.68rem', color: '#166534', marginTop: '0.1rem' }}>Không gõ phím 📱</div>
          </div>
        </div>

        {/* Card 2: Meal Progress Stage */}
        <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', borderLeft: '5px solid #d97706', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⏱ TIẾN ĐỘ BỮA ĂN HÔM NAY
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#fffbeb', color: '#b45309', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #fef3c7' }}>
              1-Tap Đổi Trạng Thái
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
            {/* Breakfast */}
            <button
              onClick={() => { setActiveMealSlot('BREAKFAST'); handleAdvanceMealStage('BREAKFAST'); }}
              style={{
                padding: '0.6rem 0.4rem',
                borderRadius: '0.5rem',
                border: activeMealSlot === 'BREAKFAST' ? '2px solid #166534' : '1px solid #cbd5e1',
                background: activeMealSlot === 'BREAKFAST' ? '#f0fdf4' : '#f8fafc',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569' }}>SÁNG (06:45)</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: mealStageStatus.BREAKFAST === 'COMPLETED' ? '#15803d' : '#b45309', marginTop: '0.2rem' }}>
                {mealStageStatus.BREAKFAST === 'COMPLETED' ? '✅ Đã xong' : '🟡 Đang nấu'}
              </div>
            </button>

            {/* Lunch */}
            <button
              onClick={() => { setActiveMealSlot('LUNCH'); handleAdvanceMealStage('LUNCH'); }}
              style={{
                padding: '0.6rem 0.4rem',
                borderRadius: '0.5rem',
                border: '2px solid #d97706',
                background: mealStageStatus.LUNCH === 'PORTIONING' ? '#fffbeb' : '#f0fdf4',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#78350f' }}>TRƯA (11:00)</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#92400e', marginTop: '0.2rem' }}>
                {mealStageStatus.LUNCH === 'COMPLETED' ? '✅ Đã xong' : mealStageStatus.LUNCH === 'PORTIONING' ? '🔥 Đang chia' : '🟡 Đang nấu'}
              </div>
            </button>

            {/* Dinner */}
            <button
              onClick={() => { setActiveMealSlot('DINNER'); handleAdvanceMealStage('DINNER'); }}
              style={{
                padding: '0.6rem 0.4rem',
                borderRadius: '0.5rem',
                border: activeMealSlot === 'DINNER' ? '2px solid #166534' : '1px solid #cbd5e1',
                background: activeMealSlot === 'DINNER' ? '#f0fdf4' : '#f8fafc',
                opacity: activeMealSlot === 'DINNER' ? 1 : 0.65,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569' }}>TỐI (17:00)</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>
                {mealStageStatus.DINNER === 'COMPLETED' ? '✅ Đã xong' : '⚪ Chưa tới'}
              </div>
            </button>
          </div>
        </div>

        {/* Card 3: Nutrition Prep Breakdown */}
        <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', borderLeft: '5px solid #2563eb', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🍲 ĐỊNH MỨC BỮA TRƯA (110 SUẤT)
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #bfdbfe' }}>
              Chốt thực đơn
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', textAlign: 'center' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.4rem', borderRadius: '0.375rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Cơm mềm</span>
              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>65</strong>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.4rem', borderRadius: '0.375rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#1d4ed8', display: 'block' }}>Cháo băm</span>
              <strong style={{ fontSize: '1rem', color: '#1e40af' }}>25</strong>
            </div>
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '0.4rem', borderRadius: '0.375rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#7e22ce', display: 'block' }}>Xay nhuyễn</span>
              <strong style={{ fontSize: '1rem', color: '#6b21a8' }}>15</strong>
            </div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '0.4rem', borderRadius: '0.375rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#c2410c', display: 'block' }}>Sonde</span>
              <strong style={{ fontSize: '1rem', color: '#9a3412' }}>5</strong>
            </div>
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.4rem', borderRadius: '0.375rem', gridColumn: 'span 2' }}>
              <span style={{ fontSize: '0.68rem', color: '#be123c', display: 'block' }}>Kiêng đường & Ăn nhạt</span>
              <strong style={{ fontSize: '1rem', color: '#9f1239' }}>12 cụ</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Main Operational Split (2 columns desktop, 1 column mobile) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        
        {/* Left Column: 1-Tap Floor Deliveries */}
        <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📦</span> 1-TAP BÀN GIAO KHAY ĂN CHO TẦNG
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Chạm nút để ghi nhận</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {floorDeliveries.map((floor) => {
              const isDelivered = floor.status === 'DELIVERED';
              return (
                <div
                  key={floor.floorId}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '0.65rem',
                    border: isDelivered ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                    background: isDelivered ? '#f0fdf4' : '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isDelivered ? '#14532d' : '#0f172a' }}>
                      {floor.floorName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                      <strong>{floor.trayCount} Khay</strong> • {floor.breakdown}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeliverFloor(floor.floorId)}
                    style={{
                      padding: '0.75rem 1.1rem',
                      borderRadius: '0.5rem',
                      border: isDelivered ? '1px solid #4ade80' : 'none',
                      background: isDelivered ? '#dcfce7' : '#166534',
                      color: isDelivered ? '#14532d' : '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      minHeight: '48px',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: isDelivered ? 'none' : '0 2px 4px rgba(22,101,52,0.2)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{isDelivered ? '✅' : '🟢'}</span>
                    <span>{isDelivered ? `ĐÃ BÀN GIAO (${floor.deliveredAt})` : 'CHẠM BÀN GIAO'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Hygiene & Incident Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Hygiene & Food Sample Preservation Checklist */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🛡</span> VỆ SINH & LƯU MẪU 24H (CHUẨN BỘ Y TẾ)
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {hygieneChecks.map((item) => {
                const isDone = item.status === 'COMPLETED';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleHygieneCheck(item.id)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.65rem',
                      border: isDone ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                      background: isDone ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      minHeight: '52px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: isDone ? '#14532d' : '#1e293b' }}>
                          {item.label}
                        </div>
                        {isDone && (
                          <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, marginTop: '0.1rem' }}>
                            Đã hoàn thành lúc {item.completedAt}
                          </div>
                        )}
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.4rem 0.85rem',
                      borderRadius: '0.375rem',
                      background: isDone ? '#dcfce7' : '#166534',
                      color: isDone ? '#14532d' : '#ffffff',
                      border: isDone ? '1px solid #86efac' : 'none',
                      whiteSpace: 'nowrap',
                    }}>
                      {isDone ? '✅ ĐÃ LƯU' : 'CHẠM XÁC NHẬN'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Incident Report Presets */}
          <div className="card" style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #fef3c7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#92400e', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🚨</span> BÁO SỰ CỐ BẾP KHẨN (1-TAP INCIDENT)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReportIncident('INGREDIENT_SHORTAGE', 'Thiếu nguyên liệu tươi')}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #fecdd3',
                  background: '#ffffff',
                  color: '#9f1239',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: '48px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                ⚠️ Thiếu nguyên liệu
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReportIncident('MENU_CHANGE', 'Đổi món đột xuất theo y lệnh')}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #fef3c7',
                  background: '#ffffff',
                  color: '#92400e',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: '48px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                🔄 Đổi món đột xuất
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReportIncident('EQUIPMENT_FAULT', 'Hỏng hóc thiết bị bếp')}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #fed7aa',
                  background: '#ffffff',
                  color: '#9a3412',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: '48px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                🔧 Hỏng thiết bị bếp
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReportIncident('STAFF_ASSIST', 'Yêu cầu hỗ trợ tăng cường ca')}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #bfdbfe',
                  background: '#ffffff',
                  color: '#1e40af',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: '48px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                🆘 Cần hỗ trợ ca bếp
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default KitchenQuickAction1Touch;
