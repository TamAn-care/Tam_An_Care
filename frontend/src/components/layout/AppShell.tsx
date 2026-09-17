import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useActor } from '../../auth/ActorContext';
import { DevelopmentActorPanel } from '../../auth/DevelopmentActorPanel';
import { ROLE_LABELS } from '../../auth/role-policy';
import { ConnectivityStatus } from '../feedback/ConnectivityStatus';
import { PAGE_META } from '../../app/page-meta';
import { changeSelfPassword } from '../../api/staff-actors';
import { NotificationBell } from '../notifications/NotificationBell';
import { IOSPWAInstallBanner } from '../pwa/IOSPWAInstallBanner';
import { PWAInstallModal } from '../pwa/PWAInstallModal';

export function AppShell() {
  const { actor, clearActor } = useActor();
  const location = useLocation();
  const navigate = useNavigate();

  const [showTopLogin, setShowTopLogin] = useState(false);

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

  // Auto-scroll to top whenever route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

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

  const isHome = location.pathname === '/' || location.pathname === '/dashboard';
  const meta = PAGE_META[location.pathname];

  return (
    <div className="app-shell-fullwidth" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <IOSPWAInstallBanner />

      {/* TOPBAR HEADER - STANDALONE FULL WIDTH */}
      <header
        className="topbar"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #cbd5e1',
          padding: '0.65rem 1.25rem',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div className="topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flexWrap: 'nowrap' }}>
          {/* Brand Logo & Slogan */}
          <Link
            to="/dashboard"
            className="topbar-brand-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none',
              color: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title="Tâm An Care — Nơi Tuổi Già An Nhiên"
          >
            <img
              src="/branding/tam-an-logo-master.png"
              alt="Tâm An Logo"
              style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }}
            />
            <div className="topbar-brand-text" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <span className="topbar-brand-title" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#166534', letterSpacing: '-0.01em', lineHeight: 1 }}>
                Tâm An Care
              </span>
              <span className="topbar-brand-divider" style={{ color: '#cbd5e1', fontWeight: 300, fontSize: '0.85rem', lineHeight: 1 }}>—</span>
              <span className="topbar-brand-slogan" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', lineHeight: 1 }}>
                Nơi Tuổi Già An Nhiên
              </span>
            </div>
          </Link>

          {/* Vertical Separator */}
          <div className="topbar-brand-divider-vert" style={{ width: '1px', height: '20px', background: '#cbd5e1', flexShrink: 0, margin: '0 0.1rem' }} />

          {/* Return / Back Arrow Icon Button - Youthful Icon Design */}
          <button
            type="button"
            className={`topbar-back-btn ${isHome ? 'is-active' : ''}`}
            onClick={() => {
              navigate('/dashboard');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            title="Quay lại Trang Chủ"
            aria-label="Quay lại Trang Chủ"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: isHome ? '#e2f4ea' : '#f1f5f9',
              color: isHome ? '#166534' : '#475569',
              border: isHome ? '1px solid #86efac' : '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.18s ease-out',
              flexShrink: 0,
              boxShadow: isHome ? '0 2px 6px rgba(22, 101, 52, 0.15)' : 'none',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Module Status Badge - Only Module Name (No 'Phân hệ:' word) */}
          <div
            className={`topbar-module-badge ${isHome ? 'is-home' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: isHome ? '#f0fdf4' : '#ffffff',
              border: isHome ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              borderRadius: '9999px',
              padding: '0.3rem 0.75rem',
              fontSize: 'clamp(0.78rem, 2.2vw, 0.88rem)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isHome ? '#16a34a' : '#2563eb',
                display: 'inline-block',
                flexShrink: 0,
                boxShadow: isHome ? '0 0 0 2px #dcfce7' : '0 0 0 2px #dbeafe',
              }}
            />
            <span
              style={{
                color: '#0f172a',
                fontWeight: 700,
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                lineHeight: 1.25,
              }}
            >
              {meta ? meta.title : 'Bảng Điều Khiển Trung Tâm'}
            </span>
          </div>
        </div>

        <div className="topbar-end" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="actor-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Balanced Block: Bell Notice + 2-line Staff Info */}
            <div
              className="actor-profile-bell-block"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                minHeight: '42px',
              }}
            >
              <NotificationBell />

              <div
                className="actor-summary-2lines"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minWidth: 0,
                  lineHeight: 1.25,
                }}
              >
                <div
                  className="actor-name-line"
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {actor ? actor.displayName || actor.actorId : 'Chưa đăng nhập'}
                </div>
                {actor && (
                  <div
                    className="actor-role-line"
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#166534',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '1px',
                    }}
                  >
                    {ROLE_LABELS[actor.actorRole] || actor.actorRole}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {actor ? (
                <>
                  <button
                    type="button"
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
                      fontSize: '0.74rem',
                      padding: '0.3rem 0.55rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                    title="Đổi mật khẩu tài khoản"
                  >
                    <span>🔑</span> <span className="topbar-btn-text">Đổi Mật Khẩu</span>
                  </button>

                  {actor?.actorRole === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => setShowTopLogin((prev) => !prev)}
                      style={{
                        background: showTopLogin ? '#166534' : '#eff6ff',
                        border: showTopLogin ? '1px solid #14532d' : '1px solid #93c5fd',
                        color: showTopLogin ? '#ffffff' : '#1e40af',
                        fontWeight: 600,
                        fontSize: '0.74rem',
                        padding: '0.3rem 0.55rem',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                      title="Chuyển đổi vai trò nhân sự (Dành riêng cho Admin)"
                    >
                      <span>🛡️</span> <span className="topbar-btn-text">{showTopLogin ? 'Ẩn Admin' : 'Admin Panel'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => clearActor()}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      color: '#991b1b',
                      fontWeight: 600,
                      fontSize: '0.74rem',
                      padding: '0.3rem 0.55rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <span>🚪</span> <span className="topbar-btn-text">Đăng Xuất</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTopLogin(true)}
                  style={{
                    background: '#166534',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    padding: '0.32rem 0.7rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                  }}
                >
                  🔑 Đăng Nhập
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER - FULL WIDTH */}
      <main className="page-content" style={{ flex: 1, padding: '1.25rem', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {actor?.actorRole === 'ADMIN' && showTopLogin && (
          <div style={{ marginBottom: '1.25rem' }}>
            <DevelopmentActorPanel />
          </div>
        )}
        <Outlet />
      </main>

      {/* FOOTER BAR */}
      <footer
        style={{
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: '#64748b',
        }}
      >
        <div>
          <b>Tâm An Care V7.5 Development</b>
        </div>
        <ConnectivityStatus />
      </footer>

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
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="modal-close"
                title="Đóng cửa sổ"
                aria-label="Đóng cửa sổ"
              >
                ✕
              </button>
            </div>

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

      {/* PWA INSTALL MODAL */}
      <PWAInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onPromptTriggered={() => setDeferredPrompt(null)}
      />
    </div>
  );
}
