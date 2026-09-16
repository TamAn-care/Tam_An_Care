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

const STORAGE_KEY_DELIVERY = 'taman_kitchen_floor_delivery_v1';
const STORAGE_KEY_HYGIENE = 'taman_kitchen_hygiene_checks_v1';
const STORAGE_KEY_MEAL_STAGE = 'taman_kitchen_meal_stage_v1';

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

  // Notification / Success Feedback Toast
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DELIVERY, JSON.stringify(floorDeliveries));
  }, [floorDeliveries]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HYGIENE, JSON.stringify(hygieneChecks));
  }, [hygieneChecks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MEAL_STAGE, JSON.stringify(mealStageStatus));
  }, [mealStageStatus]);

  // Show Temporary Feedback Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (window.navigator && window.navigator.vibrate) {
      try { window.navigator.vibrate(50); } catch { }
    }
    setTimeout(() => setToastMessage(''), 3500);
  };

  // 1-Tap Cycle Meal Stage Status
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
      } catch {
        // Fallback
      }
    }

    showToast(`⚡ Đã chuyển trạng thái Bữa ${mealKey === 'BREAKFAST' ? 'Sáng' : mealKey === 'LUNCH' ? 'Trưa' : 'Tối'} ➔ ${label}`);
  };

  // 1-Tap Floor Delivery Confirmation
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

  // 1-Tap Hygiene / Food Preservation Checklist Toggle
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

    showToast(`✅ [1-TAP] Đã ghi nhận: ${targetItem?.label}`);
  };

  // 1-Tap Quick Incident Presets
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
    showToast(`🚨 Đã báo sự cố: "${label}" đến Ban Quản lý!`);
  };

  // Live KPI Score Calculation
  const kpiScore = useMemo(() => {
    let score = 0;

    // 1. Delivery punctuality (35%)
    const deliveredCount = floorDeliveries.filter(f => f.status === 'DELIVERED').length;
    const totalFloors = floorDeliveries.length || 1;
    score += Math.round((deliveredCount / totalFloors) * 35);

    // 2. Meal Cooking Stage Completion (35%)
    const stage = mealStageStatus[activeMealSlot];
    if (stage === 'COMPLETED') score += 35;
    else if (stage === 'PORTIONING') score += 25;
    else if (stage === 'COOKING') score += 15;
    else score += 5;

    // 3. Hygiene & Food Sample Preservation (20%)
    const doneHygiene = hygieneChecks.filter(h => h.status === 'COMPLETED').length;
    const totalHygiene = hygieneChecks.length || 1;
    score += Math.round((doneHygiene / totalHygiene) * 20);

    // 4. Base Operations Compliance (10%)
    score += 10;

    return Math.min(100, score);
  }, [floorDeliveries, mealStageStatus, activeMealSlot, hygieneChecks]);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans pb-10 select-none">
      
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-2 animate-bounce">
          <span>⚡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <header className="bg-emerald-800 text-white p-3.5 sticky top-0 z-30 shadow-md border-b border-emerald-900 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="font-extrabold text-sm tracking-tight">TÂM AN CARE — BẾP DINH DƯỠNG</h1>
          </div>
          <p className="text-[11px] text-emerald-200 mt-0.5">
            Ca Sáng (06:00 - 14:00) • {actorName} ({actorRole})
          </p>
        </div>

        <div className="text-right">
          <div className="bg-emerald-950 text-emerald-300 font-mono font-bold text-xs px-2.5 py-1 rounded-lg border border-emerald-700/60 shadow-inner">
            ⏰ {currentTime || '10:58 AM'}
          </div>
          <div className="text-[10px] text-emerald-200 mt-0.5 font-semibold">
            Real-time Sync 🟢
          </div>
        </div>
      </header>

      <main className="p-3 space-y-3.5 max-w-lg mx-auto">

        {/* Live KPI Score & Shift Overview Banner */}
        <section className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white rounded-2xl p-4 shadow-lg border border-emerald-700/50 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-300 tracking-wider uppercase block">ĐIỂM KPI CA TRỰC HÔM NAY</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-black text-white">{kpiScore}</span>
              <span className="text-xs text-emerald-200 font-semibold">/ 100 điểm</span>
            </div>
            <div className="text-[11px] text-emerald-200 mt-1 flex items-center gap-2">
              <span>🎯 Đạt chuẩn chất lượng Bếp Tâm An</span>
            </div>
          </div>

          <div className="text-right bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-700/50">
            <div className="text-[10px] text-emerald-300 font-bold uppercase">Báo cáo 1-Chạm</div>
            <div className="text-xs font-black text-emerald-400 mt-0.5">TỰ ĐỘNG GHI SỔ</div>
            <div className="text-[10px] text-emerald-200 mt-1">Không gõ phím 📱</div>
          </div>
        </section>

        {/* Meal Slot Stage Timeline Selector */}
        <section className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">⏱ Tiến độ các bữa ăn trong ngày</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">1-Tap Đổi Trạng Thái</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Breakfast */}
            <button
              onClick={() => { setActiveMealSlot('BREAKFAST'); handleAdvanceMealStage('BREAKFAST'); }}
              className={`p-2.5 rounded-xl border transition-all text-left relative ${
                activeMealSlot === 'BREAKFAST' ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-sm' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="text-[10px] font-bold text-slate-500">SÁNG (06:45)</div>
              <div className="text-xs font-black mt-0.5 text-emerald-800">
                {mealStageStatus.BREAKFAST === 'COMPLETED' ? '✅ Đã hoàn thành' : mealStageStatus.BREAKFAST === 'PORTIONING' ? '🔥 Đang chia' : '🟡 Đang nấu'}
              </div>
            </button>

            {/* Lunch */}
            <button
              onClick={() => { setActiveMealSlot('LUNCH'); handleAdvanceMealStage('LUNCH'); }}
              className={`p-2.5 rounded-xl border-2 transition-all text-left relative shadow-sm ${
                mealStageStatus.LUNCH === 'PORTIONING' ? 'border-amber-500 bg-amber-50/90' : 'border-emerald-600 bg-emerald-50'
              }`}
            >
              <div className="text-[10px] font-extrabold text-amber-900">TRƯA (11:00)</div>
              <div className="text-xs font-black mt-0.5 text-amber-950">
                {mealStageStatus.LUNCH === 'COMPLETED' ? '✅ Đã hoàn thành' : mealStageStatus.LUNCH === 'PORTIONING' ? '🔥 Đang chia suất' : '🟡 Đang nấu'}
              </div>
            </button>

            {/* Dinner */}
            <button
              onClick={() => { setActiveMealSlot('DINNER'); handleAdvanceMealStage('DINNER'); }}
              className={`p-2.5 rounded-xl border transition-all text-left ${
                activeMealSlot === 'DINNER' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-slate-50 opacity-70'
              }`}
            >
              <div className="text-[10px] font-bold text-slate-500">TỐI (17:00)</div>
              <div className="text-xs font-semibold mt-0.5 text-slate-600">
                {mealStageStatus.DINNER === 'COMPLETED' ? '✅ Đã xong' : '⚪ Chưa tới'}
              </div>
            </button>
          </div>
        </section>

        {/* Nutrition Real-time Counter Card */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              <span>🍲</span> ĐỊNH MỨC SUẤT ĂN BỮA TRƯA (110 SUẤT)
            </h2>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-300">Chốt thực đơn</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-medium block">Cơm mềm</span>
              <span className="text-lg font-black text-slate-800">65</span>
            </div>
            <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 text-center">
              <span className="text-[11px] text-blue-700 font-semibold block">Cháo băm</span>
              <span className="text-lg font-black text-blue-900">25</span>
            </div>
            <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-center">
              <span className="text-[11px] text-purple-700 font-semibold block">Xay nhuyễn</span>
              <span className="text-lg font-black text-purple-900">15</span>
            </div>
            <div className="bg-orange-50 p-2.5 rounded-xl border border-orange-200 text-center">
              <span className="text-[11px] text-orange-700 font-semibold block">Sonde</span>
              <span className="text-lg font-black text-orange-900">5</span>
            </div>
            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center col-span-2">
              <span className="text-[11px] text-rose-700 font-semibold block">Kiêng đường & Ăn nhạt</span>
              <span className="text-lg font-black text-rose-900">12 cụ</span>
            </div>
          </div>
        </section>

        {/* 1-Tap Delivery Action List by Floor / Section */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              <span>📦</span> 1-TAP BÀN GIAO KHAY ĂN CHO TẦNG
            </h2>
            <span className="text-[11px] text-slate-500 font-semibold">Chạm để ghi nhận</span>
          </div>

          <div className="space-y-2">
            {floorDeliveries.map((floor) => {
              const isDelivered = floor.status === 'DELIVERED';
              return (
                <div
                  key={floor.floorId}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isDelivered ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className={`font-bold text-xs ${isDelivered ? 'text-emerald-950' : 'text-slate-800'}`}>
                      {floor.floorName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {floor.trayCount} Khay • {floor.breakdown}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeliverFloor(floor.floorId)}
                    className={`font-extrabold text-xs px-3.5 py-3 rounded-xl shadow active:scale-95 transition-all flex items-center gap-1 min-h-[48px] ${
                      isDelivered
                        ? 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    }`}
                  >
                    <span>{isDelivered ? '✅' : '🟢'}</span>
                    <span>{isDelivered ? `ĐÃ BÀN GIAO (${floor.deliveredAt})` : 'CHẠM BÀN GIAO'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* 1-Tap Safety, Hygiene & 24h Food Preservation Checklist */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-2.5">
          <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 mb-1">
            <span>🛡</span> VỆ SINH & LƯU MẪU 24H (BỘ Y TẾ)
          </h2>

          <div className="space-y-2">
            {hygieneChecks.map((item) => {
              const isDone = item.status === 'COMPLETED';
              return (
                <button
                  key={item.id}
                  onClick={() => handleToggleHygieneCheck(item.id)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all min-h-[52px] active:scale-98 ${
                    isDone ? 'bg-emerald-50/80 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:bg-emerald-50/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <div>
                      <div className={`font-semibold text-xs ${isDone ? 'text-emerald-950' : 'text-slate-800'}`}>
                        {item.label}
                      </div>
                      {isDone && (
                        <div className="text-[10px] text-emerald-700 font-medium">
                          Đã hoàn thành lúc {item.completedAt}
                        </div>
                      )}
                    </div>
                  </span>

                  <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-lg border shadow-sm ${
                    isDone
                      ? 'bg-emerald-200 text-emerald-900 border-emerald-300'
                      : 'bg-emerald-700 text-white border-emerald-800'
                  }`}>
                    {isDone ? '✅ ĐÃ LƯU' : 'CHẠM XÁC NHẬN'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 1-Tap Quick Incident Presets */}
        <section className="bg-amber-50/70 rounded-2xl p-3.5 border border-amber-200 shadow-sm">
          <div className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1">
            <span>🚨</span> BÁO SỰ CỐ BẾP KHẨN (1-TAP INCIDENT)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isSubmitting}
              onClick={() => handleReportIncident('INGREDIENT_SHORTAGE', 'Thiếu nguyên liệu tươi')}
              className="bg-white border border-rose-300 text-rose-800 hover:bg-rose-50 font-bold text-xs p-3 rounded-xl text-left shadow-sm active:scale-95 transition-all min-h-[48px]"
            >
              ⚠️ Thiếu nguyên liệu
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => handleReportIncident('MENU_CHANGE', 'Đổi món đột xuất theo y lệnh')}
              className="bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 font-bold text-xs p-3 rounded-xl text-left shadow-sm active:scale-95 transition-all min-h-[48px]"
            >
              🔄 Đổi món đột xuất
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => handleReportIncident('EQUIPMENT_FAULT', 'Hỏng hóc thiết bị bếp')}
              className="bg-white border border-orange-300 text-orange-900 hover:bg-orange-50 font-bold text-xs p-3 rounded-xl text-left shadow-sm active:scale-95 transition-all min-h-[48px]"
            >
              🔧 Hỏng thiết bị bếp
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => handleReportIncident('STAFF_ASSIST', 'Yêu cầu hỗ trợ tăng cường ca')}
              className="bg-white border border-blue-300 text-blue-900 hover:bg-blue-50 font-bold text-xs p-3 rounded-xl text-left shadow-sm active:scale-95 transition-all min-h-[48px]"
            >
              🆘 Cần hỗ trợ ca bếp
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}

export default KitchenQuickAction1Touch;
