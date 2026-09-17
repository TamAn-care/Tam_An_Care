import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useActor } from '../../auth/ActorContext';
import { canAccessRoute, ROLE_LABELS, type AppRouteKey } from '../../auth/role-policy';

export interface NavItem {
  key: AppRouteKey;
  to: string;
  label: string;
  icon: string;
  category: string;
  gradient: string;
  badge?: string;
  badgeBg?: string;
}

export const CATEGORY_ICONS: Record<string, string> = {
  'Lâm Sàng & Chăm Sóc': '🩺',
  'Dược Phẩm & Ca Trực': '💊',
  'Tài Chính & Thân Nhân': '💳',
  'Quản Trị & Hệ Thống': '🛡️',
};

export const MODULE_NAV_ITEMS: NavItem[] = [
  // --- 1. LÂM SÀNG & CHĂM SÓC DIRECT CARE ---
  {
    key: 'dashboard',
    to: '/dashboard',
    label: 'Tổng Quan',
    icon: '📊',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  },
  {
    key: 'health-reports',
    to: '/health-reports',
    label: 'Báo Cáo Định Kỳ',
    icon: '📄',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
    badge: 'Gửi Gia Đình',
    badgeBg: '#0284c7',
  },
  {
    key: 'admissions',
    to: '/admissions',
    label: 'Tiếp Nhận & Đánh Giá',
    icon: '📋',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #0891b2, #0e7490)',
  },
  {
    key: 'accommodation',
    to: '/accommodation',
    label: 'Sơ Đồ Phòng Giường',
    icon: '🛏️',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #0369a1, #075985)',
    badge: '110 G',
    badgeBg: '#0284c7',
  },
  {
    key: 'residents',
    to: '/residents',
    label: 'Hồ Sơ Cư Dân',
    icon: '👵',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    badge: '110 Cụ',
    badgeBg: '#059669',
  },
  {
    key: 'resident-lifecycle',
    to: '/resident-lifecycle',
    label: 'Vòng Đời & Xuất Viện',
    icon: '🔄',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #0d9488, #0f766e)',
  },
  {
    key: 'operations',
    to: '/operations',
    label: 'Chăm Sóc & Vận Hành',
    icon: '🩺',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #059669, #047857)',
  },

  // --- 2. DƯỢC PHẨM, DINH DƯỠNG & CA TRỰC ---
  {
    key: 'medication-inventory',
    to: '/medication-inventory',
    label: 'Dược Phẩm eMAR',
    icon: '💊',
    category: 'Dược Phẩm & Ca Trực',
    gradient: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    badge: 'eMAR',
    badgeBg: '#2563eb',
  },
  {
    key: 'kitchen-operations',
    to: '/kitchen-operations',
    label: 'Bếp Dinh Dưỡng',
    icon: '🍳',
    category: 'Dược Phẩm & Ca Trực',
    gradient: 'linear-gradient(135deg, #ea580c, #c2410c)',
  },
  {
    key: 'workforce',
    to: '/workforce',
    label: 'Lịch Trực Ca Kíp',
    icon: '📅',
    category: 'Dược Phẩm & Ca Trực',
    gradient: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
  },

  // --- 3. HÀNH CHÍNH, TÀI CHÍNH & THÂN NHÂN ---
  {
    key: 'family-portal',
    to: '/family-portal',
    label: 'Cổng Thân Nhân',
    icon: '👨‍👩‍👧',
    category: 'Tài Chính & Thân Nhân',
    gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
  },
  {
    key: 'billing-invoicing',
    to: '/billing-invoicing',
    label: 'Viện Phí & Kế Toán',
    icon: '💳',
    category: 'Tài Chính & Thân Nhân',
    gradient: 'linear-gradient(135deg, #10b981, #047857)',
  },
  {
    key: 'resident-leave',
    to: '/resident-leave',
    label: 'Nghỉ Phép & Tạm Vắng',
    icon: '✈️',
    category: 'Tài Chính & Thân Nhân',
    gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
    badge: 'RLA-BR-01',
    badgeBg: '#d97706',
  },
  {
    key: 'service-contracts',
    to: '/service-contracts',
    label: 'Hợp Đồng Dịch Vụ',
    icon: '📜',
    category: 'Tài Chính & Thân Nhân',
    gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
  },

  // --- 4. QUẢN TRỊ, BẢO MẬT & HỆ THỐNG ---
  {
    key: 'staff-access',
    to: '/staff-access',
    label: 'Giám Sát Phân Công',
    icon: '🛡️',
    category: 'Quản Trị & Hệ Thống',
    gradient: 'linear-gradient(135deg, #334155, #0f172a)',
    badge: 'RBAC',
    badgeBg: '#334155',
  },
  {
    key: 'analytics-intelligence',
    to: '/analytics-intelligence',
    label: 'Phân Tích KPI BI',
    icon: '🧠',
    category: 'Quản Trị & Hệ Thống',
    gradient: 'linear-gradient(135deg, #1e40af, #1e3a8a)',
  },
  {
    key: 'audit-trail',
    to: '/audit-trail',
    label: 'Nhật Ký Truy Vết',
    icon: '🔍',
    category: 'Quản Trị & Hệ Thống',
    gradient: 'linear-gradient(135deg, #475569, #334155)',
  },
  {
    key: 'system-status',
    to: '/system-status',
    label: 'Trạng Thái System',
    icon: '⚡',
    category: 'Quản Trị & Hệ Thống',
    gradient: 'linear-gradient(135deg, #0f172a, #020617)',
  },
];

