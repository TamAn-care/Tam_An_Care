import {
  useState,
} from 'react';

import {
  Outlet,
  useLocation,
} from 'react-router-dom';

import {
  AppNavigation,
} from '../navigation/AppNavigation';

import {
  MobileNavigationButton,
} from '../navigation/MobileNavigationButton';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  ROLE_LABELS,
} from '../../auth/role-policy';

import {
  ConnectivityStatus,
} from '../feedback/ConnectivityStatus';

import {
  PAGE_META,
} from '../../app/page-meta';

export function AppShell() {
  const {
    actor,
    isDevelopmentBootstrap,
    clearActor,
  } = useActor();

  const location = useLocation();

  const [menuOpen, setMenuOpen] =
    useState(false);

  const meta =
    PAGE_META[location.pathname];

  return (
    <div className="app-shell">
      <aside
        id="application-sidebar"
        className={
          menuOpen
            ? 'sidebar sidebar-open'
            : 'sidebar'
        }
      >
        <div className="brand">
          <div className="brand-mark">
            <img
              src="/branding/tam-an-logo-master.png"
              alt="Tâm An"
              className="brand-logo"
            />
          </div>

          <div>
            <h1 className="brand-title">
              Tâm An Care
            </h1>

            <div className="brand-subtitle">
              Chăm sóc vận hành
            </div>
          </div>
        </div>

        <AppNavigation />

        <div className="sidebar-footer">
          <span className="version-text">
            V7.5 Development
          </span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-start">
            <MobileNavigationButton
              open={menuOpen}
              onToggle={() =>
                setMenuOpen(
                  (value) => !value,
                )
              }
            />

            <div>
              <div className="topbar-title">
                {meta?.title ??
                  'Tâm An Care'}
              </div>

              {meta?.description && (
                <div className="topbar-subtitle">
                  {meta.description}
                </div>
              )}
            </div>
          </div>

          <div className="topbar-end">
            <ConnectivityStatus />

            <div className="actor-panel">
              {isDevelopmentBootstrap && (
                <span className="development-badge">
                  DEVELOPMENT
                </span>
              )}

              <div className="actor-summary">
                <span className="actor-label">
                  Người dùng
                </span>

                <span className="actor-value">
                  {actor
                    ? actor.displayName ||
                      actor.actorId
                    : 'Chưa xác định'}
                </span>

                {actor && (
                  <span className="actor-role">
                    {
                      ROLE_LABELS[
                        actor.actorRole
                      ]
                    }
                  </span>
                )}
              </div>

              {actor && (
                <button
                  type="button"
                  className="button button-subtle"
                  onClick={clearActor}
                >
                  Đổi người dùng
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
