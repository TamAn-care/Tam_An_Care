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

  // Master List of iOS App Icons mapped to exact Role Capabilities
  const allIcons: AppIconItem[] = useMemo(() => [
    // 1. NHÓM CHĂM SÓC & TÂM LÝ
    {
      id: 'emotions',
      title: 'Đánh Giá Tâm Lý',
      icon: '😀',
      gradient: 'from-amber-400 to-orange-500',
      badge: 'MỚI',
      badgeBg: 'bg-amber-500 text-amber-950 font-black',
      isAllowed: (role) => hasCapability(role, 'canEvaluatePsychology') || role === 'CAREGIVER' || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('health'),
    },
    {
      id: 'residents',
      title: 'Hồ Sơ Cư Dân',
      icon: '👵',
      gradient: 'from-emerald-500 to-teal-600',
      badge: 15,
      isAllowed: (role) => canAccessRoute(role, 'residents'),
      action: () => navigate('/residents'),
    },
    {
      id: 'hygiene',
      title: 'Tắm & Vệ Sinh',
      icon: '🚿',
      gradient: 'from-cyan-500 to-blue-600',
      isAllowed: (role) => hasCapability(role, 'canLogDirectCare') || role === 'CAREGIVER' || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('hygiene'),
    },
    {
      id: 'meals',
      title: 'Bữa Ăn',
      icon: '🥣',
      gradient: 'from-amber-500 to-red-500',
      badge: 'SÁNG',
      badgeBg: 'bg-amber-300 text-amber-950 font-bold',
      isAllowed: (role) => hasCapability(role, 'canLogDirectCare') || role === 'CAREGIVER' || role === 'NUTRITIONIST' || role === 'SUPERVISOR' || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('meals'),
    },
    {
      id: 'voice',
      title: 'Ghi Âm AI',
      icon: '🎙️',
      gradient: 'from-purple-600 to-violet-700',
      badge: 'AI',
      badgeBg: 'bg-purple-300 text-purple-950 font-extrabold',
      isAllowed: () => true, // Tất cả nhân viên đều dùng được thu âm giọng nói
      action: () => setActiveCategory('voice'),
    },

    // 2. NHÓM Y TẾ & DƯỢC PHẨM (ĐỘC QUYỀN Y TẾ / ĐIỀU DƯỠNG)
    {
      id: 'meds',
      title: 'Uống Thuốc',
      icon: '💊',
      gradient: 'from-blue-600 to-indigo-700',
      badge: 3,
      isAllowed: (role) => hasCapability(role, 'canAdministerMedication') || hasCapability(role, 'canPrescribeMedication') || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('meds'),
    },
    {
      id: 'vitals',
      title: 'Đo Sinh Hiệu',
      icon: '🩺',
      gradient: 'from-rose-500 to-red-600',
      badge: 2,
      isAllowed: (role) => hasCapability(role, 'canCreateHealthReport') || hasCapability(role, 'canAdministerMedication') || role === 'ADMIN' || role === 'CARE_MANAGER',
      action: () => setActiveCategory('vitals'),
    },
    {
      id: 'health-reports',
      title: 'Báo Cáo Y Tế',
      icon: '📊',
      gradient: 'from-sky-500 to-blue-700',
      isAllowed: (role) => canAccessRoute(role, 'health-reports'),
      action: () => navigate('/health-reports'),
    },
    {
      id: 'pharmacy',
      title: 'Kho Dược eMAR',
      icon: '💉',
      gradient: 'from-indigo-600 to-purple-800',
      isAllowed: (role) => hasCapability(role, 'canManagePharmacy') || canAccessRoute(role, 'medication-inventory'),
      action: () => navigate('/medication-inventory'),
    },
    {
      id: 'incident',
      title: 'Báo Sự Cố',
      icon: '🚨',
      gradient: 'from-red-600 to-rose-700',
      isAllowed: () => true, // Tất cả các vai trò đều có quyền phát báo động sự cố
      action: () => setActiveCategory('incident'),
    },

    // 3. NHÓM VẬN HÀNH & NGHỈ PHÉP
    {
      id: 'workforce',
      title: 'Lịch Trực Ca',
      icon: '📅',
      gradient: 'from-violet-600 to-indigo-800',
      isAllowed: (role) => canAccessRoute(role, 'workforce'),
      action: () => navigate('/workforce'),
    },
    {
      id: 'leave',
      title: 'Xin Nghỉ Phép',
      icon: '🏖️',
      gradient: 'from-amber-400 to-yellow-600',
      isAllowed: (role) => canAccessRoute(role, 'resident-leave'),
      action: () => navigate('/resident-leave'),
    },
    {
      id: 'accommodation',
      title: 'Sơ Đồ Phòng',
      icon: '🛌',
      gradient: 'from-blue-600 to-slate-700',
      isAllowed: (role) => canAccessRoute(role, 'accommodation'),
      action: () => navigate('/accommodation'),
    },
    {
      id: 'admissions',
      title: 'Tiếp Nhận Mới',
      icon: '📝',
      gradient: 'from-emerald-600 to-teal-700',
      isAllowed: (role) => canAccessRoute(role, 'admissions'),
      action: () => navigate('/admissions'),
    },

    // 4. NHÓM DINH DƯỠNG & BẾP
    {
      id: 'kitchen',
      title: 'Bếp Dinh Dưỡng',
      icon: '🍳',
      gradient: 'from-orange-500 to-red-600',
      isAllowed: (role) => hasCapability(role, 'canManageKitchenOperations') || canAccessRoute(role, 'kitchen-operations'),
      action: () => navigate('/kitchen-operations'),
    },

    // 5. NHÓM KẾ TOÁN & VIỆN PHÍ
    {
      id: 'billing',
      title: 'Viện Phí',
      icon: '💳',
      gradient: 'from-emerald-500 to-green-700',
      isAllowed: (role) => hasCapability(role, 'canManageBilling') || canAccessRoute(role, 'billing-invoicing'),
      action: () => navigate('/billing-invoicing'),
    },

    // 6. NHÓM THÂN NHÂN & KHÁC
    {
      id: 'family',
      title: 'Thân Nhân',
      icon: '👨‍👩‍👧',
      gradient: 'from-pink-500 to-rose-600',
      isAllowed: (role) => canAccessRoute(role, 'family-portal'),
      action: () => navigate('/family-portal'),
    },
    {
      id: 'analytics',
      title: 'Phân Tích KPI',
      icon: '📈',
      gradient: 'from-indigo-600 to-blue-900',
      isAllowed: (role) => hasCapability(role, 'canAccessAnalytics') || canAccessRoute(role, 'analytics-intelligence'),
      action: () => navigate('/analytics-intelligence'),
    },
    {
      id: 'staff-access',
      title: 'Phân Quyền',
      icon: '🔑',
      gradient: 'from-slate-700 to-slate-900',
      isAllowed: (role) => hasCapability(role, 'canManageStaff') || canAccessRoute(role, 'staff-access'),
      action: () => navigate('/staff-access'),
    },
  ], [navigate]);

  // Filter icons according to logged-in user's role
  const visibleIcons = useMemo(() => {
    return allIcons.filter((item) => item.isAllowed(actorRole));
  }, [allIcons, actorRole]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between font-sans select-none overflow-x-hidden pb-4">
      
      {/* Top Section: User Header */}
      <div className="pt-4 px-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shadow-inner backdrop-blur">
              👩‍⚕️
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">
                {roleLabel}
              </div>
              <div className="text-sm font-extrabold text-white leading-tight">
                {actorName}
              </div>
            </div>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-300 flex items-center gap-1.5 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Tâm An Care</span>
          </div>
        </div>
      </div>

      {/* Main Content: iPhone 4-Column Squircle App Grid (Matching user's screenshot exactly) */}
      <div className="flex-1 px-4 pt-2 pb-6 max-w-md mx-auto w-full">
        <div className="grid grid-cols-4 gap-x-4 gap-y-6">
          {visibleIcons.map((app) => (
            <div
              key={app.id}
              onClick={app.action}
              className="flex flex-col items-center cursor-pointer group"
            >
              {/* iOS Squircle App Icon Container */}
              <div
                className={`w-[60px] h-[60px] rounded-[18px] bg-gradient-to-br ${app.gradient} text-white flex items-center justify-center text-3xl shadow-lg border border-white/25 relative active:scale-85 transition-all duration-150 group-hover:scale-105`}
              >
                <span>{app.icon}</span>

                {/* iOS Style Red Badge */}
                {app.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-black shadow-md ${
                      app.badgeBg || 'bg-red-500'
                    }`}
                  >
                    {app.badge}
                  </span>
                )}
              </div>

              {/* iOS Clean Title Label Under Icon */}
              <span className="text-[11px] font-medium text-slate-100 text-center leading-tight tracking-tight mt-1.5 drop-shadow-sm opacity-95 group-hover:text-emerald-400">
                {app.title}
              </span>
            </div>
          ))}
        </div>

        {/* Page Indicator Dots */}
        <div className="flex justify-center items-center space-x-1.5 mt-8 opacity-60">
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
        </div>
      </div>

      {/* Bottom iOS Glassmorphism Dock Frame (Matching iPhone Dock in image 2) */}
      <div className="max-w-md mx-auto w-full px-4 mb-2">
        <div className="bg-white/20 backdrop-blur-2xl rounded-[32px] p-2.5 flex justify-around items-center border border-white/20 shadow-2xl">
          
          <button
            type="button"
            onClick={() => setActiveCategory('hygiene')}
            className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-emerald-500 to-green-600 text-white text-2xl flex items-center justify-center shadow-md active:scale-90 transition"
            title="Nhận Ca & Chăm Sóc"
          >
            📞
          </button>

          <button
            type="button"
            onClick={() => navigate('/residents')}
            className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-slate-200 to-white text-slate-800 text-2xl flex items-center justify-center shadow-md active:scale-90 transition"
            title="Danh Sách Cư Dân"
          >
            👵
          </button>

          <button
            type="button"
            onClick={() => navigate('/operations')}
            className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-sky-400 to-blue-600 text-white text-2xl flex items-center justify-center shadow-md active:scale-90 transition"
            title="Vận Hành Chuyên Môn"
          >
            🧭
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('voice')}
            className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-amber-400 to-orange-500 text-white text-2xl flex items-center justify-center shadow-md active:scale-90 transition"
            title="Ghi Âm AI Voice"
          >
            🎙️
          </button>

        </div>
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
