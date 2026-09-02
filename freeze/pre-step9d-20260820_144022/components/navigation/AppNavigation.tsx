import {
  NavLink,
} from 'react-router-dom';

import {
  useActor,
} from '../../auth/ActorContext';

const commonItems = [
  {
    to: '/dashboard',
    label: 'Tổng quan',
  },
  {
    to: '/residents',
    label: 'Người cao tuổi',
  },
  {
    to: '/system-status',
    label: 'Trạng thái hệ thống',
  },
];

export function AppNavigation() {
  const { actor } = useActor();

  const items = [
    ...commonItems,
    ...(actor?.actorRole === 'SUPERVISOR'
      ? [
          {
            to: '/staff-access',
            label:
              'Nhân sự & phân quyền',
          },
        ]
      : []),
  ];

  return (
    <nav
      className="navigation"
      aria-label="Điều hướng chính"
    >
      {items.map((item) => (
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
