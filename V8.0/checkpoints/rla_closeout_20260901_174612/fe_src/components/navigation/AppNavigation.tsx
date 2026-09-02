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
    key: 'residents',
    to: '/residents',
    label: 'Người cao tuổi',
  },
  {
    key: 'operations',
    to: '/operations',
    label: 'Vận hành',
  },
  {
    key: 'admissions',
    to: '/admissions',
    label: 'Tiếp nhận & đánh giá',
  },
  {
    key: 'resident-leave',
    to: '/resident-leave',
    label: 'Nghỉ phép & Tạm vắng',
  },
  {
    key: 'health-reports',
    to: '/health-reports',
    label: 'Báo cáo sức khỏe',
  },
  {
    key: 'staff-access',
    to: '/staff-access',
    label: 'Nhân sự & phân quyền',
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
        <a href="/accommodation">Phòng &amp; Giường</a>
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
