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
  description: string;
  color: string;
  badge?: string;
}

export const MODULE_NAV_ITEMS: NavItem[] = [
  // --- 1. LÂM SÀNG & CHĂM SÓC DIRECT CARE ---
  {
    key: 'dashboard',
    to: '/dashboard',
    label: 'Tổng Quan & KPI',
    icon: '📊',
    category: 'Lâm Sàng & Chăm Sóc',
    description: 'Bảng điều hành số liệu y khoa & công suất giường',
    color: '#166534',
  },
  {
    key: 'admissions',
    to: '/admissions',
    label: 'Tiếp Nhận & Đánh Giá',
    icon: '📋',
    category: 'Lâm Sàng & Chăm Sóc',
    description: 'Biểu mẫu tiếp nhận 2 trang & Khảo sát 12 vị trí',
    color: '#0284c7',
  },
  {
    key: 'accommodation',
    to: '/accommodation',
    label: 'Sơ Đồ Phòng & Giường',
    icon: '🛏️',
    category: 'Lâm Sàng & Chăm Sóc',
    description: 'Sơ đồ cơ sở vật chất 29 phòng, 110 giường bệnh',
    color: '#0369a1',
    badge: '110 Giường',
  },
  {
    key: 'residents',
    to: '/residents',
    label: 'Hồ Sơ Cư Dân',
    icon: '👴',
    category: 'Lâm Sàng & Chăm Sóc',
    description: 'Quản lý thông tin & không gian chăm sóc người cao tuổi',
    color: '#15803d',
  },
  {
    key: 'operations',
    to: '/operations',
    label: 'Chăm Sóc & Vận Hành',
    icon: '🩺',
    category: 'Lâm Sàng & Chăm Sóc',
    description: 'Nhật ký công việc ADL & quy chuẩn chăm sóc hàng ngày',
    color: '#059669',
  },
  {
    key: 'health-reports',
    to: '/health-reports',
    label: 'Báo Cáo Sức Khỏe',
    icon: '📈',
    category: 'Lâm Sàng & Chăm Sóc',
    description: 'Báo cáo y khoa 3 trang & Tiêu chuẩn lâm sàng',
    color: '#0891b2',
  },

  // --- 2. DƯỢC PHẨM, DINH DƯỠNG & CA TRỰC ---
  {
    key: 'medication-inventory',
    to: '/medication-inventory',
    label: 'Dược Phẩm & Vật Tư',
    icon: '💊',
    category: 'Dược Phẩm & Ca Trực',
    description: 'Quy tắc eMAR 5 Đúng & Quản lý tồn kho tối thiểu',
    color: '#2563eb',
    badge: 'eMAR',
  },
  {
    key: 'kitchen-operations',
    to: '/kitchen-operations',
    label: 'Bếp Ăn & Dinh Dưỡng',
    icon: '🍱',
    category: 'Dược Phẩm & Ca Trực',
    description: 'Thực đơn dinh dưỡng 3 ca & Tiêu chuẩn suất ăn',
    color: '#d97706',
  },
  {
    key: 'workforce',
    to: '/workforce',
    label: 'Lịch Trực & Ca Kíp',
    icon: '📅',
    category: 'Dược Phẩm & Ca Trực',
    description: 'Phân ca sáng/chiều/đêm & Bàn giao ca trực y khoa',
    color: '#7c3aed',
  },

  // --- 3. HÀNH CHÍNH, TÀI CHÍNH & THÂN NHÂN ---
  {
    key: 'family-portal',
    to: '/family-portal',
    label: 'Cổng Thân Nhân',
    icon: '👨‍👩‍👧',
    category: 'Tài Chính & Thân Nhân',
    description: 'Kết nối gia đình, đăng ký thăm & theo dõi sức khỏe',
    color: '#0284c7',
  },
  {
    key: 'billing-invoicing',
    to: '/billing-invoicing',
    label: 'Viện Phí & Kế Toán',
    icon: '💰',
    category: 'Tài Chính & Thân Nhân',
    description: 'Tính phí trọn gói, giảm trừ tạm vắng & Hóa đơn điện tử',
    color: '#166534',
  },
  {
    key: 'resident-leave',
    to: '/resident-leave',
    label: 'Nghỉ Phép & Tạm Vắng',
    icon: '✈️',
    category: 'Tài Chính & Thân Nhân',
    description: 'Thủ tục RLA-BR-01 & Quy trình Trở lại Tâm An',
    color: '#b45309',
    badge: 'RLA-BR-01',
  },
  {
    key: 'service-contracts',
    to: '/service-contracts',
    label: 'Hợp Đồng Dịch Vụ',
    icon: '📜',
    category: 'Tài Chính & Thân Nhân',
    description: 'Quản lý hợp đồng 3 mức độ chăm sóc & Pháp lý',
    color: '#4f46e5',
  },

  // --- 4. QUẢN TRỊ, BẢO MẬT & HỆ THỐNG ---
  {
    key: 'staff-access',
    to: '/staff-access',
    label: 'Nhân Sự & Phân Quyền',
    icon: '👥',
    category: 'Quản Trị & Hệ Thống',
    description: 'Ma trận phân quyền RBAC 12 vị trí việc làm bảo mật',
    color: '#334155',
  },
  {
    key: 'analytics-intelligence',
    to: '/analytics-intelligence',
    label: 'Phân Tích & Quản Trị',
    icon: '🧠',
    category: 'Quản Trị & Hệ Thống',
    description: '4 trụ cột điều hành vĩ mô & Báo cáo BI thông minh',
    color: '#1e40af',
  },
  {
    key: 'audit-trail',
    to: '/audit-trail',
    label: 'Nhật Ký Truy Vết',
    icon: '🔍',
    category: 'Quản Trị & Hệ Thống',
    description: 'Nhật ký kiểm toán hệ thống & Lưu vết tác động y khoa',
    color: '#475569',
  },
  {
    key: 'system-status',
    to: '/system-status',
    label: 'Trạng Thái Hệ Thống',
    icon: '⚡',
    category: 'Quản Trị & Hệ Thống',
    description: 'Giám sát hạ tầng, API endpoint & Kết nối PWA Offline',
    color: '#0f172a',
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
    <div className="module-launcher-container" style={{ width: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>📱</span> Danh Mục Phân Hệ Nghiệp Vụ Tâm An Care
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
            Hệ thống 17 phân hệ quản trị viện dưỡng lão — Chọn phân hệ để thao tác trực tiếp
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
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
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

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '1rem',
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
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderTop: `3.5px solid ${item.color}`,
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease-in-out',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = item.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.65rem',
                      }}
                    >
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '0.6rem',
                          background: `${item.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem',
                        }}
                      >
                        {item.icon}
                      </div>

                      {item.badge && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: item.color,
                            background: `${item.color}15`,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            border: `1px solid ${item.color}40`,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        margin: '0 0 0.35rem 0',
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        lineHeight: 1.3,
                      }}
                    >
                      {item.label}
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.78rem',
                        color: '#64748b',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>

                  <div
                    style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px dashed #f1f5f9',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: item.color,
                    }}
                  >
                    Truy cập &rarr;
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact Header Quick Launcher dropdown or bar for topbar integration
export function AppNavigation() {
  return null; // Navigation is now integrated into Launcher Grid & Topbar Header
}
