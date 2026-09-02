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

const ROLE_BADGE_CLASS: Record<string, string> = {
  ADMIN: 'badge badge-danger',
  SUPERVISOR: 'badge badge-purple',
  CARE_MANAGER: 'badge badge-info',
  PSYCHOLOGIST: 'badge badge-purple',
  SOCIAL_WORKER: 'badge badge-info',
  NURSE: 'badge badge-success',
  CAREGIVER: 'badge badge-warning',
  NUTRITIONIST: 'badge badge-success',
  HOUSEKEEPING: 'badge badge-neutral',
  REHABILITATION_SPECIALIST: 'badge badge-info',
  SECURITY: 'badge badge-danger',
  ACCOUNTANT: 'badge badge-warning',
  RECEPTIONIST: 'badge badge-neutral',
  GUARDIAN: 'badge badge-success',
};

const ROLE_ICONS: Record<string, string> = {
  ADMIN: '🛡️',
  SUPERVISOR: '👑',
  CARE_MANAGER: '📋',
  PSYCHOLOGIST: '🧠',
  SOCIAL_WORKER: '🤝',
  NURSE: '🩺',
  CAREGIVER: '🤲',
  NUTRITIONIST: '🥗',
  HOUSEKEEPING: '🧹',
  REHABILITATION_SPECIALIST: '🧘',
  SECURITY: '🛡️',
  ACCOUNTANT: '💰',
  RECEPTIONIST: '🛎️',
  GUARDIAN: '👨‍👩‍👧',
};

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
  const [inputActorId, setInputActorId] = useState(actor?.actorId ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin Login Credentials Form
  const [adminUsernameInput, setAdminUsernameInput] = useState('Admin');
  const [adminPasswordInput, setAdminPasswordInput] = useState('Admin');
  const [adminAuthFeedback, setAdminAuthFeedback] = useState<string | null>(null);

  // Modal Change Admin Password State
  const [showChangeAdminPasswordModal, setShowChangeAdminPasswordModal] = useState(false);
  const [currentAdminPasswordInput, setCurrentAdminPasswordInput] = useState('');
  const [newAdminPasswordInput, setNewAdminPasswordInput] = useState('');
  const [confirmAdminPasswordInput, setConfirmAdminPasswordInput] = useState('');
  const [changePasswordFeedback, setChangePasswordFeedback] = useState<string | null>(null);

  // Load available active staff accounts
  const { data: staffList, isLoading } = useQuery({
    queryKey: ['auth-active-staff'],
    queryFn: fetchActiveStaff,
  });

  const allAccounts = [
    ...(staffList ?? []),
    ...GUARDIAN_DEMO_ACCOUNTS,
  ];

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const trimmed = id.trim();
      if (trimmed.toLowerCase() === 'admin' || trimmed === 'STAFF-ADMIN-001' || trimmed === 'ADMIN-001') {
        return ADMIN_DEMO_ACCOUNT;
      }
      const matchedGuardian = GUARDIAN_DEMO_ACCOUNTS.find(
        (g) => g.actorId === trimmed || g.staffCode === trimmed,
      );
      if (matchedGuardian) return matchedGuardian;
      return resolveStaffActor(trimmed);
    },
    onSuccess: (data: ActiveStaffMember) => {
      setActor({
        actorId: data.actorId,
        actorRole: data.actorRole,
        displayName: data.displayName,
      });
      setInputActorId(data.actorId);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Mã nhân sự không hợp lệ hoặc tài khoản không hoạt động');
    },
  });

  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminAuthFeedback(null);

    const valid = await verifyAdminPassword(adminPasswordInput.trim());
    if (adminUsernameInput.trim().toLowerCase() !== 'admin' && adminUsernameInput.trim() !== 'ADMIN-001') {
      setAdminAuthFeedback('❌ Tên đăng nhập Admin không chính xác. Mặc định là: Admin');
      return;
    }

    if (!valid) {
      setAdminAuthFeedback('❌ Mật khẩu Admin không chính xác. (Mặc định tạm thời là: Admin)');
      return;
    }

    // Login as Admin
    setActor({
      actorId: 'Admin',
      actorRole: 'ADMIN',
      displayName: 'Quản Trị Viên Tối Cao (Admin)',
    });
    setInputActorId('Admin');
    setAdminAuthFeedback('✅ Đăng nhập Admin thành công với 100% toàn quyền truy cập & chỉnh sửa tất cả thông tin!');
    setTimeout(() => setAdminAuthFeedback(null), 5000);
  };

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
      setChangePasswordFeedback('❌ Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setStoredAdminPassword(newAdminPasswordInput.trim());
    setAdminPasswordInput(newAdminPasswordInput.trim());

    // Record audit log
    await recordSystemAuditLog({
      actorId: actor?.actorId || 'Admin',
      actorName: actor?.displayName || 'Quản Trị Viên (Admin)',
      actorRole: 'ADMIN',
      actorRoleLabel: 'Quản trị viên Tối cao',
      actionType: 'UPDATE',
      actionLabel: 'Thay đổi mật khẩu tài khoản Admin tối cao',
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputActorId.trim()) return;
    resolveMutation.mutate(inputActorId.trim());
  };

  const handleSelectStaff = (staff: ActiveStaffMember) => {
    setActor({
      actorId: staff.actorId,
      actorRole: staff.actorRole,
      displayName: staff.displayName,
    });
    setInputActorId(staff.actorId);
    setErrorMessage(null);
  };

  const isAdmin = actor?.actorRole === 'ADMIN';

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
              Đăng Nhập & Chuyển Đổi Vai Trò Nhân Sự
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Hệ Thống Quản Trị Viện Dưỡng Lão Tâm An Care
            </div>
          </div>
        </div>

        {actor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', color: '#334155' }}>
              Đang đăng nhập: <b style={{ color: '#166534' }}>{actor.displayName || actor.actorId}</b> ({ROLE_LABELS[actor.actorRole] || actor.actorRole})
            </span>
            <button
              type="button"
              className="btn btn-sm btn-danger-outline"
              onClick={() => {
                clearActor();
                setInputActorId('');
                setErrorMessage(null);
              }}
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '0.78rem', color: '#b91c1c', fontWeight: 700, background: '#fee2e2', padding: '0.25rem 0.6rem', borderRadius: '0.35rem' }}>
            ⚠️ Chưa đăng nhập — Vui lòng chọn tài khoản bên dưới
          </span>
        )}
      </div>

      {/* Main Login Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {/* Box 1: Admin & Executive Login Form */}
        <div
          style={{
            background: isAdmin ? '#f0fdf4' : '#f8fafc',
            border: `1.5px solid ${isAdmin ? '#86efac' : '#e2e8f0'}`,
            borderRadius: '0.65rem',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                <b style={{ color: '#0f172a', fontSize: '0.92rem' }}>ĐĂNG NHẬP QUẢN TRỊ VIÊN (ADMIN)</b>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeAdminPasswordModal(true)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.35rem',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                🔑 Đổi Mật Khẩu
              </button>
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Toàn quyền truy cập và chỉnh sửa dữ liệu toàn hệ thống. Mặc định: <b>Admin / Admin</b>
            </div>

            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.15rem' }}>
                    Tên đăng nhập:
                  </label>
                  <input
                    type="text"
                    className="text-input"
                    style={{ width: '100%', height: '32px', fontSize: '0.82rem', padding: '0 0.5rem', boxSizing: 'border-box', fontWeight: 700 }}
                    value={adminUsernameInput}
                    onChange={(e) => setAdminUsernameInput(e.target.value)}
                    placeholder="Admin"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.15rem' }}>
                    Mật khẩu:
                  </label>
                  <input
                    type="password"
                    className="text-input"
                    style={{ width: '100%', height: '32px', fontSize: '0.82rem', padding: '0 0.5rem', boxSizing: 'border-box', fontWeight: 700 }}
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Admin"
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  height: '32px',
                  background: '#166534',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  marginTop: '0.25rem',
                }}
              >
                {isAdmin ? '✅ Đang Là Admin Tối Cao' : '🔒 Đăng Nhập Quản Trị Viên'}
              </button>
            </form>

            {adminAuthFeedback && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.35rem 0.6rem',
                  borderRadius: '0.35rem',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  background: adminAuthFeedback.includes('❌') ? '#fee2e2' : '#dcfce7',
                  color: adminAuthFeedback.includes('❌') ? '#b91c1c' : '#15803d',
                }}
              >
                {adminAuthFeedback}
              </div>
            )}
          </div>
        </div>

        {/* Box 2: Quick ID Login */}
        <div
          style={{
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: '0.65rem',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🆔</span>
              <b style={{ color: '#0f172a', fontSize: '0.92rem' }}>ĐĂNG NHẬP THEO MÃ ID NHÂN VIÊN</b>
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Nhập trực tiếp mã định danh nhân sự (ID) được Ban Giám đốc hoặc Quản lý cấp.
            </div>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                value={inputActorId}
                onChange={(e) => setInputActorId(e.target.value)}
                placeholder="Nhập ID (ví dụ: STAFF-DIR-001, STAFF-NUR-003)..."
                className="form-input"
                style={{ width: '100%', height: '32px', fontSize: '0.82rem', padding: '0 0.5rem', boxSizing: 'border-box' }}
              />

              {errorMessage && (
                <div style={{ padding: '0.35rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.76rem', background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!inputActorId.trim() || resolveMutation.isPending}
                style={{
                  width: '100%',
                  height: '32px',
                  background: '#0369a1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  marginTop: '0.25rem',
                }}
              >
                {resolveMutation.isPending ? '⏳ Đang xác thực...' : '➡️ Đăng Nhập Bằng ID'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Quick Staff Selector Bar (ONLY VISIBLE TO ADMIN) */}
      {isAdmin && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
            👥 Chọn nhanh vai trò tài khoản nhân sự (Dành riêng cho Quản trị viên Admin):
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
                      padding: '0.3rem 0.6rem',
                      background: isSelected ? '#166534' : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#334155',
                      border: isSelected ? '1px solid #15803d' : '1px solid #cbd5e1',
                      borderRadius: '0.4rem',
                      fontSize: '0.76rem',
                      fontWeight: isSelected ? 700 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{ROLE_ICONS[staff.actorRole] || '👤'}</span>
                    <span>{staff.displayName}</span>
                    <span style={{ opacity: 0.75, fontSize: '0.7rem' }}>({ROLE_LABELS[staff.actorRole] || staff.actorRole})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* MODAL: ĐỔI MẬT KHẨU ADMIN */}
      {showChangeAdminPasswordModal && (
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
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#7e22ce', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔑</span> Thay Đổi Mật Khẩu Admin Tối Cao
              </h2>
              <button
                onClick={() => setShowChangeAdminPasswordModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassword}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Mật khẩu hiện tại (Mặc định: Admin):
                </label>
                <input
                  type="password"
                  className="text-input"
                  style={{ width: '100%', height: '36px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={currentAdminPasswordInput}
                  onChange={(e) => setCurrentAdminPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu Admin hiện tại"
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
                  value={newAdminPasswordInput}
                  onChange={(e) => setNewAdminPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới bảo mật"
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
                  value={confirmAdminPasswordInput}
                  onChange={(e) => setConfirmAdminPasswordInput(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                />
              </div>

              {changePasswordFeedback && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.35rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: changePasswordFeedback.includes('❌') ? '#fee2e2' : '#dcfce7',
                    color: changePasswordFeedback.includes('❌') ? '#b91c1c' : '#15803d',
                  }}
                >
                  {changePasswordFeedback}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowChangeAdminPasswordModal(false)}
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
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    background: '#7e22ce',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  ✓ Cập Nhật Mật Khẩu Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
