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
}

const items: NavItem[] = [
  {
    key: 'dashboard',
    to: '/dashboard',
    label: 'Tổng quan',
  },
  {
    key: 'admissions',
    to: '/admissions',
    label: 'Tiếp nhận & Đánh giá',
  },
  {
    key: 'accommodation',
    to: '/accommodation',
    label: 'Sơ đồ Phòng & Giường',
  },
  {
    key: 'residents',
    to: '/residents',
    label: 'Người cao tuổi',
  },
  {
    key: 'operations',
    to: '/operations',
    label: 'Chăm sóc & Vận hành',
  },
  {
    key: 'staff-access',
    to: '/staff-access',
    label: 'Nhân sự & Phân quyền',
  },
  {
    key: 'resident-leave',
    to: '/resident-leave',
    label: 'Nghỉ phép & Tạm vắng',
  },
  {
    key: 'health-reports',
    to: '/health-reports',
    label: 'Báo cáo sức khoẻ',
  },
  {
    key: 'workforce',
    to: '/workforce',
    label: 'Lịch trực & Ca kíp',
  },
  {
    key: 'family-portal',
    to: '/family-portal',
    label: 'Cổng thân nhân',
  },
  {
    key: 'medication-inventory',
    to: '/medication-inventory',
    label: 'Dược phẩm & Vật tư',
  },
  {
    key: 'kitchen-operations',
    to: '/kitchen-operations',
    label: 'Bếp ăn & Dinh dưỡng',
  },
  {
    key: 'billing-invoicing',
    to: '/billing-invoicing',
    label: 'Quản lý Phí & Kế toán',
  },
  {
    key: 'analytics-intelligence',
    to: '/analytics-intelligence',
    label: 'Phân tích & Quản trị',
  },
  {
    key: 'audit-trail',
    to: '/audit-trail',
    label: 'Nhật ký truy vết & Kiểm toán',
  },
  {
    key: 'system-status',
    to: '/system-status',
    label: 'Trạng thái hệ thống',
  },
];

interface AppNavigationProps {
  onNavItemClick?: () => void;
}

export function AppNavigation({ onNavItemClick }: AppNavigationProps = {}) {
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
      : items.filter(
          (item) =>
            item.key ===
            'system-status',
        );

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
      className="navigation"
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
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

