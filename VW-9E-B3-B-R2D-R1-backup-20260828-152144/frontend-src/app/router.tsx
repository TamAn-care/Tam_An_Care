import { AdmissionPage } from '../features/admissions/AdmissionPage';
import HealthReportsPage from '../features/health-reports/HealthReportsPage';

import {
  createBrowserRouter,
  Navigate,
} from 'react-router-dom';

import {
  AppShell,
} from '../components/layout/AppShell';

import {
  RequireActor,
} from '../auth/RequireActor';

import {
  RequireSupervisor,
} from '../auth/RequireSupervisor';

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
          element: (
            <RequireActor>
              <DashboardPage />
            </RequireActor>
          ),
        },
        {
          path: '/residents',
          element: (
            <RequireActor>
              <ResidentsPage />
            </RequireActor>
          ),
        },
        {
          path:
            '/residents/:residentId',
          element: (
            <RequireActor>
              <CareViewPage />
            </RequireActor>
          ),
        },
        {
          path:
            '/residents/:residentId/care',
          element: (
            <RequireActor>
              <CareViewPage />
            </RequireActor>
          ),
        },
        {
          path: '/admissions',
          element: <AdmissionPage />,
        },
        {
          path: '/staff-access',
          element: (
            <RequireActor>
              <RequireSupervisor>
                <StaffAccessPage />
              </RequireSupervisor>
            </RequireActor>
          ),
        },
        {
          path: '/system-status',
          element:
            <SystemStatusPage />,
        },
      ],
    },
  ]);
