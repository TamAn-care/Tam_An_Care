import {
  useNavigate,
  useLocation,
} from 'react-router-dom';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  canAccessRoute,
  type AppRouteKey,
} from '../../auth/role-policy';

interface NavItem {
  key: AppRouteKey;
  to: string;
  label: string;
  icon: string;
}

const items: NavItem[] = [
  {
    key: 'dashboard',
    to: '/dashboard',
    label: 'Tổng quan',
    icon: '📊',
  },
  {
    key: 'admissions',
    to: '/admissions',
    label: 'Tiếp nhận & Đánh giá',
    icon: '📋',
  },
  {
    key: 'accommodation',
    to: '/accommodation',
    label: 'Sơ đồ Phòng & Giường',
    icon: '🛏️',
  },
  {
    key: 'residents',
    to: '/residents',
    label: 'Người cao tuổi',
    icon: '👴',
  },
  {
    key: 'operations',
    to: '/operations',
    label: 'Chăm sóc & Vận hành',
    icon: '🩺',
  },
  {
    key: 'staff-access',
    to: '/staff-access',
    label: 'Nhân sự & Phân quyền',
    icon: '👥',
  },
  {
    key: 'resident-leave',
    to: '/resident-leave',
    label: 'Nghỉ phép & Tạm vắng',
    icon: '✈️',
  },
  {
    key: 'health-reports',
    to: '/health-reports',
    label: 'Báo cáo sức khoẻ',
    icon: '📈',
  },
  {
    key: 'workforce',
    to: '/workforce',
    label: 'Lịch trực & Ca kíp',
    icon: '📅',
  },
  {
    key: 'family-portal',
    to: '/family-portal',
    label: 'Cổng thân nhân',
    icon: '👨‍👩‍👧',
  },
  {
    key: 'medication-inventory',
    to: '/medication-inventory',
    label: 'Dược phẩm & Vật tư',
    icon: '💊',
  },
  {
    key: 'kitchen-operations',
    to: '/kitchen-operations',
    label: 'Bếp ăn & Dinh dưỡng',
    icon: '🍱',
  },
  {
    key: 'billing-invoicing',
    to: '/billing-invoicing',
    label: 'Quản lý Phí & Kế toán',
    icon: '💰',
  },
  {
    key: 'analytics-intelligence',
    to: '/analytics-intelligence',
    label: 'Phân tích & Quản trị',
    icon: '🧠',
  },
  {
    key: 'audit-trail',
    to: '/audit-trail',
    label: 'Nhật ký truy vết & Kiểm toán',
    icon: '🔍',
  },
  {
    key: 'system-status',
    to: '/system-status',
    label: 'Trạng thái hệ thống',
    icon: '⚡',
  },
];

interface AppNavigationProps {
  onNavItemClick?: () => void;
  onOpenInstallModal?: () => void;
  isCollapsed?: boolean;
}

export function AppNavigation({ onNavItemClick, onOpenInstallModal, isCollapsed = false }: AppNavigationProps = {}) {
  const { actor } = useActor();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems =
    actor
      ? items.filter((item) =>
          canAccessRoute(
            actor.actorRole,
            item.key,
          ),
        )
      : [];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    e.preventDefault();
    if (onNavItemClick) {
      onNavItemClick();
    }
    navigate(to);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  return (
    <nav
      className={isCollapsed ? "navigation nav-collapsed" : "navigation"}
      aria-label="Điều hướng chính"
    >
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.to;
        return (
          <a
            key={item.to}
            href={item.to}
            onClick={(e) => handleNavClick(e, item.to)}
            className={isActive ? 'nav-link active' : 'nav-link'}
            title={isCollapsed ? item.label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '0.65rem 0.4rem' : '0.65rem 0.85rem',
            }}
          >
            <span className="nav-icon" style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
            {!isCollapsed && <span className="nav-link-text">{item.label}</span>}
          </a>
        );
      })}

      {onOpenInstallModal && (
        <button
          type="button"
          onClick={() => {
            if (onNavItemClick) onNavItemClick();
            onOpenInstallModal();
          }}
          className="nav-link"
          title={isCollapsed ? "Cài Đặt App (PWA)" : undefined}
          style={{
            marginTop: '0.5rem',
            background: '#e0f2fe',
            color: '#0369a1',
            fontWeight: 700,
            border: '1px solid #bae6fd',
            borderRadius: '0.4rem',
            padding: isCollapsed ? '0.65rem 0.4rem' : '0.5rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.4rem',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📱</span>
          {!isCollapsed && <span className="nav-link-text">Cài Đặt App (PWA)</span>}
        </button>
      )}
    </nav>
  );
}

