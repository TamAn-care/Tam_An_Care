import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from './ActorContext';
import {
  fetchActiveStaff,
  resolveStaffActor,
  ActiveStaffMember,
  getStoredAdminPassword,
  setStoredAdminPassword,
  verifyAdminPassword,
} from '../api/auth';
import { ROLE_LABELS } from './role-policy';
import { recordSystemAuditLog } from '../api/audit-log';

const GUARDIAN_DEMO_ACCOUNTS: ActiveStaffMember[] = [
  {
    actorId: 'TA-GUA-01',
    staffCode: 'TA-GUA-01',
    displayName: 'Lê Gia Bảo (Thân nhân cụ Nguyễn Văn An)',
    actorRole: 'GUARDIAN',
    status: 'ACTIVE',
  },
  {
    actorId: 'TA-GUA-02',
    staffCode: 'TA-GUA-02',
    displayName: 'Trần Anh Đức (Thân nhân cụ Trần Thị Bình)',
    actorRole: 'GUARDIAN',
    status: 'ACTIVE',
  },
];

export function DevelopmentActorPanel() {
  const { actor, setActor, clearActor } = useActor();
  const queryClient = useQueryClient();

  // Unified Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginFeedback, setLoginFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Change Password Modal State
  const [showChangeAdminPasswordModal, setShowChangeAdminPasswordModal] = useState(false);
  const [currentAdminPasswordInput, setCurrentAdminPasswordInput] = useState('');
  const [newAdminPasswordInput, setNewAdminPasswordInput] = useState('');
  const [confirmAdminPasswordInput, setConfirmAdminPasswordInput] = useState('');
  const [changePasswordFeedback, setChangePasswordFeedback] = useState<string | null>(null);

  // Load available staff list (used for Admin quick selection)
  const { data: staffList, isLoading } = useQuery({
    queryKey: ['auth-active-staff'],
    queryFn: fetchActiveStaff,
  });

  const allAccounts = [
    ...(staffList ?? []),
    ...GUARDIAN_DEMO_ACCOUNTS,
  ];

  const isAdmin = actor?.actorRole === 'ADMIN';

  // Unified Single Login Handler
  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginFeedback(null);

    const userStr = loginIdentifier.trim();
    const passStr = loginPassword.trim();

    if (!userStr) {
      setLoginFeedback({ text: '❌ Vui lòng nhập Tên đăng nhập hoặc Mã nhân viên.', isError: true });
      return;
    }

    setIsSubmitting(true);

    try {
      const q = userStr.toLowerCase();

      // Check if user is attempting Admin login
      if (q === 'admin' || q === 'admin-001' || q === 'adm-001' || q === 'staff-admin-001') {
        const isValidAdminPass = await verifyAdminPassword(passStr);
        if (!isValidAdminPass) {
          setLoginFeedback({
            text: '❌ Mật khẩu Quản trị viên (Admin) không chính xác.',
            isError: true,
          });
          setIsSubmitting(false);
          return;
        }

        setActor({
          actorId: 'Admin',
          actorRole: 'ADMIN',
          displayName: 'Quản Trị Viên Tối Cao (Admin)',
        });
        setLoginFeedback({
          text: '✅ Đăng nhập Quản trị viên (Admin) thành công!',
          isError: false,
        });
        setLoginPassword('');
        setIsSubmitting(false);
        setTimeout(() => setLoginFeedback(null), 4000);
        return;
      }

      // Resolving regular Staff Member or Guardian by Staff Code / ID
      const resolved = await resolveStaffActor(userStr);

      setActor({
        actorId: resolved.actorId,
        actorRole: resolved.actorRole,
        displayName: resolved.displayName,
      });

      setLoginFeedback({
        text: `✅ Đăng nhập thành công: ${resolved.displayName} (${ROLE_LABELS[resolved.actorRole] || resolved.actorRole})`,
        isError: false,
      });
      setLoginPassword('');
      setIsSubmitting(false);
      setTimeout(() => setLoginFeedback(null), 4000);
    } catch (err: any) {
      setLoginFeedback({
        text: err.message || '❌ Tên đăng nhập hoặc Mã nhân viên không tồn tại trong hệ thống.',
        isError: true,
      });
      setIsSubmitting(false);
    }
  };

  // Change Admin Password Handler
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordFeedback(null);

    const currentSaved = getStoredAdminPassword();
    if (currentAdminPasswordInput.trim() !== currentSaved) {
      setChangePasswordFeedback('❌ Mật khẩu hiện tại không đúng.');
      return;
    }

    if (!newAdminPasswordInput.trim() || newAdminPasswordInput.trim().length < 3) {
      setChangePasswordFeedback('❌ Mật khẩu mới phải có tối thiểu 3 ký tự.');
      return;
    }

    if (newAdminPasswordInput.trim() !== confirmAdminPasswordInput.trim()) {
      setChangePasswordFeedback('❌ Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setStoredAdminPassword(newAdminPasswordInput.trim());

    await recordSystemAuditLog({
      actorId: actor?.actorId || 'Admin',
      actorName: actor?.displayName || 'Quản Trị Viên (Admin)',
      actorRole: actor?.actorRole || 'ADMIN',
      actorRoleLabel: ROLE_LABELS[actor?.actorRole || 'ADMIN'] || 'Quản trị viên',
      actionType: 'UPDATE',
      actionLabel: 'Cập nhật mật khẩu Admin',
      module: 'SYSTEM_ADMIN',
      moduleLabel: 'Bảo Mật Hệ Thống',
      targetEntityId: 'Admin',
      targetEntityName: 'Tài khoản Quản trị viên Tối cao',
      summary: 'Quản trị viên đã cập nhật mật khẩu mới cho tài khoản Admin nhằm mục đích bảo mật.',
      severity: 'CRITICAL',
    });

    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    setChangePasswordFeedback('✅ Đã cập nhật mật khẩu Admin mới thành công!');
    setTimeout(() => {
      setShowChangeAdminPasswordModal(false);
      setChangePasswordFeedback(null);
      setCurrentAdminPasswordInput('');
      setNewAdminPasswordInput('');
      setConfirmAdminPasswordInput('');
    }, 1500);
  };

  const handleSelectStaff = (staff: ActiveStaffMember) => {
    setActor({
      actorId: staff.actorId,
      actorRole: staff.actorRole,
      displayName: staff.displayName,
    });
    setLoginIdentifier(staff.staffCode || staff.actorId);
    setLoginFeedback(null);
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '1rem',
        border: '1px solid #d8e2dc',
        boxShadow: '0 12px 35px rgba(22, 101, 52, 0.08)',
        overflow: 'hidden',
        margin: '0 auto',
      }}
    >
      {/* TRADITIONAL SIDE-BY-SIDE 2-COLUMN SPLIT CONTAINER */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'stretch',
        }}
      >
        {/* LEFT COLUMN: BRANDING & LOGO */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            padding: '2.75rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            borderRight: '1px solid #e2e8f0',
          }}
        >
          <img
            src="/branding/tam-an-logo-master.png"
            alt="Logo Tâm An"
            style={{
              width: '215px',
              height: 'auto',
              marginBottom: '1.5rem',
              filter: 'drop-shadow(0 8px 20px rgba(22, 101, 52, 0.22))',
              transition: 'transform 0.3s ease',
            }}
          />
          <h2
            style={{
              margin: '0 0 0.4rem 0',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#14532d',
              letterSpacing: '-0.025em',
              lineHeight: 1.25,
            }}
          >
            Trung Tâm Dưỡng Lão Tâm An
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '1rem',
              color: '#166534',
              fontWeight: 600,
              letterSpacing: '0.01em',
            }}
          >
            Nơi Tuổi Già An Nhiên
          </p>

          <div
            style={{
              width: '48px',
              height: '3.5px',
              background: '#166534',
              borderRadius: '3px',
              margin: '1.25rem 0',
              opacity: 0.85,
            }}
          />

          <span
            style={{
              fontSize: '0.82rem',
              color: '#166534',
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '0.45rem 1rem',
              borderRadius: '24px',
              border: '1px solid #86efac',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(22, 101, 52, 0.06)',
            }}
          >
            Tận Tâm • An Toàn • Y Khoa Chuẩn Mực
          </span>
        </div>

        {/* RIGHT COLUMN: LOGIN FORM OR LOGGED-IN STATUS */}
        <div style={{ padding: '2.5rem 2.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {actor ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>✅</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#166534', fontWeight: 800 }}>
                  Đã Xác Thực Đăng Nhập
                </h3>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                <div>Tài khoản: <b style={{ color: '#166534' }}>{actor.displayName || actor.actorId}</b></div>
                <div>Vai trò: <b>{ROLE_LABELS[actor.actorRole] || actor.actorRole}</b></div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowChangeAdminPasswordModal(true)}
                    style={{
                      background: '#fef3c7',
                      border: '1px solid #fde047',
                      color: '#854d0e',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '0.4rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    🔑 Đổi Mật Khẩu Admin
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    clearActor();
                    setLoginIdentifier('');
                    setLoginPassword('');
                    setLoginFeedback(null);
                  }}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '0.4rem',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  🚪 Đăng Xuất
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* LOGIN FORM */}
              <h1
                style={{
                  margin: '0 0 0.35rem 0',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#166534',
                  letterSpacing: '0.01em',
                }}
              >
                HỆ THỐNG QUẢN TRỊ TÂM AN - Tam An Care
              </h1>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.82rem', color: '#64748b' }}>
                Đăng nhập tài khoản để thực thi nhiệm vụ đúng thẩm quyền
              </p>

              <form onSubmit={handleUnifiedLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.83rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Tên đăng nhập / Mã nhân viên <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Nhập Mã nhân viên (VD: NV-DIR-001, DIR-001) hoặc Admin..."
                    className="form-input"
                    style={{
                      width: '100%',
                      height: '44px',
                      fontSize: '1rem',
                      padding: '0 0.85rem',
                      borderRadius: '0.5rem',
                      border: '1.5px solid #cbd5e1',
                      boxSizing: 'border-box',
                      fontWeight: 600,
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.83rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Mật khẩu đăng nhập <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="form-input"
                    style={{
                      width: '100%',
                      height: '44px',
                      fontSize: '1rem',
                      padding: '0 0.85rem',
                      borderRadius: '0.5rem',
                      border: '1.5px solid #cbd5e1',
                      boxSizing: 'border-box',
                      fontWeight: 600,
                    }}
                  />
                </div>

                {loginFeedback && (
                  <div
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      background: loginFeedback.isError ? '#fef2f2' : '#f0fdf4',
                      color: loginFeedback.isError ? '#991b1b' : '#14532d',
                      border: loginFeedback.isError ? '1px solid #fecaca' : '1px solid #bbf7d0',
                    }}
                  >
                    {loginFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !loginIdentifier.trim()}
                  style={{
                    width: '100%',
                    height: '44px',
                    background: '#166534',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(22, 101, 52, 0.25)',
                    marginTop: '0.25rem',
                  }}
                >
                  {isSubmitting ? '⏳ Đang xác thực thông tin đăng nhập...' : '🔑 Đăng Nhập Hệ Thống'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* QUICK STAFF SELECTOR (ONLY FOR LOGGED IN ADMIN) */}
      {isAdmin && (
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
            👥 Chuyển nhanh vai trò nhân viên thử nghiệm (Dành riêng cho Admin):
          </div>

          {isLoading ? (
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Đang tải danh sách nhân viên...</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {allAccounts.map((staff: ActiveStaffMember) => {
                const isSelected = actor?.actorId === staff.actorId;
                return (
                  <button
                    key={staff.actorId}
                    type="button"
                    onClick={() => handleSelectStaff(staff)}
                    style={{
                      background: isSelected ? '#166534' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      border: isSelected ? '1px solid #14532d' : '1px solid #cbd5e1',
                      borderRadius: '0.35rem',
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.74rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {staff.displayName} ({staff.staffCode})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL CHANGE ADMIN PASSWORD */}
      {showChangeAdminPasswordModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="modal-dialog" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '420px', width: '100%', padding: '1.25rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.6rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#166534', fontWeight: 800 }}>
                🔑 Cập Nhật Mật Khẩu Admin Tối Cao
              </h3>
              <button onClick={() => setShowChangeAdminPasswordModal(false)} className="modal-close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassword}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Mật khẩu Admin hiện tại <span className="req">*</span>
                  </label>
                  <input
                    type="password"
                    value={currentAdminPasswordInput}
                    onChange={(e) => setCurrentAdminPasswordInput(e.target.value)}
                    required
                    className="form-input"
                    placeholder="Nhập mật khẩu Admin hiện tại..."
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Mật khẩu Admin mới <span className="req">*</span>
                  </label>
                  <input
                    type="password"
                    value={newAdminPasswordInput}
                    onChange={(e) => setNewAdminPasswordInput(e.target.value)}
                    required
                    className="form-input"
                    placeholder="Nhập mật khẩu mới..."
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Xác nhận mật khẩu mới <span className="req">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmAdminPasswordInput}
                    onChange={(e) => setConfirmAdminPasswordInput(e.target.value)}
                    required
                    className="form-input"
                    placeholder="Nhập lại mật khẩu mới..."
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                {changePasswordFeedback && (
                  <div
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: changePasswordFeedback.includes('❌') ? '#fee2e2' : '#dcfce7',
                      color: changePasswordFeedback.includes('❌') ? '#b91c1c' : '#15803d',
                    }}
                  >
                    {changePasswordFeedback}
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button type="button" onClick={() => setShowChangeAdminPasswordModal(false)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  💾 Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