interface ModuleLauncherGridProps {
  onOpenInstallModal?: () => void;
}

export function ModuleLauncherGrid({ onOpenInstallModal }: ModuleLauncherGridProps) {
  const { actor } = useActor();
  const navigate = useNavigate();

  const roleLabel = (actor?.actorRole && ROLE_LABELS[actor.actorRole]) || 'Nhân viên hệ thống';
  const roleName = actor?.displayName || actor?.actorId || 'Thành viên';

  const visibleItems = actor
    ? MODULE_NAV_ITEMS.filter((item) => canAccessRoute(actor.actorRole, item.key))
    : MODULE_NAV_ITEMS;

  // Group items by Category
  const categories = Array.from(new Set(visibleItems.map((item) => item.category)));

  return (
    <div
      className="module-launcher-container"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        background: '#ffffff',
        borderRadius: '1.25rem',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* Launcher Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#e2f4ea',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              boxShadow: '0 2px 6px rgba(22, 101, 52, 0.12)',
              flexShrink: 0,
            }}
          >
            🎛️
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
              Danh Mục Phân Hệ Nghiệp Vụ
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
              Giao diện làm việc cho: <b style={{ color: '#166534' }}>{roleName}</b> • {roleLabel} ({visibleItems.length} phân hệ)
            </div>
          </div>
        </div>

        {onOpenInstallModal && (
          <button
            type="button"
            onClick={onOpenInstallModal}
            style={{
              background: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 700,
              border: '1px solid #bae6fd',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📱</span> Cài Đặt PWA App
          </button>
        )}
      </div>

      {categories.map((cat) => {
        const catItems = visibleItems.filter((item) => item.category === cat);
        const catIcon = CATEGORY_ICONS[cat] || '📌';

        return (
          <div
            key={cat}
            style={{
              marginBottom: '1.5rem',
              background: '#f8fafc',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
            }}
          >
            {/* Category Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.15rem',
                paddingBottom: '0.65rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#166534',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{catIcon}</span>
                <span>{cat}</span>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#475569',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}
              >
                {catItems.length} phân hệ
              </span>
            </div>

            {/* SQUIRCLE MATRIX ICON GRID */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
                gap: '1.5rem 1rem',
                alignItems: 'start',
              }}
            >
              {catItems.map((item) => (
                <div
                  key={item.to}
                  onClick={() => {
                    navigate(item.to);
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'center',
                    padding: '0.4rem 0.25rem',
                    borderRadius: '12px',
                    transition: 'background-color 0.18s ease',
                    maxWidth: '128px',
                    margin: '0 auto',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* SQUIRCLE ICON CONTAINER */}
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '20px',
                      background: item.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      color: '#ffffff',
                      position: 'relative',
                      boxShadow:
                        '0 8px 20px -3px rgba(0, 0, 0, 0.16), 0 3px 6px -1px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.06)';
                      e.currentTarget.style.boxShadow =
                        '0 14px 28px -4px rgba(0, 0, 0, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow =
                        '0 8px 20px -3px rgba(0, 0, 0, 0.16), 0 3px 6px -1px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.35)';
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.06)';
                    }}
                  >
                    <span>{item.icon}</span>

                    {item.badge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-6px',
                          backgroundColor: item.badgeBg || '#ef4444',
                          color: '#ffffff',
                          fontSize: '9.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                          border: '1.5px solid #ffffff',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {/* ICON LABEL */}
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginTop: '0.6rem',
                      lineHeight: 1.25,
                      maxWidth: '112px',
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AppNavigation() {
  return null;
}

