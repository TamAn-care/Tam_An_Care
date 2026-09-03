import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './ActorContext';
import {
  fetchActiveStaff,
  resolveStaffActor,
  ActiveStaffMember,
  ADMIN_DEMO_ACCOUNT,
  getStoredAdminPassword,
  setStoredAdminPassword,
  verifyAdminPassword,
} from '../api/auth';
import { ROLE_LABELS } from './role-policy';
import { recordSystemAuditLog } from '../api/audit-log';

const GUARDIAN_DEMO_ACCOUNTS: ActiveStaffMember[] = [
  {
    actorId: 'guardian-bao-001',
    staffCode: 'GD-001',
    displayName: 'Lê Gia Bảo (Thân nhân cụ Nguyễn Văn An)',
    actorRole: 'GUARDIAN',
    status: 'ACTIVE',
  },
  {
    actorId: 'guardian-duc-002',
    staffCode: 'GD-002',
    displayName: 'Trần Anh Đức (Thân nhân cụ Trần Thị Bình)',
    actorRole: 'GUARDIAN',
    status: 'ACTIVE',
  },
];

export function DevelopmentActorPanel() {
  const { actor, setActor, clearActor } = useActor();
  const queryClient = useQueryClient();

  // Unified Single Login State
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
        text: `✅ Đăng nhập thành công với vai trò: ${resolved.displayName} (${ROLE_LABELS[resolved.actorRole] || resolved.actorRole})`,
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
        border: '1px solid #cbd5e1',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/branding/tam-an-logo-master.png" alt="Tâm An Logo" style={{ height: '32px', width: 'auto' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#166534', fontWeight: 800 }}>
              Đăng Nhập Tài Khoản Nhiệm Vụ Nhân Sự
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Viện Dưỡng Lão Tâm An Care — Hệ Thống Phân Quyền Bảo Mật
            </div>
          </div>
        </div>

        {actor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#334155' }}>
              Đang đăng nhập: <b style={{ color: '#166534' }}>{actor.displayName || actor.actorId}</b> ({ROLE_LABELS[actor.actorRole] || actor.actorRole})
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowChangeAdminPasswordModal(true)}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde047',
                  color: '#854d0e',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '0.35rem',
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                🔑 Đổi Mật Khẩu Admin
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-danger-outline"
              onClick={() => {
                clearActor();
                setLoginIdentifier('');
                setLoginPassword('');
                setLoginFeedback(null);
              }}
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
            >
              🚪 Đăng xuất
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '0.78rem', color: '#b91c1c', fontWeight: 700, background: '#fee2e2', padding: '0.25rem 0.6rem', borderRadius: '0.35rem' }}>
            ⚠️ Vui lòng gõ Tên đăng nhập / Mã nhân viên và Mật khẩu để đăng nhập
          </span>
        )}
      </div>

      {/* UNIFIED SINGLE LOGIN FORM FOR ALL ROLES */}
      <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '0.75rem', padding: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🔑</span>
          <b style={{ color: '#0f172a', fontSize: '1rem' }}>HỘP THOẠI ĐĂNG NHẬP HỆ THỐNG</b>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
          Nhập <b>Tên đăng nhập / Mã nhân viên</b> và <b>Mật khẩu</b> được phân công để thực thi nhiệm vụ đúng thẩm quyền.
        </div>

        <form onSubmit={handleUnifiedLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
              Tên đăng nhập / Mã nhân viên <span style={{ color: '#b91c1c' }}>*</span>
            </label>
            <input
              type="text"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              placeholder="Nhập Mã nhân viên (ví dụ: NV-DIR-001, DIR-001, CG-001) hoặc Admin..."
              className="form-input"
              style={{ width: '100%', height: '38px', fontSize: '0.88rem', padding: '0 0.75rem', boxSizing: 'border-box', fontWeight: 600 }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
              Mật khẩu đăng nhập <span style={{ color: '#b91c1c' }}>*</span>
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Nhập mật khẩu cá nhân..."
              className="form-input"
              style={{ width: '100%', height: '38px', fontSize: '0.88rem', padding: '0 0.75rem', boxSizing: 'border-box', fontWeight: 600 }}
            />
          </div>

          {loginFeedback && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: loginFeedback.isError ? '#fee2e2' : '#dcfce7',
                color: loginFeedback.isError ? '#b91c1c' : '#15803d',
                border: loginFeedback.isError ? '1px solid #fca5a5' : '1px solid #86efac',
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
              height: '40px',
              background: '#166534',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              marginTop: '0.25rem',
              boxShadow: '0 2px 4px rgba(22, 101, 52, 0.2)',
            }}
          >
            {isSubmitting ? '⏳ Đang xác thực thông tin đăng nhập...' : '🔑 Đăng Nhập Hệ Thống'}
          </button>
        </form>
      </div>

      {/* Quick Staff Selector Bar (ONLY VISIBLE TO LOGGED IN ADMIN) */}
      {isAdmin && (
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
            👥 Chuyển nhanh vai trò thử nghiệm (Chỉ hiển thị cho Quản trị viên Admin):
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
                      background: isSelected ? '#166534' : '#f1f5f9',
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
