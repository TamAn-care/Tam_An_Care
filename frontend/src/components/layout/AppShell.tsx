import {
  useState,
  useEffect,
} from 'react';

import {
  Outlet,
  useLocation,
  useNavigate,
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
  DevelopmentActorPanel,
} from '../../auth/DevelopmentActorPanel';

import {
  ROLE_LABELS,
} from '../../auth/role-policy';

import {
  ConnectivityStatus,
} from '../feedback/ConnectivityStatus';

import {
  PAGE_META,
} from '../../app/page-meta';

import {
  changeSelfPassword,
} from '../../api/staff-actors';

import { NotificationBell } from '../notifications/NotificationBell';
import { MobileBottomNav } from '../navigation/MobileBottomNav';
import { IOSPWAInstallBanner } from '../pwa/IOSPWAInstallBanner';
import { PWAInstallModal } from '../pwa/PWAInstallModal';

export function AppShell() {
  const {
    actor,
    isDevelopmentBootstrap,
    clearActor,
  } = useActor();

  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] =
    useState(false);
  const [showTopLogin, setShowTopLogin] = useState(false);

  // Desktop Collapsible Sidebar State with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('taman_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('taman_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Auto-close mobile drawer menu and scroll to top whenever route changes
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  const handleInstallApp = () => {
    setShowInstallModal(true);
  };

  // Self-Service Change Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleSelfPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordFeedback('❌ Xác nhận mật khẩu mới không khớp.');
      return;
    }

    if (newPassword.trim().length < 3) {
      setPasswordFeedback('❌ Mật khẩu mới phải có tối thiểu 3 ký tự.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const result = await changeSelfPassword(actor, currentPassword, newPassword);
      setPasswordFeedback(`✅ ${result.message}`);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordFeedback(null);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err: any) {
      setPasswordFeedback(`❌ ${err.message || 'Lỗi khi đổi mật khẩu'}`);
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const meta =
    PAGE_META[location.pathname];

  return (
    <div className={isSidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <IOSPWAInstallBanner />
      <div
        className={menuOpen ? 'sidebar-backdrop active' : 'sidebar-backdrop'}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="application-sidebar"
        className={
          menuOpen
            ? 'sidebar sidebar-open'
            : isSidebarCollapsed
            ? 'sidebar collapsed'
            : 'sidebar'
        }
      >
        <div className="brand" style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
            <div className="brand-mark" title="Viện Dưỡng Lão Tâm An Care">
              <img
                src="/branding/tam-an-logo-master.png"
                alt="Tâm An"
                className="brand-logo"
              />
            </div>

            {!isSidebarCollapsed && (
              <div className="brand-text">
                <h1 className="brand-title">
                  Tâm An Care
                </h1>

                <div className="brand-subtitle">
                  Nơi Tuổi Già An Nhiên
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="desktop-sidebar-toggle"
              title={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              aria-label={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            >
              {isSidebarCollapsed ? '▶' : '◀'}
            </button>

            {menuOpen && (
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="mobile-sidebar-close"
                aria-label="Đóng menu"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <AppNavigation
          onNavItemClick={() => setMenuOpen(false)}
          onOpenInstallModal={() => setShowInstallModal(true)}
          isCollapsed={isSidebarCollapsed}
        />

        <div
          className="sidebar-footer"
          style={{
            marginTop: 'auto',
            padding: isSidebarCollapsed ? '0.6rem 0.3rem' : '0.75rem 0.85rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            background: '#ffffff',
          }}
        >
          <ConnectivityStatus isCollapsed={isSidebarCollapsed} />

          <div
            style={{
              fontSize: '0.7rem',
              color: '#94a3b8',
              fontWeight: 500,
              textAlign: isSidebarCollapsed ? 'center' : 'left',
              paddingLeft: isSidebarCollapsed ? 0 : '0.2rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isSidebarCollapsed ? 'v7.5 Dev' : 'Tâm An Care V7.5 Development'}
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MobileNavigationButton
              open={menuOpen}
              onToggle={() =>
                setMenuOpen(
                  (value) => !value,
                )
              }
            />

            {/* GLOBAL NAVIGATION CONTROLS: QUAY LẠI & TIẾP TỤC */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => navigate(-1)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.4rem',
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
                title="Quay lại trang hoặc thao tác trước đó"
              >
                <span>◀</span> Quay lại
              </button>

              <button
                type="button"
                onClick={() => navigate(1)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.4rem',
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
                title="Tiếp tục tới trang tiếp theo trong lịch sử"
              >
                <span>Tiếp tục</span> ▶
              </button>
            </div>

            <div>
              <div className="topbar-title">
                {meta?.title ?? 'Tâm An Care'}
              </div>
            </div>
          </div>

          <div className="topbar-end">
            <NotificationBell />

            <div className="actor-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="actor-summary" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', lineHeight: 1.2 }}>
                  <span style={{ fontSize: '0.8rem' }}>👤</span>
                  <span className="actor-value" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                    {actor ? actor.displayName || actor.actorId : 'Chưa đăng nhập'}
                  </span>
                </div>
                {actor && (
                  <span className="actor-role" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#166534', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '0.25rem', padding: '0.05rem 0.35rem', marginTop: '0.15rem', width: 'fit-content' }}>
                    {ROLE_LABELS[actor.actorRole]}
                  </span>
                )}
              </div>

              <div className="topbar-action-group" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {actor ? (
                  <>
                    <button
                      type="button"
                      className="button button-subtle"
                      onClick={() => {
                        setPasswordFeedback(null);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setShowPasswordModal(true);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        height: '32px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <span>🔑</span> Đổi Mật Khẩu
                    </button>

                    {actor?.actorRole === 'ADMIN' && (
                      <button
                        type="button"
                        className="button button-subtle"
                        onClick={() => setShowTopLogin((prev) => !prev)}
                        style={{
                          background: showTopLogin ? '#166534' : '#eff6ff',
                          border: showTopLogin ? '1px solid #14532d' : '1px solid #93c5fd',
                          color: showTopLogin ? '#ffffff' : '#1e40af',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          height: '32px',
                          whiteSpace: 'nowrap',
                        }}
                        title="Chuyển đổi vai trò nhân sự (Dành riêng cho Admin)"
                      >
                        <span>🛡️</span> {showTopLogin ? 'Ẩn Panel Admin' : 'Admin Panel'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="button button-subtle"
                      onClick={() => clearActor()}
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                        color: '#991b1b',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        height: '32px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>🚪</span> Đăng Xuất
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="button button-subtle"
                    onClick={() => setShowTopLogin(true)}
                    style={{
                      background: '#166534',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      height: '32px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>🔑</span> Đăng Nhập
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="page-content">
          {/* ONLY ADMIN CAN TOGGLE OR SEE THE DEVELOPMENT ACTOR PANEL WHEN LOGGED IN */}
          {(actor?.actorRole === 'ADMIN' && showTopLogin) && (
            <div style={{ marginBottom: '1rem' }}>
              <DevelopmentActorPanel />
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* SELF-SERVICE CHANGE PASSWORD MODAL */}
      {showPasswordModal && actor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔑</span> Thay Đổi Mật Khẩu Cá Nhân
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Current user badge */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.84rem' }}>
              <div>Thành viên: <b style={{ color: '#0f172a' }}>{actor.displayName || actor.actorId}</b></div>
              <div>Tên đăng nhập (ID): <b style={{ fontFamily: 'monospace' }}>{actor.actorId}</b></div>
              <div>Vai trò: <b style={{ color: '#166534' }}>{ROLE_LABELS[actor.actorRole] || actor.actorRole}</b></div>
            </div>

            <form onSubmit={handleSelfPasswordSubmit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Mật khẩu hiện tại:
                </label>
                <input
                  type="password"
                  className="text-input"
                  style={{ width: '100%', height: '36px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Mật khẩu mới:
                </label>
                <input
                  type="password"
                  className="text-input"
                  style={{ width: '100%', height: '36px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  required
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Xác nhận lại mật khẩu mới:
                </label>
                <input
                  type="password"
                  className="text-input"
                  style={{ width: '100%', height: '36px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                />
              </div>

              {passwordFeedback && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.35rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: passwordFeedback.includes('❌') ? '#fee2e2' : '#dcfce7',
                    color: passwordFeedback.includes('❌') ? '#b91c1c' : '#15803d',
                  }}
                >
                  {passwordFeedback}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    background: '#166534',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {isSubmittingPassword ? 'Đang lưu...' : '✓ Xác Nhận Đổi Mật Khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CÀI ĐẶT ỨNG DỤNG PWA ĐA NỀN TẢNG */}
      <PWAInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onPromptTriggered={() => setDeferredPrompt(null)}
      />

      {/* FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <MobileBottomNav
        onOpenMenu={() => setMenuOpen(true)}
      />
    </div>
  );
}
