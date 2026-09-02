import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { HumanActorRole } from '../../types/actor';
import {
  listStaffActors,
  createStaffAccount,
  resetStaffPassword,
  updateStaffStatus,
  generateSecurePassword,
  type StaffActor,
  type StaffActorStatus,
} from '../../api/staff-actors';

import {
  createResidentAccessAssignment,
  listResidentAccessAssignments,
  revokeResidentAccessAssignment,
  type AssignmentRole,
} from '../../api/resident-access-administration';

import { listResidents } from '../../api/residents';
import { useActor } from '../../auth/ActorContext';
import { hasCapability, ROLE_LABELS } from '../../auth/role-policy';
import { ApiError } from '../../api/errors';
import { EmptyState, ErrorState, LoadingState } from '../../components/feedback/FeedbackStates';
import { pushInAppNotification } from '../../api/notifications';

type RoleFilter = 'ALL' | HumanActorRole;
type StatusFilter = 'ALL' | StaffActorStatus;

const ROLE_LABEL = ROLE_LABELS;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  SUSPENDED: 'Tạm khóa',
  ARCHIVED: 'Đã lưu trữ',
};

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function StaffAccessPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  // Active Sub-tab
  const [activeMainTab, setActiveMainTab] = useState<'STAFF_ACCOUNTS' | 'RESIDENT_ACCESS'>('STAFF_ACCOUNTS');

  // Permissions
  const isAdmin = actor?.actorRole === 'ADMIN';
  const isDirector = actor?.actorRole === 'SUPERVISOR' || isAdmin;
  const isManager = actor?.actorRole === 'CARE_MANAGER';
  const canManageStaff = hasCapability(actor?.actorRole, 'canManageStaff');
  const canManageDirector = hasCapability(actor?.actorRole, 'canManageDirectorStaff');

  // Filters & Search for Staff Accounts Tab
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');

  // Feedback banner
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Queries
  const staffQuery = useQuery({
    queryKey: ['staff-actors', actor?.actorId ?? 'anonymous', actor?.actorRole ?? 'none'],
    enabled: Boolean(actor),
    queryFn: () => listStaffActors(actor, { limit: 150 }),
  });

  const assignmentQuery = useQuery({
    queryKey: ['resident-access-assignments', actor?.actorId ?? 'anonymous'],
    enabled: Boolean(actor),
    queryFn: () => {
      if (!actor) throw new Error('Chưa xác định phiên làm việc.');
      return listResidentAccessAssignments(actor);
    },
    retry: false,
  });

  const residentsQuery = useQuery({
    queryKey: ['residents-for-access', actor?.actorId ?? 'anonymous'],
    enabled: Boolean(actor),
    queryFn: () => listResidents(),
  });

  // Modal States for Staff Account Management
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState<StaffActor | null>(null);
  const [showResetModal, setShowResetModal] = useState<StaffActor | null>(null);

  // Create Staff Account Form State
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<HumanActorRole>('NURSE');
  const [formStaffCode, setFormStaffCode] = useState('');
  const [formActorId, setFormActorId] = useState('');
  const [formDepartment, setFormDepartment] = useState('Khối Y Tế & Điều Dưỡng');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState(generateSecurePassword());
  const [formRequireChange, setFormRequireChange] = useState(true);

  // Reset Password State
  const [newResetPassword, setNewResetPassword] = useState(generateSecurePassword());

  // Resident Assignment Form State
  const [residentId, setResidentId] = useState('');
  const [assignmentActorId, setAssignmentActorId] = useState('');
  const [assignmentRole, setAssignmentRole] = useState<AssignmentRole>('CAREGIVER');
  const [showConfirmAssignModal, setShowConfirmAssignModal] = useState(false);

  // Auto-fill codes when role or name changes
  const handleRoleChangeInForm = (nextRole: HumanActorRole) => {
    setFormRole(nextRole);
    const prefixMap: Record<HumanActorRole, { prefix: string; dept: string }> = {
      ADMIN: { prefix: 'ADM', dept: 'Ban Quản Trị Hệ Thống Tối Cao' },
      SUPERVISOR: { prefix: 'DIR', dept: 'Ban Giám Đốc' },
      CARE_MANAGER: { prefix: 'MGR', dept: 'Khối Quản Lý Vận Hành' },
      NURSE: { prefix: 'NUR', dept: 'Khối Y Tế & Điều Dưỡng' },
      CAREGIVER: { prefix: 'CG', dept: 'Khối Chăm Sóc Trực Tiếp' },
      NUTRITIONIST: { prefix: 'NUT', dept: 'Bộ Phận Dinh Dưỡng & Bếp Ăn' },
      ACCOUNTANT: { prefix: 'ACC', dept: 'Phòng Kế Toán & Viện Phí' },
      RECEPTIONIST: { prefix: 'REC', dept: 'Bộ Phận Lễ Tân & Tiếp Đón' },
      PSYCHOLOGIST: { prefix: 'PSY', dept: 'Tư Vấn & Trị Liệu Tâm Lý' },
      SOCIAL_WORKER: { prefix: 'SW', dept: 'Công Tác Xã Hội & Đời Sống' },
      REHABILITATION_SPECIALIST: { prefix: 'REH', dept: 'Vật Lý Trị Liệu & PHCN' },
      HOUSEKEEPING: { prefix: 'HK', dept: 'Bộ Phận Buồng Phòng & Tạp Vụ' },
      SECURITY: { prefix: 'SEC', dept: 'Đội An Ninh & Trật Tự' },
      GUARDIAN: { prefix: 'GUA', dept: 'Cổng Thân Nhân' },
    };

    const config = prefixMap[nextRole] || { prefix: 'STF', dept: 'Vận Hành & Chăm Sóc' };
    const rand = Math.floor(100 + Math.random() * 900);
    setFormStaffCode(`NV-${config.prefix}-${rand}`);
    setFormActorId(`STAFF-${config.prefix}-${rand}`);
    setFormDepartment(config.dept);
  };

  // Open Create Account Modal
  const handleOpenCreateModal = () => {
    // Default role: If Director, can choose Supervisor or Manager, if Manager default to Nurse
    const initialRole: HumanActorRole = isDirector ? 'CARE_MANAGER' : 'NURSE';
    handleRoleChangeInForm(initialRole);
    setFormDisplayName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword(generateSecurePassword());
    setFormRequireChange(true);
    setShowCreateModal(true);
  };

  // Create Staff Account Mutation
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Chưa đăng nhập');
      return createStaffAccount(actor, {
        displayName: formDisplayName,
        primaryOperationalRole: formRole,
        staffCode: formStaffCode,
        actorId: formActorId,
        department: formDepartment,
        email: formEmail || `${formStaffCode.toLowerCase()}@tamancare.vn`,
        phone: formPhone || '0900 000 000',
        initialPassword: formPassword,
        requirePasswordChangeOnFirstLogin: formRequireChange,
      });
    },
    onSuccess: (newStaff) => {
      queryClient.invalidateQueries({ queryKey: ['staff-actors'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setShowCreateModal(false);
      setFeedback(`✅ Đã cấp tài khoản ID ${newStaff.actorId} cho ${newStaff.displayName} thành công!`);
      // Show handover modal
      setShowHandoverModal(newStaff);
    },
    onError: (err) => {
      setFeedback(`❌ Lỗi: ${errorText(err, 'Không thể tạo tài khoản')}`);
    },
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!actor || !showResetModal) throw new Error('Chưa chọn tài khoản');
      return resetStaffPassword(actor, {
        actorId: showResetModal.actorId,
        newPassword: newResetPassword,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-actors'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      const target = showResetModal;
      setShowResetModal(null);
      setFeedback(`✅ Đã đặt lại mật khẩu cho tài khoản ${target?.displayName} thành công!`);
      if (target) {
        setShowHandoverModal({ ...target, initialPassword: newResetPassword });
      }
    },
    onError: (err) => {
      setFeedback(`❌ Lỗi: ${errorText(err, 'Không thể đặt lại mật khẩu')}`);
    },
  });

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ actorId, currentStatus }: { actorId: string; currentStatus: StaffActorStatus }) => {
      if (!actor) throw new Error('Chưa đăng nhập');
      const nextStatus: StaffActorStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      return updateStaffStatus(actor, {
        actorId,
        status: nextStatus,
        reason: nextStatus === 'SUSPENDED' ? 'Tạm khóa theo yêu cầu quản trị' : 'Mở khóa kích hoạt lại',
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['staff-actors'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setFeedback(`✅ Đã cập nhật trạng thái tài khoản ${updated.displayName}: ${STATUS_LABEL[updated.status]}`);
    },
    onError: (err) => {
      setFeedback(`❌ Lỗi: ${errorText(err, 'Không thể thay đổi trạng thái tài khoản')}`);
    },
  });

  // Resident Assignment Mutations
  const createAssignmentMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Chưa xác định phiên làm việc.');
      if (!residentId.trim()) throw new Error('Vui lòng chọn người cao tuổi.');
      if (!assignmentActorId.trim()) throw new Error('Vui lòng chọn nhân sự.');

      return createResidentAccessAssignment(actor, {
        residentId: residentId.trim(),
        actorId: assignmentActorId.trim(),
        actorRole: assignmentRole,
        accessScope: 'CARE',
      });
    },
    onSuccess: async () => {
      pushInAppNotification({
        type: 'ASSIGNMENT',
        title: '🛡️ Phân Công Chăm Sóc Mới',
        message: `Ban Giám đốc vừa cấp quyền phân công nhân sự phụ trách hồ sơ người cao tuổi (${residentMap.get(residentId) || residentId}).`,
        targetUrl: '/staff-access',
        createdBy: actor?.displayName || 'Ban Giám đốc',
      });
      setFeedback('✅ Đã tạo phân công chăm sóc thành công.');
      await queryClient.invalidateQueries({ queryKey: ['resident-access-assignments'] });
      setResidentId('');
      setAssignmentActorId('');
    },
    onError: (error) => {
      setFeedback(`❌ ${errorText(error, 'Không thể tạo phân công.')}`);
    },
  });

  const revokeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!actor) throw new Error('Chưa xác định phiên làm việc.');
      return revokeResidentAccessAssignment(actor, assignmentId, {
        revocationReason: 'Thu hồi từ giao diện quản trị',
      });
    },
    onSuccess: async () => {
      setFeedback('✅ Đã thu hồi phân công chăm sóc.');
      await queryClient.invalidateQueries({ queryKey: ['resident-access-assignments'] });
    },
    onError: (error) => {
      setFeedback(`❌ ${errorText(error, 'Không thể thu hồi phân công.')}`);
    },
  });

  // Filtered staff list
  const staffList = useMemo(() => {
    const rawData = staffQuery.data || [];
    const needle = search.trim().toLowerCase();

    return rawData.filter((item) => {
      if (roleFilter !== 'ALL' && item.primaryOperationalRole !== roleFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!needle) return true;

      return (
        item.displayName.toLowerCase().includes(needle) ||
        item.staffCode.toLowerCase().includes(needle) ||
        item.actorId.toLowerCase().includes(needle) ||
        item.department.toLowerCase().includes(needle) ||
        item.email.toLowerCase().includes(needle) ||
        item.phone.includes(needle)
      );
    });
  }, [staffQuery.data, search, roleFilter, statusFilter]);

  const residentMap = useMemo(() => {
    const map = new Map<string, string>();
    (residentsQuery.data ?? []).forEach(({ resident }) => {
      map.set(resident.residentId, `${resident.displayName} (${resident.residentCode})`);
    });
    return map;
  }, [residentsQuery.data]);

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    (staffQuery.data ?? []).forEach((s) => {
      map.set(s.actorId, `${s.displayName} (${s.staffCode})`);
    });
    return map;
  }, [staffQuery.data]);

  const assignableStaff = useMemo(() => {
    return (staffQuery.data ?? []).filter(
      (item) => item.status === 'ACTIVE' && (item.primaryOperationalRole === 'CAREGIVER' || item.primaryOperationalRole === 'NURSE')
    );
  }, [staffQuery.data]);

  // Copy handover credentials to clipboard
  const handleCopyCredentials = (staff: StaffActor) => {
    const text = `[VIỆN DƯỠNG LÃO TÂM AN CARE - THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP]
- Họ và tên: ${staff.displayName}
- Bộ phận: ${staff.department}
- Vai trò: ${ROLE_LABEL[staff.primaryOperationalRole] || staff.primaryOperationalRole}
- Mã nhân viên: ${staff.staffCode}
- Tên đăng nhập / ID: ${staff.actorId}
- Mật khẩu khởi tạo: ${staff.initialPassword || 'TamAn@2026#Secure'}
- Đường link đăng nhập: ${window.location.origin}
- Lưu ý: Vui lòng đổi mật khẩu cá nhân ngay trong lần đầu tiên đăng nhập hệ thống để đảm bảo an toàn bảo mật.`;

    navigator.clipboard.writeText(text);
    setCopyFeedback('✅ Đã sao chép thông tin tài khoản & mật khẩu! Bạn có thể dán gửi qua Zalo hoặc Email.');
    setTimeout(() => setCopyFeedback(null), 4000);
  };

  const exportStaffAccountsCSV = () => {
    if (!staffQuery.data) return;
    const headers = ['STT', 'Mã Nhân Viên', 'Mã Tài Khoản (ActorId)', 'Họ Và Tên', 'Vai Trò / Chức Danh', 'Trạng Thái', 'Bộ Phận', 'Ngày Tạo'];
    const rows = staffQuery.data.map((item, index) => [
      index + 1,
      item.staffCode || 'Chưa cấp',
      item.actorId,
      `"${item.displayName}"`,
      ROLE_LABELS[item.primaryOperationalRole] || item.primaryOperationalRole,
      STATUS_LABEL[item.status] || item.status,
      `"${item.department || 'Y tế & Chăm sóc'}"`,
      item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_Nhan_Su_TamAnCare_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportResidentAssignmentsCSV = () => {
    if (!assignmentQuery.data) return;
    const headers = ['STT', 'Mã Phân Công', 'Mã Cư Dân', 'Tên Cư Dân', 'Nhân Viên Phụ Trách', 'Vai Trò Nhân Viên', 'Phạm Vi Tiếp Cận', 'Ngày Cấp Quyền'];
    const rows = assignmentQuery.data.map((item, index) => [
      index + 1,
      item.residentAccessAssignmentId,
      item.residentId,
      `"${residentMap.get(item.residentId) || item.residentId}"`,
      `"${staffMap.get(item.actorId) || item.actorId}"`,
      ROLE_LABELS[item.actorRole as keyof typeof ROLE_LABELS] || item.actorRole,
      item.accessScope || 'Hồ sơ y tế & ADL',
      item.assignedAt ? new Date(item.assignedAt).toLocaleDateString('vi-VN') : '',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_Phan_Cong_Cham_Soc_TamAnCare_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  if (!actor) {
    return <EmptyState title="Chưa xác định người dùng" description="Vui lòng xác định phiên làm việc." />;
  }

  return (
    <div className="page-container" style={{ padding: '1.25rem 1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>
            <span>👥</span> Quản Trị Nhân Sự & Cấp Tài Khoản Đăng Nhập
          </h1>
          <p className="page-description" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
            Quản lý danh sách tài khoản, tạo ID và mật khẩu phân quyền theo cấp bậc, bàn giao thông tin đăng nhập và phân công phụ trách hồ sơ cư dân.
          </p>
        </div>

        {/* Clearance Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.95rem',
            borderRadius: '0.5rem',
            background: isAdmin ? '#fef2f2' : isDirector ? '#ecfdf5' : '#eff6ff',
            border: `1px solid ${isAdmin ? '#f87171' : isDirector ? '#a7f3d0' : '#bfdbfe'}`,
            fontSize: '0.82rem',
            fontWeight: 700,
            color: isAdmin ? '#b91c1c' : isDirector ? '#047857' : '#1e40af',
          }}
        >
          <span>{isAdmin ? '🛡️' : isDirector ? '👑' : '🔒'}</span>
          <span>
            {isAdmin
              ? 'Thẩm quyền: Quản trị viên Tối cao (Admin) - Toàn quyền 100% tất cả thông tin'
              : isDirector
              ? 'Thẩm quyền: Ban Giám đốc (Toàn quyền cấp ID & Password cho BGĐ, Quản lý & Nhân viên)'
              : 'Thẩm quyền: Quản lý (Cấp ID & Password cho Nhân viên cấp dưới)'}
          </span>
        </div>
      </div>

      {/* Authority Clearances Banner */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.1rem',
          marginBottom: '1.25rem',
          background: isAdmin ? '#fef2f2' : isDirector ? '#f0fdf4' : '#eff6ff',
          border: `1px solid ${isAdmin ? '#ef4444' : isDirector ? '#86efac' : '#93c5fd'}`,
          borderRadius: '0.65rem',
          color: isAdmin ? '#7f1d1d' : isDirector ? '#14532d' : '#1e3a8a',
          fontSize: '0.84rem',
          lineHeight: '1.5',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.2rem' }}>
          <span>{isAdmin ? '🛡️ QUY TRÌNH QUẢN TRỊ TỐI CAO (ADMIN)' : isDirector ? '🛡️ QUY TRÌNH BẢO MẬT BAN GIÁM ĐỐC' : '🛡️ QUY TRÌNH PHÂN QUYỀN QUẢN LÝ'}</span>
        </div>
        {isAdmin ? (
          <div>
            <b>Chỉ Quản trị viên (Admin) mới có toàn quyền truy cập và chỉnh sửa 100% tất cả các thông tin</b> trong toàn bộ hệ thống (kể cả tài khoản Ban Giám đốc, Quản lý và Nhân viên). Mọi hành động được lưu vết kiểm toán tối cao.
          </div>
        ) : isDirector ? (
          <div>
            Ban Giám đốc có quyền <b>tạo ID và Password</b> cho các thành viên trong Ban Giám đốc, Quản lý điều hành và toàn thể nhân viên. Mọi thao tác cấp mật khẩu đều được tự động lưu vết vào hệ thống truy vết kiểm toán <code>AuditTrail</code>.
          </div>
        ) : (
          <div>
            Quản lý có quyền <b>tạo ID và Password</b> cho các nhân viên ở các vị trí thuộc lĩnh vực quản lý vận hành (Điều dưỡng, Chăm sóc viên, Dinh dưỡng, Kế toán, Lễ tân, Tâm lý, CTXH, PHCN, Buồng phòng, An ninh). <b>Hệ thống tự động ngăn chặn Quản lý can thiệp hoặc sửa đổi tài khoản của Ban Giám đốc.</b>
          </div>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: feedback.includes('❌') ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${feedback.includes('❌') ? '#fecaca' : '#bbf7d0'}`,
            color: feedback.includes('❌') ? '#b91c1c' : '#15803d',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveMainTab('STAFF_ACCOUNTS')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              border: 'none',
              borderBottom: activeMainTab === 'STAFF_ACCOUNTS' ? '3px solid #166534' : '3px solid transparent',
              background: activeMainTab === 'STAFF_ACCOUNTS' ? '#f0fdf4' : 'transparent',
              color: activeMainTab === 'STAFF_ACCOUNTS' ? '#166534' : '#64748b',
              cursor: 'pointer',
              borderRadius: '0.4rem 0.4rem 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span>👥</span> 1. Danh Sách & Cấp Tài Khoản Nhân Sự ({staffQuery.data?.length ?? 0})
          </button>

          <button
            onClick={() => setActiveMainTab('RESIDENT_ACCESS')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              border: 'none',
              borderBottom: activeMainTab === 'RESIDENT_ACCESS' ? '3px solid #166534' : '3px solid transparent',
              background: activeMainTab === 'RESIDENT_ACCESS' ? '#f0fdf4' : 'transparent',
              color: activeMainTab === 'RESIDENT_ACCESS' ? '#166534' : '#64748b',
              cursor: 'pointer',
              borderRadius: '0.4rem 0.4rem 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span>📋</span> 2. Phân Quyền Tiếp Cận Hồ Sơ Cư Dân ({assignmentQuery.data?.length ?? 0})
          </button>
        </div>

        {/* CSV Export Button */}
        <div>
          {activeMainTab === 'STAFF_ACCOUNTS' ? (
            <button
              onClick={exportStaffAccountsCSV}
              className="btn btn-secondary"
              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700, fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
            >
              📥 Xuất Báo Cáo Nhân Sự Excel/CSV
            </button>
          ) : (
            <button
              onClick={exportResidentAssignmentsCSV}
              className="btn btn-secondary"
              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700, fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
            >
              📥 Xuất Báo Cáo Phân Công Excel/CSV
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: DANH SÁCH & CẤP TÀI KHOẢN NHÂN SỰ */}
      {activeMainTab === 'STAFF_ACCOUNTS' && (
        <div>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>TỔNG TÀI KHOẢN HỆ THỐNG</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                {staffQuery.data?.length ?? 0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>nhân sự</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                {staffQuery.data?.filter((s) => s.status === 'ACTIVE').length ?? 0} tài khoản đang hoạt động
              </div>
            </div>

            <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>BAN GIÁM ĐỐC & QUẢN LÝ</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e', margin: '0.2rem 0' }}>
                {staffQuery.data?.filter((s) => ['SUPERVISOR', 'CARE_MANAGER'].includes(s.primaryOperationalRole)).length ?? 0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>tài khoản</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Thẩm quyền điều hành & kiểm toán</div>
            </div>

            <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>Y TẾ & DINH DƯỠNG</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0369a1', margin: '0.2rem 0' }}>
                {staffQuery.data?.filter((s) => ['NURSE', 'NUTRITIONIST', 'REHABILITATION_SPECIALIST'].includes(s.primaryOperationalRole)).length ?? 0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>chuyên môn</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>Điều dưỡng, Dinh dưỡng, PHCN</div>
            </div>

            <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase' }}>CHĂM SÓC & HỖ TRỢ VẬN HÀNH</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', margin: '0.2rem 0' }}>
                {staffQuery.data?.filter((s) => ['CAREGIVER', 'ACCOUNTANT', 'RECEPTIONIST', 'PSYCHOLOGIST', 'SOCIAL_WORKER', 'HOUSEKEEPING', 'SECURITY'].includes(s.primaryOperationalRole)).length ?? 0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>nhân viên</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#047857' }}>Chăm sóc trực tiếp & hậu cần</div>
            </div>
          </div>

          {/* Filter & Action Toolbar */}
          <div
            className="card"
            style={{
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: '1', minWidth: '220px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Tìm kiếm nhân sự:
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Tìm theo họ tên, mã NV, Actor ID, SĐT, Email..."
                  style={{ height: '36px', padding: '0 0.6rem', width: '100%', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Vai trò hệ thống:
                </label>
                <select
                  className="text-input"
                  style={{ height: '36px', padding: '0 0.6rem', fontSize: '0.84rem' }}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                >
                  <option value="ALL">-- Tất cả vai trò ({Object.keys(ROLE_LABELS).length}) --</option>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v} ({k})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Trạng thái tài khoản:
                </label>
                <select
                  className="text-input"
                  style={{ height: '36px', padding: '0 0.6rem', fontSize: '0.84rem' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <option value="ALL">-- Tất cả trạng thái --</option>
                  <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                  <option value="SUSPENDED">Tạm khóa (SUSPENDED)</option>
                  <option value="INACTIVE">Ngừng hoạt động (INACTIVE)</option>
                </select>
              </div>
            </div>

            {/* Create Account Action */}
            {canManageStaff && (
              <button
                className="button-primary"
                onClick={handleOpenCreateModal}
                style={{
                  background: '#166534',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.45rem',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <span>+</span> Cấp Tài Khoản & Mật Khẩu Mới
              </button>
            )}
          </div>

          {/* Accounts Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Mã NV / Actor ID</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Họ & Tên Nhân Sự</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Bộ Phận / Phòng Ban</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Vai Trò Hệ Thống</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Email & Điện Thoại</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Thao Tác Quản Trị</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                        Không tìm thấy tài khoản nhân sự nào phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((item) => {
                      const isAdminAccount = item.primaryOperationalRole === 'ADMIN';
                      const isDirectorAccount = item.primaryOperationalRole === 'SUPERVISOR';
                      const canManageThisAccount = isAdmin || (isDirector && !isAdminAccount) || (!isDirectorAccount && !isAdminAccount && isManager);

                      return (
                        <tr key={item.actorId} style={{ borderBottom: '1px solid #f1f5f9', background: isAdminAccount ? '#fef2f2' : isDirectorAccount ? '#fffdf7' : '#ffffff' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{item.actorId}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mã NV: <b>{item.staffCode}</b></div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{item.displayName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Tham chiếu: {item.employmentReference ?? 'Hợp đồng chính thức'}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ color: '#334155' }}>{item.department}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '0.4rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: isAdminAccount ? '#fee2e2' : isDirectorAccount ? '#fef3c7' : item.primaryOperationalRole === 'CARE_MANAGER' ? '#eff6ff' : item.primaryOperationalRole === 'NURSE' ? '#e0f2fe' : '#f1f5f9',
                                color: isAdminAccount ? '#b91c1c' : isDirectorAccount ? '#92400e' : item.primaryOperationalRole === 'CARE_MANAGER' ? '#1e40af' : item.primaryOperationalRole === 'NURSE' ? '#0369a1' : '#334155',
                              }}
                            >
                              {ROLE_LABEL[item.primaryOperationalRole] || item.primaryOperationalRole}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontSize: '0.8rem', color: '#0f172a' }}>{item.email}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.phone}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.35rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: item.status === 'ACTIVE' ? '#dcfce7' : item.status === 'SUSPENDED' ? '#fee2e2' : '#f1f5f9',
                                color: item.status === 'ACTIVE' ? '#15803d' : item.status === 'SUSPENDED' ? '#b91c1c' : '#64748b',
                              }}
                            >
                              {STATUS_LABEL[item.status] || item.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            {canManageThisAccount ? (
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {/* Handover Modal button */}
                                <button
                                  onClick={() => setShowHandoverModal(item)}
                                  title="Bàn giao tài khoản & In phiếu"
                                  style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #86efac',
                                    color: '#166534',
                                    padding: '0.28rem 0.6rem',
                                    borderRadius: '0.35rem',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  📋 Bàn Giao
                                </button>

                                {/* Reset Password button */}
                                <button
                                  onClick={() => {
                                    setNewResetPassword(generateSecurePassword());
                                    setShowResetModal(item);
                                  }}
                                  title="Đặt lại mật khẩu"
                                  style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#1e40af',
                                    padding: '0.28rem 0.6rem',
                                    borderRadius: '0.35rem',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  🔑 Đổi MK
                                </button>

                                {/* Lock/Unlock button (Admin account cannot be locked) */}
                                {!isAdminAccount && (
                                  <button
                                    onClick={() => toggleStatusMutation.mutate({ actorId: item.actorId, currentStatus: item.status })}
                                    title={item.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                    style={{
                                      background: item.status === 'ACTIVE' ? '#fef2f2' : '#ecfdf5',
                                      border: `1px solid ${item.status === 'ACTIVE' ? '#fecaca' : '#a7f3d0'}`,
                                      color: item.status === 'ACTIVE' ? '#b91c1c' : '#047857',
                                      padding: '0.28rem 0.6rem',
                                      borderRadius: '0.35rem',
                                      fontSize: '0.76rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {item.status === 'ACTIVE' ? '🔒 Khóa' : '🔓 Mở'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '0.4rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  background: isAdminAccount ? '#fee2e2' : '#fef3c7',
                                  color: isAdminAccount ? '#b91c1c' : '#92400e',
                                  border: `1px solid ${isAdminAccount ? '#fca5a5' : '#fde68a'}`,
                                }}
                              >
                                {isAdminAccount ? '🔒 Quyền Admin' : '🔒 Quyền Ban Giám Đốc'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PHÂN QUYỀN TIẾP CẬN HỒ SƠ CƯ DÂN */}
      {activeMainTab === 'RESIDENT_ACCESS' && (
        <div>
          {/* Create Assignment Box — Only SUPERVISOR / CARE_MANAGER / ADMIN */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
                  ➕ Chỉ Định Nhân Sự Phụ Trách Hồ Sơ Người Cao Tuổi
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Chỉ định Điều dưỡng hoặc Nhân viên chăm sóc phụ trách cụ thể từng cụ để mở quyền truy cập hồ sơ y tế và nhật ký chăm sóc.
                </p>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                background: (isDirector || isManager) ? '#dcfce7' : '#fef3c7',
                color: (isDirector || isManager) ? '#166534' : '#92400e',
                border: `1px solid ${(isDirector || isManager) ? '#86efac' : '#fde68a'}`,
                borderRadius: '0.4rem', padding: '0.25rem 0.65rem', fontSize: '0.78rem', fontWeight: 700,
              }}>
                {(isDirector || isManager)
                  ? '✅ Bạn có quyền phân công nhân sự'
                  : '🔒 Chỉ Ban Giám đốc & Quản lý được phân công'}
              </span>
            </div>

            {/* Gate: only SUPERVISOR, CARE_MANAGER, ADMIN can submit assignment */}
            {(isDirector || isManager) ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', alignItems: 'flex-end', marginTop: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                    Người cao tuổi:
                  </label>
                  <select
                    className="text-input"
                    style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                    value={residentId}
                    onChange={(e) => setResidentId(e.target.value)}
                  >
                    <option value="">-- Chọn người cao tuổi --</option>
                    {(residentsQuery.data ?? []).map(({ resident: r }) => (
                      <option key={r.residentId} value={r.residentId}>
                        {r.displayName} ({r.residentCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                    Nhân sự phụ trách:
                  </label>
                  <select
                    className="text-input"
                    style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                    value={assignmentActorId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAssignmentActorId(next);
                      const selected = assignableStaff.find((item) => item.actorId === next);
                      if (selected) {
                        if (selected.primaryOperationalRole === 'NURSE') setAssignmentRole('NURSE');
                        else setAssignmentRole('CAREGIVER');
                      }
                    }}
                  >
                    <option value="">-- Chọn nhân sự --</option>
                    {assignableStaff.map((item) => (
                      <option key={item.actorId} value={item.actorId}>
                        {item.displayName} ({item.staffCode}) — {ROLE_LABEL[item.primaryOperationalRole]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                    Vai trò phân công:
                  </label>
                  <select
                    className="text-input"
                    style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                    value={assignmentRole}
                    onChange={(e) => setAssignmentRole(e.target.value as AssignmentRole)}
                  >
                    <option value="CAREGIVER">Nhân viên chăm sóc</option>
                    <option value="NURSE">Điều dưỡng</option>
                  </select>
                </div>

                <div>
                  <button
                    type="button"
                    className="button-primary"
                    disabled={createAssignmentMutation.isPending || !residentId || !assignmentActorId}
                    onClick={() => setShowConfirmAssignModal(true)}
                    style={{
                      width: '100%',
                      height: '38px',
                      background: '#166534',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.45rem',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                    }}
                  >
                    {createAssignmentMutation.isPending ? 'Đang tạo…' : 'Xác Nhận Phân Công'}
                  </button>
                </div>
              </div>
            ) : (
              /* Read-only notice for non-authorized roles */
              <div style={{
                marginTop: '1rem', background: '#fef9c3', border: '1px solid #fde68a',
                borderRadius: '0.5rem', padding: '0.85rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              }}>
                <span style={{ fontSize: '1.2rem' }}>🔒</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                    Không có quyền phân công nhân sự phụ trách
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.5 }}>
                    Chức năng này chỉ dành cho <strong>Ban Giám đốc</strong> và <strong>Quản lý</strong>.
                    Nếu cần chỉnh sửa phân công, vui lòng liên hệ cấp quản lý trực tiếp.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Assignments List — Optimised Dual View */}
          <div className="card" style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>

            {/* ── Header + KPI bar ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                  {(isDirector || isManager)
                    ? '📊 Bảng Tổng Hợp Phân Công Nhân Sự'
                    : '📋 Danh Sách Người Cao Tuổi Tôi Phụ Trách'}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  {(isDirector || isManager)
                    ? 'Toàn bộ phân công hiện có — lọc, tìm kiếm theo nhân sự hoặc cư dân.'
                    : 'Danh sách người cao tuổi bạn đang được phân công theo dõi và chăm sóc.'}
                </p>
              </div>

              {/* KPI mini-bar — only for supervisor/manager */}
              {(isDirector || isManager) && assignmentQuery.isSuccess && (() => {
                const all = assignmentQuery.data;
                const active = all.filter(a => a.status === 'ACTIVE');
                const staffWithAssignment = new Set(active.map(a => a.actorId)).size;
                return (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Phân công hiệu lực', value: active.length, color: '#15803d', bg: '#dcfce7', border: '#86efac' },
                      { label: 'Nhân sự có phân công', value: staffWithAssignment, color: '#0369a1', bg: '#dbeafe', border: '#93c5fd' },
                      { label: 'Đã thu hồi', value: all.length - active.length, color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
                    ].map(kpi => (
                      <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.border}`, borderRadius: '0.45rem', padding: '0.35rem 0.75rem', textAlign: 'center', minWidth: '90px' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                        <div style={{ fontSize: '0.68rem', color: kpi.color, fontWeight: 600, marginTop: '0.15rem' }}>{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {assignmentQuery.isLoading && <LoadingState title="Đang tải phân công" description="Đang lấy dữ liệu..." />}
            {assignmentQuery.isError && <ErrorState title="Lỗi tải phân công" description={errorText(assignmentQuery.error, 'Không thể tải.')} />}

            {assignmentQuery.isSuccess && (() => {
              const allAssignments = assignmentQuery.data;

              /* ── STAFF SELF-VIEW: chỉ xem phân công của chính mình ── */
              if (!isDirector && !isManager) {
                const myAssignments = allAssignments.filter(
                  a => a.actorId === actor.actorId && a.status === 'ACTIVE'
                );
                if (myAssignments.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                      Bạn chưa được phân công chăm sóc người cao tuổi nào.
                    </div>
                  );
                }
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f0fdf4' }}>
                          <th style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #86efac', textAlign: 'left', color: '#166534', fontWeight: 700 }}>Người cao tuổi</th>
                          <th style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #86efac', textAlign: 'left', color: '#166534', fontWeight: 700 }}>Vai trò phụ trách</th>
                          <th style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #86efac', textAlign: 'left', color: '#166534', fontWeight: 700 }}>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myAssignments.map((a, i) => (
                          <tr key={a.residentAccessAssignmentId} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>
                              👤 {residentMap.get(a.residentId) || a.residentId}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem' }}>
                              <span style={{
                                display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.78rem', fontWeight: 700,
                                background: a.actorRole === 'NURSE' ? '#dbeafe' : '#f0fdf4',
                                color: a.actorRole === 'NURSE' ? '#1e40af' : '#166534',
                                border: `1px solid ${a.actorRole === 'NURSE' ? '#93c5fd' : '#86efac'}`,
                              }}>
                                {a.actorRole === 'NURSE' ? '🩺 Điều dưỡng' : '🤝 Chăm sóc viên'}
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem' }}>
                              <span style={{ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: '0.3rem', fontSize: '0.75rem', fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                                ✅ Đang hiệu lực
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              /* ── SUPERVISOR / MANAGER VIEW: grouped-by-staff table ── */

              // Build grouped structure: staffId → { staffInfo, residents[] }
              type GroupedEntry = {
                actorId: string;
                staffName: string;
                actorRole: string;
                residents: typeof allAssignments;
              };

              // Filters state is managed inline via URL-style search below
              const activeOnly = allAssignments.filter(a => a.status === 'ACTIVE');
              const revoked = allAssignments.filter(a => a.status !== 'ACTIVE');

              // Group active assignments by staff
              const groupedByStaff = new Map<string, GroupedEntry>();
              activeOnly.forEach(a => {
                if (!groupedByStaff.has(a.actorId)) {
                  groupedByStaff.set(a.actorId, {
                    actorId: a.actorId,
                    staffName: staffMap.get(a.actorId) || a.actorId,
                    actorRole: a.actorRole,
                    residents: [],
                  });
                }
                groupedByStaff.get(a.actorId)!.residents.push(a);
              });

              const grouped = Array.from(groupedByStaff.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));

              return (
                <div>
                  {/* ── Active assignments grouped by staff ── */}
                  {grouped.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                      Chưa có phân công nào đang hiệu lực.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Nhân sự phụ trách</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Vai trò</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Người cao tuổi phụ trách</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Số cụ</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grouped.map((group, gi) => (
                            group.residents.map((a, ri) => (
                              <tr
                                key={a.residentAccessAssignmentId}
                                style={{ background: gi % 2 === 0 ? '#f8fafc' : '#f0f9ff', borderBottom: '1px solid #e2e8f0' }}
                              >
                                {/* Staff name — rowspan effect via conditional render */}
                                {ri === 0 ? (
                                  <td
                                    rowSpan={group.residents.length}
                                    style={{ padding: '0.55rem 0.75rem', fontWeight: 700, color: '#0f172a', verticalAlign: 'middle', borderRight: '2px solid #e2e8f0', background: gi % 2 === 0 ? '#f0fdf4' : '#e0f2fe' }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span style={{ fontSize: '1.1rem' }}>👤</span>
                                      <span>{group.staffName}</span>
                                    </div>
                                  </td>
                                ) : null}

                                {/* Role badge — rowspan */}
                                {ri === 0 ? (
                                  <td
                                    rowSpan={group.residents.length}
                                    style={{ padding: '0.55rem 0.75rem', verticalAlign: 'middle', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}
                                  >
                                    <span style={{
                                      display: 'inline-block', padding: '0.25rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.78rem', fontWeight: 700,
                                      background: group.actorRole === 'NURSE' ? '#dbeafe' : '#f0fdf4',
                                      color: group.actorRole === 'NURSE' ? '#1e40af' : '#166534',
                                      border: `1px solid ${group.actorRole === 'NURSE' ? '#93c5fd' : '#86efac'}`,
                                    }}>
                                      {group.actorRole === 'NURSE' ? '🩺 Điều dưỡng' : '🤝 Chăm sóc viên'}
                                    </span>
                                  </td>
                                ) : null}

                                {/* Resident name */}
                                <td style={{ padding: '0.5rem 0.75rem', color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                                  <span style={{ fontWeight: 600 }}>
                                    {residentMap.get(a.residentId) || a.residentId}
                                  </span>
                                </td>

                                {/* Count — rowspan */}
                                {ri === 0 ? (
                                  <td
                                    rowSpan={group.residents.length}
                                    style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, fontSize: '1.05rem', color: '#0369a1', borderRight: '1px solid #e2e8f0' }}
                                  >
                                    {group.residents.length}
                                  </td>
                                ) : null}

                                {/* Revoke button */}
                                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                                  {(isDirector || isManager) && (
                                    <button
                                      type="button"
                                      disabled={revokeAssignmentMutation.isPending}
                                      onClick={() => revokeAssignmentMutation.mutate(a.residentAccessAssignmentId)}
                                      title="Thu hồi phân công này"
                                      style={{
                                        background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
                                        padding: '0.25rem 0.55rem', borderRadius: '0.35rem',
                                        fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap',
                                      }}
                                    >
                                      ✕ Thu hồi
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── Revoked assignments collapsible section ── */}
                  {revoked.length > 0 && (
                    <details style={{ marginTop: '1rem' }}>
                      <summary style={{
                        cursor: 'pointer', padding: '0.5rem 0.75rem', background: '#f8fafc',
                        border: '1px solid #e2e8f0', borderRadius: '0.45rem', fontSize: '0.82rem',
                        fontWeight: 700, color: '#64748b', userSelect: 'none',
                      }}>
                        🗂️ Lịch sử đã thu hồi ({revoked.length} phân công) — Nhấn để xem
                      </summary>
                      <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Nhân sự</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Vai trò</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Người cao tuổi</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {revoked.map((a, i) => (
                              <tr key={a.residentAccessAssignmentId} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', opacity: 0.7 }}>
                                <td style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>{staffMap.get(a.actorId) || a.actorId}</td>
                                <td style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>{ROLE_LABEL[a.actorRole] || a.actorRole}</td>
                                <td style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>{residentMap.get(a.residentId) || a.residentId}</td>
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                                  <span style={{ display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', fontSize: '0.72rem', fontWeight: 700, background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>
                                    Đã thu hồi
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* MODAL 1: CẤP TÀI KHOẢN & MẬT KHẨU MỚI */}
      {showCreateModal && (
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
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>👥</span> Cấp Tài Khoản & Mật Khẩu Đăng Nhập
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Vai trò hệ thống:
                </label>
                <select
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontWeight: 700 }}
                  value={formRole}
                  onChange={(e) => handleRoleChangeInForm(e.target.value as HumanActorRole)}
                >
                  {Object.entries(ROLE_LABELS)
                    .filter(([roleKey]) => {
                      // Chỉ Admin mới được tạo tài khoản ADMIN
                      if (!isAdmin && roleKey === 'ADMIN') return false;
                      // Nếu không phải Ban Giám đốc hoặc Admin, KHÔNG hiển thị vai trò SUPERVISOR
                      if (!isDirector && roleKey === 'SUPERVISOR') return false;
                      return true;
                    })
                    .map(([roleKey, roleName]) => (
                      <option key={roleKey} value={roleKey}>
                        {roleName} ({roleKey})
                      </option>
                    ))}
                </select>
                {!isAdmin && (
                  <div style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '0.2rem' }}>
                    {isDirector
                      ? '* Ban Giám đốc có quyền tạo tài khoản Ban Giám đốc, Quản lý và Nhân viên (Chỉ Admin mới tạo tài khoản Admin).'
                      : '* Theo phân cấp bảo mật, Quản lý chỉ có quyền tạo tài khoản cho nhân viên cấp dưới.'}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Họ và tên nhân sự:
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="VD: Hoàng Văn Nam"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Bộ phận / Phòng ban:
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Mã nhân viên (Staff Code):
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={formStaffCode}
                  onChange={(e) => setFormStaffCode(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Tên đăng nhập (Actor ID):
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontWeight: 700 }}
                  value={formActorId}
                  onChange={(e) => setFormActorId(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Email nhận thông tin:
                </label>
                <input
                  type="email"
                  className="text-input"
                  placeholder="nhansu@tamancare.vn"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Số điện thoại:
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="0912 345 678"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box' }}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>

              {/* Password Generator */}
              <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>
                    🔑 Mật khẩu đăng nhập khởi tạo:
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormPassword(generateSecurePassword())}
                    style={{
                      background: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #86efac',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🎲 Sinh mật khẩu an toàn
                  </button>
                </div>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: '#166534' }}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formRequireChange}
                    onChange={(e) => setFormRequireChange(e.target.checked)}
                  />
                  <span>Bắt buộc nhân sự đổi mật khẩu trong lần đăng nhập đầu tiên</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '0.5rem 1.25rem',
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
                type="button"
                onClick={() => createAccountMutation.mutate()}
                disabled={createAccountMutation.isPending || !formDisplayName.trim()}
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
                {createAccountMutation.isPending ? 'Đang khởi tạo...' : '✓ Xác Nhận & Cấp Tài Khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BÀN GIAO THÔNG TIN TÀI KHOẢN & MẬT KHẨU */}
      {showHandoverModal && (
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
              maxWidth: '620px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #166534', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>VIỆN DƯỠNG LÃO TÂM AN CARE — BẢO MẬT & PHÂN QUYỀN</div>
                <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', color: '#0f172a' }}>PHIẾU BÀN GIAO TÀI KHOẢN ĐĂNG NHẬP</h2>
              </div>
              <button
                onClick={() => setShowHandoverModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Credential Slip Content */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.86rem', marginBottom: '1rem' }}>
                <div>Họ và tên: <b style={{ color: '#0f172a' }}>{showHandoverModal.displayName}</b></div>
                <div>Bộ phận: <b>{showHandoverModal.department}</b></div>
                <div>Mã nhân viên: <b>{showHandoverModal.staffCode}</b></div>
                <div>Vai trò: <b style={{ color: '#166534' }}>{ROLE_LABEL[showHandoverModal.primaryOperationalRole]}</b></div>
              </div>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.85rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600 }}>TÊN ĐĂNG NHẬP / ACTOR ID:</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', margin: '0.2rem 0' }}>
                  {showHandoverModal.actorId}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600, marginTop: '0.5rem' }}>MẬT KHẨU KHỞI TẠO:</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#166534', fontFamily: 'monospace', margin: '0.2rem 0' }}>
                  {showHandoverModal.initialPassword || 'TamAn@2026#Secure'}
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: '1.5' }}>
                🔗 <b>Đường link truy cập:</b> {window.location.origin}<br />
                🔒 <b>Bảo mật:</b> Vui lòng gửi thông tin này riêng tư cho nhân sự. Nhân sự có trách nhiệm bảo mật và đổi mật khẩu ở lần đăng nhập đầu tiên.
              </div>
            </div>

            {copyFeedback && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.82rem', fontWeight: 600, marginBottom: '1rem' }}>
                {copyFeedback}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleCopyCredentials(showHandoverModal)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #166534',
                  background: '#f0fdf4',
                  color: '#166534',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>📋</span> Sao Chép Tin Nhắn (Zalo / Email)
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🖨️</span> In Phiếu Cấp Tài Khoản
              </button>

              <button
                type="button"
                onClick={() => setShowHandoverModal(null)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  background: '#166534',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ĐẶT LẠI MẬT KHẨU (RESET PASSWORD) */}
      {showResetModal && (
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
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔑</span> Đặt Lại Mật Khẩu Truy Cập
              </h2>
              <button
                onClick={() => setShowResetModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div>Nhân sự: <b style={{ color: '#0f172a' }}>{showResetModal.displayName}</b></div>
              <div>Tên đăng nhập (ID): <b style={{ fontFamily: 'monospace' }}>{showResetModal.actorId}</b></div>
              <div>Vai trò: <b>{ROLE_LABEL[showResetModal.primaryOperationalRole]}</b></div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                  Mật khẩu mới:
                </label>
                <button
                  type="button"
                  onClick={() => setNewResetPassword(generateSecurePassword())}
                  style={{
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.35rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🎲 Sinh mật khẩu ngẫu nhiên
                </button>
              </div>
              <input
                type="text"
                className="text-input"
                style={{ width: '100%', height: '38px', padding: '0 0.6rem', boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: '#1e40af' }}
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(null)}
                style={{
                  padding: '0.5rem 1.25rem',
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
                type="button"
                onClick={() => resetPasswordMutation.mutate()}
                disabled={resetPasswordMutation.isPending || !newResetPassword.trim()}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  background: '#1e40af',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {resetPasswordMutation.isPending ? 'Đang lưu...' : '✓ Xác Nhận Đặt Lại Mật Khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}\n
      {/* ================================================================= */}
      {/* MODAL XÁC NHẬN PHÂN CÔNG NHÂN SỰ PHỤ TRÁCH                        */}
      {/* ================================================================= */}
      {showConfirmAssignModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmAssignModal(false); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: '0.75rem',
              maxWidth: '480px', width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ background: '#1e3a5f', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🔍</span>
                <h2 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 700 }}>
                  Xác nhận phân công nhân sự phụ trách
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmAssignModal(false)}
                style={{ background: 'none', border: 'none', color: '#93c5fd', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', color: '#475569' }}>
                Vui lòng kiểm tra lại thông tin phân công bên dưới trước khi xác nhận:
              </p>

              {/* Summary card */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.55rem', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 0.75rem', fontSize: '0.87rem', alignItems: 'start' }}>
                  <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Người cao tuổi:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    👤 {residentMap.get(residentId) || residentId || '—'}
                  </span>

                  <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Nhân sự phụ trách:</span>
                  <span style={{ fontWeight: 700, color: '#0369a1' }}>
                    {staffMap.get(assignmentActorId) || assignmentActorId || '—'}
                  </span>

                  <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Vai trò phân công:</span>
                  <span>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: '0.35rem', fontSize: '0.8rem', fontWeight: 700,
                      background: assignmentRole === 'NURSE' ? '#dbeafe' : '#f0fdf4',
                      color: assignmentRole === 'NURSE' ? '#1e40af' : '#166534',
                      border: `1px solid ${assignmentRole === 'NURSE' ? '#93c5fd' : '#86efac'}`,
                    }}>
                      {assignmentRole === 'NURSE' ? '🩺 Điều dưỡng' : '🤝 Chăm sóc viên'}
                    </span>
                  </span>

                  <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Người phân công:</span>
                  <span style={{ fontWeight: 600, color: '#166534' }}>
                    ✅ {actor.displayName} ({ROLE_LABEL[actor.actorRole] || actor.actorRole})
                  </span>
                </div>
              </div>

              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: '#92400e', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '0.4rem', padding: '0.6rem 0.8rem' }}>
                ⚠️ Sau khi xác nhận, nhân viên này sẽ có quyền truy cập hồ sơ y tế và nhật ký chăm sóc của người cao tuổi nêu trên.
              </p>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmAssignModal(false)}
                  style={{
                    padding: '0.55rem 1.2rem', borderRadius: '0.45rem',
                    background: '#f1f5f9', border: '1px solid #cbd5e1',
                    color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                  }}
                >
                  Huỷ, kiểm tra lại
                </button>
                <button
                  type="button"
                  disabled={createAssignmentMutation.isPending}
                  onClick={() => {
                    setShowConfirmAssignModal(false);
                    createAssignmentMutation.mutate();
                  }}
                  style={{
                    padding: '0.55rem 1.4rem', borderRadius: '0.45rem',
                    background: '#166534', border: 'none',
                    color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}
                >
                  {createAssignmentMutation.isPending ? '⏳ Đang xử lý...' : '✅ Xác nhận, tiến hành phân công'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default StaffAccessPage;
