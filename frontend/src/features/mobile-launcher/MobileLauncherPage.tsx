import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActor } from '../../auth/ActorContext';
import { ROLE_LABELS, hasCapability, canAccessRoute } from '../../auth/role-policy';
import type { HumanActorRole } from '../../types/actor';
import { createStaffLeaveRequest, StaffLeaveType } from '../../api/resident-leave';

interface AppIconItem {
  id: string;
  title: string;
  icon: string;
  gradient: string;
  badge?: string | number;
  badgeBg?: string;
  category: string;
  isAllowed: (role: HumanActorRole | undefined | null) => boolean;
}

export function MobileLauncherPage() {
  const { actor } = useActor();
  const navigate = useNavigate();

  const actorRole = actor?.actorRole;
  const actorName = actor?.displayName || 'Nhân viên';
  const roleLabel = (actorRole && ROLE_LABELS[actorRole]) || 'Nhân viên chuyên môn';

  // State: Currently selected icon ID for FULL SCREEN VIEW (null = show Icon Grid)
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Dynamic state for task completions inside full-screen view
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Leave Form State for "Tạo Đơn Xin Nghỉ Phép"
  const [leaveType, setLeaveType] = useState<StaffLeaveType>('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSpecialCase, setIsSpecialCase] = useState(false);
  const [specialReason, setSpecialReason] = useState('');
  const [reason, setReason] = useState('');
  const [leaveFormError, setLeaveFormError] = useState<string | null>(null);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Voice AI State
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const toggleTaskDone = (id: string, name: string) => {
    setCompletedTaskIds((prev) => {
      const nextState = !prev[id];
      if (nextState) showToast(`✓ Đã xác nhận hoàn thành cho ${name}`);
      return { ...prev, [id]: nextState };
    });
  };

  const startVoiceAI = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'vi-VN';
      rec.onstart = () => setIsRecording(true);
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setVoiceTranscript((prev) => (prev ? prev + ' ' + text : text));
        setIsRecording(false);
        showToast('✓ Đã thu âm thành công!');
      };
      rec.onerror = () => {
        setIsRecording(false);
        showToast('⚠️ Hãy thử lại thu âm giọng nói');
      };
      rec.onend = () => setIsRecording(false);
      rec.start();
    } else {
      showToast('⚠️ Trình duyệt chưa hỗ trợ Voice AI');
    }
  };

  // Calculate notice hours for leave request
  const staffNoticePreview = useMemo(() => {
    if (!startDate) return null;
    const startMs = new Date(startDate).getTime();
    if (isNaN(startMs)) return null;
    const hours = Math.round(((startMs - Date.now()) / (1000 * 60 * 60)) * 10) / 10;
    return {
      hours,
      is48h: hours >= 48,
    };
  }, [startDate]);

  const handleStaffLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveFormError(null);
    if (!startDate || !endDate || !reason.trim()) {
      setLeaveFormError('Vui lòng điền đầy đủ các thông tin bắt buộc (*).');
      return;
    }
    if (isSpecialCase && !specialReason.trim()) {
      setLeaveFormError('Vui lòng nhập lý do giải trình cho trường hợp đặc biệt.');
      return;
    }

    try {
      setIsSubmittingLeave(true);
      await createStaffLeaveRequest(actor?.actorId || 'staff-1', actorRole || 'CARE_STAFF', {
        leaveType,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: reason.trim(),
        isSpecialCase,
        specialReason: isSpecialCase ? specialReason.trim() : undefined,
      });
      showToast('🎉 Đơn xin nghỉ phép đã được gửi thành công!');
      setLeaveType('ANNUAL');
      setStartDate('');
      setEndDate('');
      setIsSpecialCase(false);
      setSpecialReason('');
      setReason('');
      setLeaveFormError(null);
    } catch (err: any) {
      setLeaveFormError(err.message || 'Lỗi gửi đơn xin nghỉ phép.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Master List of iPhone Icons strictly mapped to Role Capability
  const allIcons: AppIconItem[] = useMemo(() => [
    // --- 1. TÂM LÝ VÀ CÔNG TÁC XÃ HỘI ---
    {
      id: 'psychology-eval',
      title: 'Đánh Giá Tâm Lý',
      icon: '😀',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      badge: 'MỚI',
      badgeBg: '#f59e0b',
      category: 'Tâm Lý & CTXH',
      isAllowed: (role) => hasCapability(role, 'canEvaluatePsychology') || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
    },
    {
      id: 'counseling',
      title: 'Tư Vấn Tâm Lý',
      icon: '🗣️',
      gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      category: 'Tâm Lý & CTXH',
      isAllowed: (role) => hasCapability(role, 'canEvaluatePsychology') || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
    },

    // --- 2. CƯ DÂN & GHI ÂM (DÙNG CHUNG) ---
    {
      id: 'residents',
      title: 'Hồ Sơ Cư Dân',
      icon: '👵',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      badge: 15,
      category: 'Hồ Sơ',
      isAllowed: (role) => canAccessRoute(role, 'residents'),
    },
    {
      id: 'voice',
      title: 'Ghi Âm AI',
      icon: '🎙️',
      gradient: 'linear-gradient(135deg, #a855f7, #7e22ce)',
      badge: 'AI',
      badgeBg: '#a855f7',
      category: 'Công Cụ AI',
      isAllowed: () => true,
    },

    // --- 3. CHĂM SÓC HÀNG NGÀY (CHỈ CAREGIVER / NURSE / BGĐ) ---
    {
      id: 'hygiene',
      title: 'Tắm & Vệ Sinh',
      icon: '🚿',
      gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)',
      category: 'Chăm Sóc',
      isAllowed: (role) => (hasCapability(role, 'canLogDirectCare') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER') || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
    },
    {
      id: 'meals',
      title: 'Bữa Ăn',
      icon: '🥣',
      gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
      badge: 'SÁNG',
      badgeBg: '#f59e0b',
      category: 'Chăm Sóc',
      isAllowed: (role) => (hasCapability(role, 'canLogDirectCare') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER') || role === 'NUTRITIONIST' || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
    },

    // --- 4. Y TẾ & DƯỢC PHẨM (NURSE / Y TẾ) ---
    {
      id: 'meds',
      title: 'Uống Thuốc',
      icon: '💊',
      gradient: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      badge: 3,
      category: 'Y Tế',
      isAllowed: (role) => hasCapability(role, 'canAdministerMedication') || hasCapability(role, 'canPrescribeMedication') || role === 'ADMIN' || role === 'CARE_MANAGER',
    },
    {
      id: 'vitals',
      title: 'Đo Sinh Hiệu',
      icon: '🩺',
      gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
      badge: 2,
      category: 'Y Tế',
      isAllowed: (role) => hasCapability(role, 'canCreateHealthReport') || hasCapability(role, 'canAdministerMedication') || role === 'ADMIN' || role === 'CARE_MANAGER',
    },
    {
      id: 'health-reports',
      title: 'Báo Cáo Định Kỳ',
      icon: '📄',
      gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
      badge: 'Định Kỳ',
      category: 'Y Tế',
      isAllowed: (role) => canAccessRoute(role, 'health-reports'),
    },
    {
      id: 'pharmacy',
      title: 'Kho Dược eMAR',
      icon: '💉',
      gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
      category: 'Y Tế',
      isAllowed: (role) => hasCapability(role, 'canManagePharmacy') || (canAccessRoute(role, 'medication-inventory') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER'),
    },

    // --- 5. TÍN HIỆU CẢNH BÁO & VẬN HÀNH ---
    {
      id: 'incident',
      title: 'Báo Sự Cố',
      icon: '🚨',
      gradient: 'linear-gradient(135deg, #dc2626, #991b1b)',
      category: 'Cảnh Báo',
      isAllowed: () => true,
    },
    {
      id: 'workforce',
      title: 'Lịch Trực Ca',
      icon: '📅',
      gradient: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
      category: 'Ca Trực',
      isAllowed: (role) => canAccessRoute(role, 'workforce'),
    },
    {
      id: 'leave',
      title: 'Tạo Đơn Xin Nghỉ Phép',
      icon: '📝',
      gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
      category: 'Ca Trực',
      isAllowed: () => true, // Áp dụng cho tất cả nhân viên
    },

    // --- 6. DINH DƯỠNG BẾP ---
    {
      id: 'kitchen',
      title: 'Bếp Dinh Dưỡng',
      icon: '🍳',
      gradient: 'linear-gradient(135deg, #ea580c, #c2410c)',
      category: 'Dinh Dưỡng',
      isAllowed: (role) => hasCapability(role, 'canManageKitchenOperations') || canAccessRoute(role, 'kitchen-operations'),
    },

    // --- 7. KẾ TOÁN & LỄ TÂN ---
    {
      id: 'billing',
      title: 'Viện Phí',
      icon: '💳',
      gradient: 'linear-gradient(135deg, #10b981, #047857)',
      category: 'Tài Chính',
      isAllowed: (role) => hasCapability(role, 'canManageBilling') || canAccessRoute(role, 'billing-invoicing'),
    },
    {
      id: 'reception',
      title: 'Đón Thân Nhân',
      icon: '🤝',
      gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
      category: 'Lễ Tân',
      isAllowed: (role) => role === 'RECEPTIONIST' || canAccessRoute(role, 'family-portal') || role === 'SUPERVISOR' || role === 'ADMIN',
    },
    {
      id: 'rehab',
      title: 'Tập Phục Hồi',
      icon: '🏋️',
      gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
      category: 'Phục Hồi',
      isAllowed: (role) => role === 'REHABILITATION_SPECIALIST' || role === 'SUPERVISOR' || role === 'ADMIN',
    },

    // --- 8. QUẢN TRỊ ---
    {
      id: 'analytics',
      title: 'Phân Tích KPI',
      icon: '📈',
      gradient: 'linear-gradient(135deg, #4f46e5, #3730a3)',
      category: 'Quản Trị',
      isAllowed: (role) => hasCapability(role, 'canAccessAnalytics') || canAccessRoute(role, 'analytics-intelligence'),
    },
    {
      id: 'staff-access',
      title: 'Phân Quyền',
      icon: '🔑',
      gradient: 'linear-gradient(135deg, #334155, #0f172a)',
      category: 'Quản Trị',
      isAllowed: (role) => hasCapability(role, 'canManageStaff') || canAccessRoute(role, 'staff-access'),
    },
  ], []);

  // Filter icons according to logged-in user's role
  const visibleIcons = useMemo(() => {
    return allIcons.filter((item) => item.isAllowed(actorRole));
  }, [allIcons, actorRole]);

  // Find currently selected app object
  const activeApp = useMemo(() => {
    return allIcons.find((item) => item.id === selectedAppId) || null;
  }, [allIcons, selectedAppId]);

  // Icon Click Handler: HIDE GRID completely by setting selectedAppId
  const handleAppClick = (app: AppIconItem) => {
    if (app.id === 'residents') {
      navigate('/residents');
    } else if (app.id === 'health-reports') {
      navigate('/health-reports');
    } else if (app.id === 'billing') {
      navigate('/billing-invoicing');
    } else if (app.id === 'staff-access') {
      navigate('/staff-access');
    } else {
      setSelectedAppId(app.id);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff', // Pure clean white background
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#047857',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 800,
            padding: '10px 20px',
            borderRadius: '999px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            zIndex: 9999,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 
        CONDITION 1: IF AN ICON IS SELECTED -> ICONS GRID IS 100% HIDDEN.
        ONLY RENDER FULL-SCREEN PROFESSIONAL TASK FORM & MONITORING BOARD 
      */}
      {activeApp ? (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          {/* Clean Top Navigation Bar with Back Button */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedAppId(null)}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>← Quay lại Icon</span>
            </button>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                {activeApp.category} • {roleLabel}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                {activeApp.icon} {activeApp.title}
              </div>
            </div>
          </div>

          {/* Full-Screen Task & Monitoring Form Content */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              maxWidth: '480px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Header info box */}
            <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '14px', borderRadius: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#047857' }}>
                📋 Tiêu Chí Giám Sát & Đánh Giá Hoàn Thành Công Việc Ca Trực
              </div>
              <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px' }}>
                Vị trí: <strong>{roleLabel} ({actorName})</strong>. Yêu cầu xác nhận đã thực hiện và báo cáo kết quả đánh giá.
              </div>
            </div>

            {/* FORM TYPE 1: PSYCHOLOGY & SOCIAL WORK (TÂM LÝ & CTXH) */}
            {(activeApp.id === 'psychology-eval' || activeApp.id === 'counseling') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { id: 'psy-1', name: 'Cụ Nguyễn Thị Mai', room: 'Phòng 201 • Giường A', note: 'Thích trò chuyện về gia đình, tâm lý ổn định' },
                  { id: 'psy-2', name: 'Cụ Trần Văn Bình', room: 'Phòng 203 • Giường B', note: 'Có biểu hiện lo âu ca đêm, cần động viên' },
                  { id: 'psy-3', name: 'Cụ Lê Hoàng Nam', room: 'Phòng 205 • Giường A', note: 'Tham gia tích cực CLB Đọc sách ca sáng' },
                ].map((item) => {
                  const isDone = completedTaskIds[item.id];
                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '18px',
                        padding: '14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{item.room}</div>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            backgroundColor: isDone ? '#dcfce7' : '#fef3c7',
                            color: isDone ? '#15803d' : '#b45309',
                          }}
                        >
                          {isDone ? '✓ ĐÃ ĐÁNH GIÁ' : 'CHỜ TƯ VẤN'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#334155', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '12px' }}>
                        <strong>Ghi chú tâm lý:</strong> {item.note}
                      </div>

                      {/* 1-Tap Emotion Criteria Selection */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => showToast(`✓ Đã ghi nhận ${item.name}: Tinh thần Tốt 😀`)}
                          style={{ flex: 1, padding: '8px', borderRadius: '12px', border: '1px solid #10b981', backgroundColor: '#ecfdf5', fontSize: '11px', fontWeight: 700, color: '#047857', cursor: 'pointer' }}
                        >
                          😀 Vui Vẻ
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(`✓ Đã ghi nhận ${item.name}: Bình thường 😐`)}
                          style={{ flex: 1, padding: '8px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '11px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                        >
                          😐 Bình Thường
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(`⚠️ Đã báo cáo ${item.name}: Lo âu 🙁`)}
                          style={{ flex: 1, padding: '8px', borderRadius: '12px', border: '1px solid #f43f5e', backgroundColor: '#fff1f2', fontSize: '11px', fontWeight: 700, color: '#be123c', cursor: 'pointer' }}
                        >
                          🙁 Lo Âm
                        </button>
                      </div>

                      {/* Confirm Task Completion */}
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(item.id, item.name)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '14px',
                          border: 'none',
                          backgroundColor: isDone ? '#047857' : '#10b981',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {isDone ? '✓ ĐÃ XÁC NHẬN TƯ VẤN CA NÀY' : '1-CHẠM XÁC NHẬN HOÀN THÀNH'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FORM TYPE 2: NURSE & MEDICATION (Y TẾ & ĐIỀU DƯỠNG) */}
            {(activeApp.id === 'meds' || activeApp.id === 'vitals') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { id: 'med-1', name: 'Cụ Nguyễn Thị Mai', room: 'Phòng 201', detail: 'Thuốc Huyết Áp (1 Viên) • Ca 08:00' },
                  { id: 'med-2', name: 'Cụ Trần Văn Bình', room: 'Phòng 203', detail: 'Thuốc Bổ Não (2 Viên) • Ca 08:00' },
                ].map((m) => {
                  const isDone = completedTaskIds[m.id];
                  return (
                    <div key={m.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{m.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{m.room}</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{m.detail}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(m.id, m.name)}
                        style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', backgroundColor: isDone ? '#047857' : '#2563eb', color: '#ffffff', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        {isDone ? '✓ ĐÃ UỐNG' : '1-CHẠM'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FORM TYPE 3: CAREGIVER (CHĂM SÓC VIÊN) */}
            {(activeApp.id === 'hygiene' || activeApp.id === 'meals') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { id: 'cg-1', name: 'Cụ Nguyễn Thị Mai', room: 'Phòng 201' },
                  { id: 'cg-2', name: 'Cụ Trần Văn Bình', room: 'Phòng 203' },
                ].map((cg) => (
                  <div key={cg.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '14px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{cg.name} ({cg.room})</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button type="button" onClick={() => showToast(`✓ Ghi nhận ${cg.name}: Ăn hết 100%`)} style={{ flex: 1, padding: '8px', borderRadius: '12px', backgroundColor: '#ecfdf5', border: '1px solid #10b981', fontSize: '11px', fontWeight: 700, color: '#047857' }}>Ăn 100%</button>
                      <button type="button" onClick={() => showToast(`✓ Ghi nhận ${cg.name}: Ăn được 50%`)} style={{ flex: 1, padding: '8px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #f59e0b', fontSize: '11px', fontWeight: 700, color: '#b45309' }}>Ăn 50%</button>
                      <button type="button" onClick={() => showToast(`⚠️ Đã báo cáo ${cg.name}: Bỏ Bữa`)} style={{ flex: 1, padding: '8px', borderRadius: '12px', backgroundColor: '#fff1f2', border: '1px solid #f43f5e', fontSize: '11px', fontWeight: 700, color: '#be123c' }}>Bỏ Bữa</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* FORM TYPE 4: VOICE AI */}
            {activeApp.id === 'voice' && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '22px', padding: '24px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={startVoiceAI}
                  style={{
                    width: '76px',
                    height: '76px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: isRecording ? '#ef4444' : '#8b5cf6',
                    color: '#ffffff',
                    fontSize: '34px',
                    margin: '0 auto 16px auto',
                    cursor: 'pointer',
                    boxShadow: '0 10px 25px rgba(139, 92, 246, 0.3)',
                  }}
                >
                  🎙️
                </button>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#4c1d95' }}>
                  {isRecording ? '🔴 Đang lắng nghe... Nói trực tiếp' : 'Bấm vào Micro để thu âm báo cáo giọng nói'}
                </div>
                {voiceTranscript && (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f3e8ff', borderRadius: '14px', fontSize: '12px', color: '#6b21a8', textAlign: 'left' }}>
                    <strong>Văn bản nhận diện:</strong> "{voiceTranscript}"
                  </div>
                )}
              </div>
            )}

            {/* FORM TYPE 5: TẠO ĐƠN XIN NGHỈ PHÉP NHÂN VIÊN */}
            {activeApp.id === 'leave' && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '22px', padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      📋 Mẫu Kê Khai Tạo Đơn Xin Nghỉ Phép
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Áp dụng cho tất cả nhân viên ({actorName} • {roleLabel})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/resident-leave')}
                    style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Danh sách đơn &rarr;
                  </button>
                </div>

                <form onSubmit={handleStaffLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {leaveFormError && (
                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: '12px', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                      ⚠️ {leaveFormError}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Loại nghỉ phép <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as StaffLeaveType)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, backgroundColor: '#f8fafc', color: '#0f172a' }}
                    >
                      <option value="ANNUAL">Nghỉ phép năm</option>
                      <option value="PERSONAL">Nghỉ việc riêng</option>
                      <option value="SICK">Nghỉ ốm / Khẩn cấp y tế</option>
                      <option value="UNPAID">Nghỉ không hưởng lương</option>
                      <option value="OTHER">Lý do khác</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Thời gian bắt đầu nghỉ <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Thời gian kết thúc nghỉ <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Notice Preview Banner */}
                  {staffNoticePreview && (
                    <div style={{ backgroundColor: staffNoticePreview.is48h ? '#ecfdf5' : '#fffbeb', border: `1px solid ${staffNoticePreview.is48h ? '#a7f3d0' : '#fde68a'}`, padding: '10px 12px', borderRadius: '12px', fontSize: '12px', color: staffNoticePreview.is48h ? '#047857' : '#b45309' }}>
                      <strong>Quy định báo trước ≥ 2 ngày (48h):</strong> Thời gian báo trước: <b>{staffNoticePreview.hours}h</b>. {staffNoticePreview.is48h ? '✓ Đạt quy định báo trước.' : '⚠️ Nhỏ hơn 48h (Tích chọn "Trường hợp đặc biệt").'}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                    <input
                      type="checkbox"
                      id="mobileIsSpecialCase"
                      checked={isSpecialCase}
                      onChange={(e) => setIsSpecialCase(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#d97706', cursor: 'pointer' }}
                    />
                    <label htmlFor="mobileIsSpecialCase" style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', cursor: 'pointer' }}>
                      ⚡ Trường hợp đặc biệt (khẩn cấp / đột xuất &lt; 2 ngày)
                    </label>
                  </div>

                  {isSpecialCase && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#b45309', marginBottom: '6px' }}>
                        Lý do trường hợp đặc biệt / khẩn cấp <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={specialReason}
                        onChange={(e) => setSpecialReason(e.target.value)}
                        placeholder="Ví dụ: Sốt đột xuất 39 độ, gia đình có việc khẩn cấp..."
                        required={isSpecialCase}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #f59e0b', fontSize: '13px', backgroundColor: '#fffbeb', color: '#0f172a', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Lý do xin nghỉ phép <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      required
                      placeholder="Nêu rõ lý do xin nghỉ phép, kế hoạch bàn giao công việc ca trực..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '16px',
                      backgroundColor: isSubmittingLeave ? '#94a3b8' : '#ca8a04',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 800,
                      border: 'none',
                      cursor: isSubmittingLeave ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(202, 138, 4, 0.3)',
                    }}
                  >
                    {isSubmittingLeave ? '⏳ Đang gửi...' : '📝 GỬI ĐƠN XIN NGHỈ PHÉP'}
                  </button>
                </form>
              </div>
            )}

            {/* GENERAL FORM FOR OTHER ROLES */}
            {activeApp.id !== 'psychology-eval' && activeApp.id !== 'counseling' && activeApp.id !== 'meds' && activeApp.id !== 'vitals' && activeApp.id !== 'hygiene' && activeApp.id !== 'meals' && activeApp.id !== 'voice' && activeApp.id !== 'leave' && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '22px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  📋 Form Hoạt Động & Tiêu Chí Đánh Giá Chuyên Môn
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                  Yêu cầu xác nhận hoàn thành công việc chuyên môn của vị trí {roleLabel}.
                </div>

                <button
                  type="button"
                  onClick={() => {
                    showToast('✓ Đã báo cáo hoàn thành nhiệm vụ ca!');
                    setSelectedAppId(null);
                  }}
                  style={{ width: '100%', padding: '14px', borderRadius: '16px', backgroundColor: '#047857', color: '#ffffff', fontSize: '13px', fontWeight: 900, border: 'none', cursor: 'pointer' }}
                >
                  XÁC NHẬN HOÀN THÀNH CA TRỰC
                </button>
              </div>
            )}

            {/* Final Confirmation Button to Complete & Return */}
            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  showToast('✓ Đã hoàn thành báo cáo & tiêu chí giám sát!');
                  setSelectedAppId(null);
                }}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '18px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 900,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                }}
              >
                XÁC NHẬN BÁO CÁO & QUAY LẠI MÀN HÌNH ICON
              </button>
            </div>

          </div>
        </div>
      ) : (
        /* 
          CONDITION 2: DEFAULT VIEW -> CLEAN WHITE IPHONE 4-COLUMN MATRIX GRID
          NO inner black top banner, NO dots ..., NO bottom dock bar, NO floating drawer elements!
        */
        <div
          style={{
            maxWidth: '430px',
            width: '100%',
            margin: '0 auto',
            padding: '20px 16px 36px 16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '26px 12px',
              alignItems: 'start',
            }}
          >
            {visibleIcons.map((app) => (
              <div
                key={app.id}
                onClick={() => handleAppClick(app)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {/* iPhone Squircle App Icon (60px x 60px) */}
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '18px',
                    background: app.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    color: '#ffffff',
                    position: 'relative',
                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(0, 0, 0, 0.05)',
                    boxSizing: 'border-box',
                  }}
                >
                  <span>{app.icon}</span>

                  {/* Red Circular Badge */}
                  {app.badge !== undefined && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        backgroundColor: app.badgeBg || '#ef4444',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 900,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        border: '2px solid #ffffff',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                        lineHeight: 1,
                      }}
                    >
                      {app.badge}
                    </span>
                  )}
                </div>

                {/* Title Label Under Icon on White Background */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginTop: '7px',
                    lineHeight: 1.25,
                    textAlign: 'center',
                    wordBreak: 'break-word',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {app.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
