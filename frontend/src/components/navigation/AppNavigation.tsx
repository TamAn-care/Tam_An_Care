import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useActor } from '../../auth/ActorContext';
import { canAccessRoute, type AppRouteKey } from '../../auth/role-policy';

export interface NavItem {
  key: AppRouteKey;
  to: string;
  label: string;
  icon: string;
  category: string;
  gradient: string;
  badge?: string;
}

export const MODULE_NAV_ITEMS: NavItem[] = [
  // --- 1. LÂM SÀNG & CHĂM SÓC DIRECT CARE ---
  {
    key: 'dashboard',
    to: '/dashboard',
    label: 'Tổng Quan Icons',
    icon: '📊',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #4f46e5, #3730a3)',
  },
  {
    key: 'health-reports',
    to: '/health-reports',
    label: 'Phê Duyệt & Chú Ý',
    icon: '🚨',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #dc2626, #991b1b)',
    badge: 'Cần Duyệt',
  },
  {
    key: 'admissions',
    to: '/admissions',
    label: 'Tiếp Nhận & Đánh Giá',
    icon: '📋',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
  },
  {
    key: 'accommodation',
    to: '/accommodation',
    label: 'Sơ Đồ Phòng Giường',
    icon: '🛏️',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #0369a1, #075985)',
    badge: '110 G',
  },
  {
    key: 'residents',
    to: '/residents',
    label: 'Hồ Sơ Cư Dân',
    icon: '👵',
    category: 'Lâm Sàng & Chăm Sóc',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    badge: '110 Cụ',
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
        borderRadius: '1rem',
        border: '1px solid #e2e8f0',
        padding: '1.25rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '0.85rem',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>📱</span> Danh Mục Phân Hệ Nghiệp Vụ Tâm An Care
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Hệ thống 17 phân hệ quản trị viện dưỡng lão — Chạm icon để truy cập ứng dụng
          </p>
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
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <span>📱</span> Cài Đặt PWA App
          </button>
        )}
      </div>

      {categories.map((cat) => {
        const catItems = visibleItems.filter((item) => item.category === cat);
        return (
          <div key={cat} style={{ marginBottom: '1.75rem' }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#166534',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#166534',
                }}
              />
              {cat} ({catItems.length})
            </div>

            {/* SQUIRCLE MATRIX ICON GRID */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
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
                    padding: '0.2rem',
                  }}
                >
                  {/* SQUIRCLE ICON CONTAINER */}
                  <div
                    style={{
                      width: '62px',
                      height: '62px',
                      borderRadius: '18px',
                      background: item.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '30px',
                      color: '#ffffff',
                      position: 'relative',
                      boxShadow: '0 8px 18px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      boxSizing: 'border-box',
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.18)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 8px 18px rgba(0, 0, 0, 0.12)';
                    }}
                  >
                    <span>{item.icon}</span>

                    {item.badge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-8px',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          fontSize: '9px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                          border: '1.5px solid #ffffff',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {/* ICON LABEL */}
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      marginTop: '0.55rem',
                      lineHeight: 1.25,
                      maxWidth: '90px',
                      wordBreak: 'break-word',
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
