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
        <div className="topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
          {/* Brand Logo & Title */}
          <Link
            to="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              textDecoration: 'none',
              color: 'inherit',
            }}
            title="Quay lại Trang Chủ Icons Tâm An Care"
          >
            <img
              src="/branding/tam-an-logo-master.png"
              alt="Tâm An Logo"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#166534', lineHeight: 1.1 }}>
                Tâm An Care
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', lineHeight: 1.1 }}>
                Nơi Tuổi Già An Nhiên
              </span>
            </div>
          </Link>

          {/* Quick Home Icons Launcher Button */}
          <button
            type="button"
            onClick={() => {
              navigate('/dashboard');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            style={{
              background: isHome ? '#166534' : '#f1f5f9',
              color: isHome ? '#ffffff' : '#1e293b',
              border: isHome ? '1px solid #14532d' : '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🏠</span> Trang Chủ Icons
          </button>

          {!isHome && meta && (
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{meta.title}</span>
            </div>
          )}
        </div>

        <div className="topbar-end" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="actor-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <NotificationBell />

            <div className="actor-summary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem' }}>👤</span>
              <span className="actor-value" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                {actor ? actor.displayName || actor.actorId : 'Chưa đăng nhập'}
              </span>
              {actor && (
                <span
                  className="actor-role"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#166534',
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    borderRadius: '9999px',
                    padding: '0.1rem 0.5rem',
                  }}
                >
                  {ROLE_LABELS[actor.actorRole] || actor.actorRole}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
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
                      fontSize: '0.76rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <span>🔑</span> Đổi Mật Khẩu
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
                        fontSize: '0.76rem',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                      title="Chuyển đổi vai trò nhân sự (Dành riêng cho Admin)"
                    >
                      <span>🛡️</span> {showTopLogin ? 'Ẩn Panel Admin' : 'Admin Panel'}
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
                      fontSize: '0.76rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <span>🚪</span> Đăng Xuất
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
                    fontSize: '0.76rem',
                    padding: '0.35rem 0.75rem',
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
          <b>Tâm An Care V7.5 Development</b> • Nơi Tuổi Già An Nhiên • 1 Tòa nhà, 4 tầng, 29 phòng, 110 giường
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
                onClick={() => setShowPasswordModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
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
