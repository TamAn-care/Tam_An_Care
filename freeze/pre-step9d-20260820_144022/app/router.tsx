import {
  createBrowserRouter,
  Navigate,
} from 'react-router-dom';

import {
  AppShell,
} from '../components/layout/AppShell';

import {
  DashboardPage,
} from '../features/dashboard/DashboardPage';

import {
  ResidentsPage,
} from '../features/residents/ResidentsPage';

import {
  CareViewPage,
} from '../features/care-view/CareViewPage';

import {
  StaffAccessPage,
} from '../features/staff-access/StaffAccessPage';

import {
  SystemStatusPage,
} from '../features/system-status/SystemStatusPage';

export const router =
  createBrowserRouter([
    {
      element: <AppShell />,
      children: [
        {
          path: '/',
          element: (
            <Navigate
              to="/dashboard"
              replace
            />
          ),
        },
        {
          path: '/dashboard',
          element: <DashboardPage />,
        },
        {
          path: '/residents',
          element: <ResidentsPage />,
        },
        {
          path:
            '/residents/:residentId',
          element: <CareViewPage />,
        },
        {
          path:
            '/residents/:residentId/care',
          element: <CareViewPage />,
        },
        {
          path: '/staff-access',
          element: <StaffAccessPage />,
        },
        {
          path: '/system-status',
          element: <SystemStatusPage />,
        },
      ],
    },
  ]);
