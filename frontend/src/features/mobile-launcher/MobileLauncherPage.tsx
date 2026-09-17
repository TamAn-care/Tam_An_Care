import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActor } from '../../auth/ActorContext';
import { ROLE_LABELS, hasCapability, canAccessRoute } from '../../auth/role-policy';
import { OneTapActionSheet, ActionCategory } from './OneTapActionSheet';
import type { HumanActorRole } from '../../types/actor';

interface AppIconItem {
  id: string;
  title: string;
  icon: string;
  gradient: string;
  badge?: string | number;
  badgeBg?: string;
  isAllowed: (role: HumanActorRole | undefined | null) => boolean;
  action: () => void;
}

export function MobileLauncherPage() {
  const { actor } = useActor();
  const navigate = useNavigate();

  const actorRole = actor?.actorRole;
  const actorName = actor?.displayName || 'Nhân viên';
  const roleLabel = (actorRole && ROLE_LABELS[actorRole]) || 'Điều dưỡng viên';

  const [activeCategory, setActiveCategory] = useState<ActionCategory>(null);

  // Master List of iPhone Icons with Strict Role-Based Capability Check
  const allIcons: AppIconItem[] = useMemo(() => [
    // --- 1. DÀNH CHO NHÂN VIÊN TÂM LÝ & CÔNG TÁC XÃ HỘI (PSYCHOLOGIST / SOCIAL_WORKER) ---
    {
      id: 'psychology-eval',
      title: 'Đánh Giá Tâm Lý',
      icon: '😀',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      badge: 'MỚI',
      badgeBg: '#f59e0b',
      isAllowed: (role) => hasCapability(role, 'canEvaluatePsychology') || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('health'),
    },
    {
      id: 'counseling',
      title: 'Tư Vấn Tâm Lý',
      icon: '🗣️',
      gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      isAllowed: (role) => hasCapability(role, 'canEvaluatePsychology') || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('health'),
    },

    // --- 2. CỨ DÂN (DÙNG CHUNG CHO TÂM LÝ, CÔNG TÁC XÃ HỘI, ĐIỀU DƯỠNG, BGĐ) ---
    {
      id: 'residents',
      title: 'Hồ Sơ Cư Dân',
      icon: '👵',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      badge: 15,
      isAllowed: (role) => canAccessRoute(role, 'residents'),
      action: () => navigate('/residents'),
    },

    // --- 3. GHI ÂM AI VOICE (TẤT CẢ VAI TRÒ DÙNG ĐƯỢC) ---
    {
      id: 'voice',
      title: 'Ghi Âm AI',
      icon: '🎙️',
      gradient: 'linear-gradient(135deg, #a855f7, #7e22ce)',
      badge: 'AI',
      badgeBg: '#a855f7',
      isAllowed: () => true,
      action: () => setActiveCategory('voice'),
    },

    // --- 4. NHÓM CHĂM SÓC HÀNG NGÀY (CHỈ CAREGIVER / NURSE / BGĐ) ---
    {
      id: 'hygiene',
      title: 'Tắm & Vệ Sinh',
      icon: '🚿',
      gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)',
      isAllowed: (role) => (hasCapability(role, 'canLogDirectCare') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER') || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('hygiene'),
    },
    {
      id: 'meals',
      title: 'Bữa Ăn',
      icon: '🥣',
      gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
      badge: 'SÁNG',
      badgeBg: '#f59e0b',
      isAllowed: (role) => (hasCapability(role, 'canLogDirectCare') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER') || role === 'NUTRITIONIST' || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('meals'),
    },

    // --- 5. NHÓM Y TẾ & DƯỢC PHẨM (TUYỆT ĐỐI KHÔNG HIỂN THỊ CHO TÂM LÝ / CTXH / TẠP VỤ) ---
    {
      id: 'meds',
      title: 'Uống Thuốc',
      icon: '💊',
      gradient: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      badge: 3,
      isAllowed: (role) => hasCapability(role, 'canAdministerMedication') || hasCapability(role, 'canPrescribeMedication') || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('meds'),
    },
    {
      id: 'vitals',
      title: 'Đo Sinh Hiệu',
      icon: '🩺',
      gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
      badge: 2,
      isAllowed: (role) => hasCapability(role, 'canCreateHealthReport') || hasCapability(role, 'canAdministerMedication') || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('vitals'),
    },
    {
      id: 'health-reports',
      title: 'Báo Cáo Y Tế',
      icon: '📊',
      gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
      isAllowed: (role) => canAccessRoute(role, 'health-reports') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER',
      action: () => navigate('/health-reports'),
    },
    {
      id: 'pharmacy',
      title: 'Kho Dược eMAR',
      icon: '💉',
      gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
      isAllowed: (role) => hasCapability(role, 'canManagePharmacy') || (canAccessRoute(role, 'medication-inventory') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER'),
      action: () => navigate('/medication-inventory'),
    },

    // --- 6. NHÓM TÍN HIỆU CẢNH BÁO & VẬN HÀNH ---
    {
      id: 'incident',
      title: 'Báo Sự Cố',
      icon: '🚨',
      gradient: 'linear-gradient(135deg, #dc2626, #991b1b)',
      isAllowed: () => true,
      action: () => setActiveCategory('incident'),
    },
    {
      id: 'workforce',
      title: 'Lịch Trực Ca',
      icon: '📅',
      gradient: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
      isAllowed: (role) => canAccessRoute(role, 'workforce'),
      action: () => navigate('/workforce'),
    },
    {
      id: 'leave',
      title: 'Xin Nghỉ Phép',
      icon: '🏖️',
      gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
      isAllowed: (role) => canAccessRoute(role, 'resident-leave'),
      action: () => navigate('/resident-leave'),
    },
    {
      id: 'accommodation',
      title: 'Sơ Đồ Phòng',
      icon: '🛌',
      gradient: 'linear-gradient(135deg, #3b82f6, #1e40af)',
      isAllowed: (role) => canAccessRoute(role, 'accommodation') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER',
      action: () => navigate('/accommodation'),
    },
    {
      id: 'admissions',
      title: 'Tiếp Nhận Mới',
      icon: '📝',
      gradient: 'linear-gradient(135deg, #059669, #047857)',
      isAllowed: (role) => canAccessRoute(role, 'admissions') && role !== 'PSYCHOLOGIST' && role !== 'SOCIAL_WORKER',
      action: () => navigate('/admissions'),
    },

    // --- 7. NHÓM DINH DƯỠNG BẾP (NUTRITIONIST / BGĐ) ---
    {
      id: 'kitchen',
      title: 'Bếp Dinh Dưỡng',
      icon: '🍳',
      gradient: 'linear-gradient(135deg, #ea580c, #c2410c)',
      isAllowed: (role) => hasCapability(role, 'canManageKitchenOperations') || canAccessRoute(role, 'kitchen-operations'),
      action: () => navigate('/kitchen-operations'),
    },

    // --- 8. NHÓM KẾ TOÁN & VIỆN PHÍ (ACCOUNTANT / BGĐ) ---
    {
      id: 'billing',
      title: 'Viện Phí',
      icon: '💳',
      gradient: 'linear-gradient(135deg, #10b981, #047857)',
      isAllowed: (role) => hasCapability(role, 'canManageBilling') || canAccessRoute(role, 'billing-invoicing'),
      action: () => navigate('/billing-invoicing'),
    },

    // --- 9. QUẢN TRỊ & THÂN NHÂN ---
    {
      id: 'family',
      title: 'Thân Nhân',
      icon: '👨‍👩‍👧',
      gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
      isAllowed: (role) => canAccessRoute(role, 'family-portal'),
      action: () => navigate('/family-portal'),
    },
    {
      id: 'analytics',
      title: 'Phân Tích KPI',
      icon: '📈',
      gradient: 'linear-gradient(135deg, #4f46e5, #3730a3)',
      isAllowed: (role) => hasCapability(role, 'canAccessAnalytics') || canAccessRoute(role, 'analytics-intelligence'),
      action: () => navigate('/analytics-intelligence'),
    },
    {
      id: 'staff-access',
      title: 'Phân Quyền',
      icon: '🔑',
      gradient: 'linear-gradient(135deg, #334155, #0f172a)',
      isAllowed: (role) => hasCapability(role, 'canManageStaff') || canAccessRoute(role, 'staff-access'),
      action: () => navigate('/staff-access'),
    },
  ], [navigate]);

  // Strict filtering per actorRole
  const visibleIcons = useMemo(() => {
    return allIcons.filter((item) => item.isAllowed(actorRole));
  }, [allIcons, actorRole]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        paddingBottom: '90px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: '16px 20px 12px 20px',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(0,0,0,0) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
            }}
          >
            👩‍⚕️
          </div>
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: '#34d399',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {roleLabel}
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.2,
              }}
            >
              {actorName}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.18)',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#6ee7b7',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#34d399',
            }}
          />
          <span>Tâm An Care</span>
        </div>
      </div>

      {/* Main iPhone 4-Column Squircle App Grid (GUARANTEED PERFECT GRID DISPLAY) */}
      <div
        style={{
          flex: 1,
          padding: '8px 16px 24px 16px',
          maxWidth: '430px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '22px 14px',
            alignItems: 'start',
          }}
        >
          {visibleIcons.map((app) => (
            <div
              key={app.id}
              onClick={app.action}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {/* iPhone Squircle App Icon Frame (60px x 60px) */}
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
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxSizing: 'border-box',
                }}
              >
                <span>{app.icon}</span>

                {/* Red Circular iOS Badge */}
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
                      border: '2px solid #000000',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                      lineHeight: 1,
                    }}
                  >
                    {app.badge}
                  </span>
                )}
              </div>

              {/* Title Label Under Icon */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#f8fafc',
                  marginTop: '6px',
                  lineHeight: 1.25,
                  textAlign: 'center',
                  wordBreak: 'break-word',
                  letterSpacing: '-0.01em',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                {app.title}
              </span>
            </div>
          ))}
        </div>

        {/* Page Dots Indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            marginTop: '32px',
            opacity: 0.6,
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.4)' }} />
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.4)' }} />
        </div>
      </div>

      {/* Bottom Glassmorphism iOS Dock Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '400px',
          backgroundColor: 'rgba(255, 255, 255, 0.22)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '32px',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.6)',
          zIndex: 100,
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveCategory('hygiene')}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            fontSize: '24px',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}
          title="Nhận Ca"
        >
          📞
        </button>

        <button
          type="button"
          onClick={() => navigate('/residents')}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f1f5f9, #ffffff)',
            border: 'none',
            fontSize: '24px',
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          }}
          title="Cư Dân"
        >
          👵
        </button>

        <button
          type="button"
          onClick={() => navigate('/operations')}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
            border: 'none',
            fontSize: '24px',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
          }}
          title="Vận Hành"
        >
          🧭
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('voice')}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            border: 'none',
            fontSize: '24px',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
          }}
          title="Voice AI"
        >
          🎙️
        </button>
      </div>

      {/* 1-Tap Action Sheet Modal */}
      <OneTapActionSheet
        category={activeCategory}
        onClose={() => setActiveCategory(null)}
        actorName={actorName}
      />
    </div>
  );
}
