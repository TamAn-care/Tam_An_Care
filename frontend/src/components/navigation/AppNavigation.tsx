import {
  NavLink,
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
    label: 'Vận hành chăm sóc',
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

export function AppNavigation() {
  const { actor } = useActor();

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

  return (
    <nav
      className="navigation"
      aria-label="Điều hướng chính"
    >
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            isActive
              ? 'nav-link active'
              : 'nav-link'
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
