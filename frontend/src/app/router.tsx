import { lazy, Suspense } from 'react';
import { OperationsPage } from '../features/operations/OperationsPage';
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
  RequireRole,
} from '../auth/RequireRole';

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

const AccommodationPage = lazy(() => import('../features/accommodation/AccommodationPage'));

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
              <RequireRole route="dashboard">
                <DashboardPage />
              </RequireRole>
            </RequireActor>
          ),
        },
        {
          path: '/residents',
          element: (
            <RequireActor>
              <RequireRole route="residents">
                <ResidentsPage />
              </RequireRole>
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
          element: (
            <RequireActor>
              <RequireRole route="admissions">
                <AdmissionPage />
              </RequireRole>
            </RequireActor>
          ),
        },
        {
          path: '/health-reports',
          element: (
            <RequireActor>
              <RequireRole route="health-reports">
                <HealthReportsPage />
              </RequireRole>
            </RequireActor>
          ),
        },
        {
          path: '/staff-access',
          element: (
            <RequireActor>
              <RequireRole route="staff-access">
                <StaffAccessPage />
              </RequireRole>
            </RequireActor>
          ),
        },
        {
          path: '/system-status',
          element:
            <SystemStatusPage />,
        },
        {
          path: "/resident-lifecycle",
          lazy: async () => {
            const module = await import("../features/resident-lifecycle/ResidentLifecyclePage");
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="resident-lifecycle">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: "/resident-leave",
          lazy: async () => {
            const module = await import("../features/resident-leave/ResidentLeavePage");
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="resident-leave">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: "/workforce",
          lazy: async () => {
            const module = await import("../features/workforce/WorkforcePage");
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="workforce">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: '/accommodation',
          element: (
            <RequireActor>
              <RequireRole route="accommodation">
                <Suspense fallback={<div>Đang tải Phòng & Giường…</div>}>
                  <AccommodationPage />
                </Suspense>
              </RequireRole>
            </RequireActor>
          ),
        },
        {
          path: '/operations',
          element: (
            <RequireActor>
              <RequireRole route="operations">
                <OperationsPage />
              </RequireRole>
            </RequireActor>
          ),
        },
        {
          path: '/family-portal',
          lazy: async () => {
            const module = await import('../features/family-portal/FamilyPortalPage');
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="family-portal">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: '/medication-inventory',
          lazy: async () => {
            const module = await import('../features/medication-inventory/MedicationInventoryPage');
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="medication-inventory">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: '/kitchen-operations',
          lazy: async () => {
            const module = await import('../features/kitchen/KitchenOperationsPage');
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="kitchen-operations">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: '/billing-invoicing',
          lazy: async () => {
            const module = await import('../features/billing/BillingPage');
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="billing-invoicing">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: '/analytics-intelligence',
          lazy: async () => {
            const module = await import('../features/analytics/AnalyticsPage');
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="analytics-intelligence">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
        {
          path: '/audit-trail',
          lazy: async () => {
            const module = await import('../features/audit-trail/AuditTrailPage');
            const Component = module.default;
            return {
              Component: () => (
                <RequireActor>
                  <RequireRole route="audit-trail">
                    <Component />
                  </RequireRole>
                </RequireActor>
              ),
            };
          },
        },
      ],
    },
]);
