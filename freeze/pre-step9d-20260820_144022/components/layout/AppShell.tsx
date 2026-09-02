import {
  Outlet,
} from 'react-router-dom';

import {
  AppNavigation,
} from '../navigation/AppNavigation';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  ConnectivityStatus,
} from '../feedback/ConnectivityStatus';

export function AppShell() {
  const {
    actor,
    isDevelopmentBootstrap,
  } = useActor();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1 className="brand-title">
            Tâm An Care
          </h1>

          <div className="brand-subtitle">
            V7.5 Development
          </div>
        </div>

        <AppNavigation />
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <ConnectivityStatus />

          <div className="actor-panel">
            {isDevelopmentBootstrap && (
              <span className="development-badge">
                DEVELOPMENT
              </span>
            )}

            <span className="actor-label">
              Người dùng:
            </span>

            <span className="actor-value">
              {actor
                ? `${actor.actorId} · ${actor.actorRole}`
                : 'Chưa xác định'}
            </span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
