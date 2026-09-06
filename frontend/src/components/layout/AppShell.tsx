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
import { TesterPortalModal } from '../testing/TesterPortalModal';
import { MobileBottomNav } from '../navigation/MobileBottomNav';
import { IOSPWAInstallBanner } from '../pwa/IOSPWAInstallBanner';

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

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showTesterModal, setShowTesterModal] = useState(false);

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

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
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
    <div className="app-shell">
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
            : 'sidebar'
        }
      >
        <div className="brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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
                Nơi Tuổi Già An Nhiên
              </div>
            </div>
          </div>
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

        <AppNavigation onNavItemClick={() => setMenuOpen(false)} />

        <div className="sidebar-footer">
          <span className="version-text">
            V7.5 Development
          </span>
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
            <NotificationBell />
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
                <div className="topbar-action-group" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowTesterModal(true)}
                    style={{
                      background: '#fef3c7',
                      border: '1px solid #fde047',
                      color: '#854d0e',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.35rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    }}
                    title="Mở Bảng Điều Khiển Chạy Thử Nghiệm Multi-Role Dành Cho Testers"
                  >
                    <span>🧪</span> Chế Độ Tester
                  </button>

                  <button
                    type="button"
                    onClick={handleInstallApp}
                    style={{
                      background: '#e0f2fe',
                      border: '1px solid #7dd3fc',
                      color: '#0369a1',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.35rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                    title="Cài đặt ứng dụng Tâm An Care dạng PWA"
                  >
                    <span>📱</span> Cài Đặt App
                  </button>

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
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      color: '#166534',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.35rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <span>🔑</span> Đổi Mật Khẩu
                  </button>

                  {/* ONLY ADMIN CAN SEE ROLE SWITCHER TOGGLE BUTTON */}
                  {actor?.actorRole === 'ADMIN' ? (
                    <button
                      type="button"
                      className="button button-subtle"
                      onClick={() => setShowTopLogin((prev) => !prev)}
                      style={{
                        background: showTopLogin ? '#166534' : '#eff6ff',
                        border: showTopLogin ? '1px solid #14532d' : '1px solid #93c5fd',
                        color: showTopLogin ? '#ffffff' : '#1e40af',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.35rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Chuyển đổi vai trò nhân sự (Dành riêng cho Admin)"
                    >
                      <span>🛡️</span> {showTopLogin ? 'Ẩn Panel Admin' : 'Admin Panel / Switch'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-subtle"
                      onClick={() => clearActor()}
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                        color: '#991b1b',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.35rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span>🚪</span> Đăng Xuất
                    </button>
                  )}
                </div>
              )}
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

      {/* MODAL HƯỚNG DẪN CÀI ĐẶT ỨNG DỤNG (PWA) */}
      {showInstallModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '540px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📱</span> Hướng Dẫn Cài Đặt Ứng Dụng Tâm An Care
              </h2>
              <button onClick={() => setShowInstallModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: '1.6' }}>
              <p style={{ marginTop: 0 }}>Ứng dụng <b>Tâm An Care</b> hỗ trợ cài đặt trực tiếp dạng Progressive Web App (PWA) chạy độc lập trên iPhone, iPad, Android, Mac và máy tính Windows mà không cần qua App Store.</p>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.4rem' }}>🍏 Trên iPhone / iPad (Safari):</div>
                <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>Nhấn vào biểu tượng <b>Chia sẻ (Share ⎋)</b> ở thanh công cụ trình duyệt Safari.</li>
                  <li>Cuộn xuống và chọn <b>"Thêm vào Màn hình chính" (Add to Home Screen ➕)</b>.</li>
                  <li>Nhấn <b>Thêm (Add)</b> để hoàn tất. Icon ứng dụng Tâm An Care sẽ xuất hiện ngoài màn hình ứng dụng.</li>
                </ol>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: '0.4rem' }}>💻 Trên Máy tính macOS / Windows (Chrome / Edge):</div>
                <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>Nhấn vào biểu tượng <b>Cài đặt (Install 📲)</b> ở góc phải thanh địa chỉ URL.</li>
                  <li>Hoặc bấm menu <b>⋮ (3 chấm) &rarr; "Cài đặt ứng dụng Tâm An Care..."</b>.</li>
                </ol>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <button type="button" onClick={() => setShowInstallModal(false)} className="btn btn-primary">Đã hiểu</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHẾ ĐỘ THỬ NGHIỆM MULTI-ROLE CHO TESTERS */}
      <TesterPortalModal
        isOpen={showTesterModal}
        onClose={() => setShowTesterModal(false)}
      />

      {/* FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <MobileBottomNav
        onOpenMenu={() => setMenuOpen(true)}
        onOpenTesterModal={() => setShowTesterModal(true)}
      />
    </div>
  );
}
