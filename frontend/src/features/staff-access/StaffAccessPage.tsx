import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerPrint } from '../../utils/print';
import type { HumanActorRole } from '../../types/actor';
import {
  listStaffActors,
  createStaffAccount,
  resetStaffPassword,
  updateStaffStatus,
  deleteStaffAccount,
  generateSecurePassword,
  getNextSequentialStaffCode,
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
import { pushInAppNotification, sendSystemNotification } from '../../api/notifications';

import {
  fetchStaffKPIEvaluations,
  submitStaffKPIEvaluation,
  synthesizeStaffKPI,
  publishPeriodKPIHonorNotices,
  DEFAULT_KPI_CRITERIA_BY_GROUP,
  JOB_GROUP_LABELS,
  JobGroup,
  KPICriterionResult,
  StaffKPIEvaluationRecord,
  KPISynthesisSummary,
} from '../../api/kpi-evaluation';

import {
  fetchStaffRecognitions,
  createStaffRecognition,
  fetchWorkforceKpiSummary,
  StaffRecognition,
} from '../../api/workforce';

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


function exportKPISynthesisCSV(summary: KPISynthesisSummary): void {
  const items = Array.isArray(summary.items) ? summary.items : [];

  if (items.length === 0) {
    window.alert('Không có dữ liệu KPI trong kỳ đã chọn để xuất báo cáo.');
    return;
  }

  const rows = items.map((item) => item as unknown as Record<string, unknown>);

  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  );

  const csvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';

    let text: string;

    if (typeof value === 'object') {
      try {
        text = JSON.stringify(value);
      } catch {
        text = String(value);
      }
    } else {
      text = String(value);
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

  const csvLines = [
    columns.map(csvCell).join(','),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column])).join(',')
    ),
  ];

  // UTF-8 BOM để Excel trên Windows/macOS hiển thị tiếng Việt đúng.
  const csvContent = '\uFEFF' + csvLines.join('\r\n');

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  const summaryRecord = summary as unknown as Record<string, unknown>;
  const periodValue = String(summaryRecord.periodValue ?? 'KPI')
    .replace(/[^a-zA-Z0-9_-]/g, '-');

  anchor.href = url;
  anchor.download = `TamAnCare_KPI_${periodValue}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

export function StaffAccessPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  // Active Sub-tab
  const [activeMainTab, setActiveMainTab] = useState<'STAFF_ACCOUNTS' | 'RESIDENT_ACCESS' | 'KPI_EVALUATION' | 'RECOGNITION_HONOR'>('STAFF_ACCOUNTS');

  // KPI Sub-tab Modes
  const [kpiSubMode, setKpiSubMode] = useState<'DAILY_CHECKLIST' | 'PERIOD_SYNTHESIS' | 'FACILITY_OVERVIEW'>('DAILY_CHECKLIST');

  // State cho Đánh giá KPI Ca/Ngày dạng Checklist
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [kpiStaffId, setKpiStaffId] = useState<string>('');
  const [kpiStaffName, setKpiStaffName] = useState<string>('');
  const [kpiJobGroup, setKpiJobGroup] = useState<JobGroup>('CAREGIVER');
  const [kpiShiftDate, setKpiShiftDate] = useState<string>(todayStr);
  const [kpiShiftName, setKpiShiftName] = useState<string>('Ca Sáng (06:00 - 14:00)');
  const [kpiTickResults, setKpiTickResults] = useState<Record<string, 'PASSED' | 'FAILED' | 'EXCELLENT'>>({});
  const [kpiEvaluationNotes, setKpiEvaluationNotes] = useState<string>('');

  // State cho Tổng Hợp KPI Theo Kỳ (Tháng/Quý/Năm)
  const [synthesisPeriodType, setSynthesisPeriodType] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [synthesisPeriodValue, setSynthesisPeriodValue] = useState<string>('2026-09');
  const [synthesisJobGroupFilter, setSynthesisJobGroupFilter] = useState<string>('ALL');

  // State cho Khen Thưởng & Thành Tích Tab
  const [recogSearch, setRecogSearch] = useState('');
  const [recogTypeFilter, setRecogTypeFilter] = useState('ALL');
  const [showRecogModal, setShowRecogModal] = useState(false);
  const [formRecogStaffId, setFormRecogStaffId] = useState('');
  const [formRecogType, setFormRecogType] = useState<'COMMENDATION' | 'SPECIAL_ACHIEVEMENT' | 'EFFORT_RECOGNITION' | 'SAFETY_AWARD' | 'DISCIPLINE_WARNING'>('COMMENDATION');
  const [formRecogTitle, setFormRecogTitle] = useState('');
  const [formRecogDesc, setFormRecogDesc] = useState('');
  const [formRecogBonus, setFormRecogBonus] = useState(15);
  const [formRecogDate, setFormRecogDate] = useState(todayStr);

  // Permissions
  const isAdmin = actor?.actorRole === 'ADMIN';
  const isDirector = actor?.actorRole === 'SUPERVISOR' || isAdmin;
  const isManager = actor?.actorRole === 'CARE_MANAGER';
  const canManageStaff = hasCapability(actor?.actorRole, 'canManageStaff');
  const canManageDirector = hasCapability(actor?.actorRole, 'canManageDirectorStaff');
  const canDeleteStaff = hasCapability(actor?.actorRole, 'canDeleteStaff');

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

  const kpiEvaluationsQuery = useQuery({
    queryKey: ['staff-kpi-evaluations'],
    enabled: Boolean(actor),
    queryFn: () => fetchStaffKPIEvaluations(),
  });

  const recognitionsQuery = useQuery({
    queryKey: ['staff-recognitions', actor?.actorId ?? 'anonymous'],
    enabled: Boolean(actor),
    queryFn: () => fetchStaffRecognitions(actor?.actorId || '', actor?.actorRole || ''),
  });

  const workforceKpiQuery = useQuery({
    queryKey: ['workforce-kpi-summary', actor?.actorId ?? 'anonymous'],
    enabled: Boolean(actor),
    queryFn: () => fetchWorkforceKpiSummary(actor?.actorId || '', actor?.actorRole || ''),
  });

  const submitKpiMutation = useMutation({
    mutationFn: (input: {
      staffId: string;
      staffName: string;
      jobGroup: JobGroup;
      shiftDate: string;
      shiftName: string;
      results: KPICriterionResult[];
      notes?: string;
    }) => submitStaffKPIEvaluation(actor!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-kpi-evaluations'] });
      setFeedback('✅ Đã lưu kết quả đánh giá KPI ca trực, tự động phát Bell Notice & ghi nhận vào hệ thống!');
      setKpiTickResults({});
      setKpiEvaluationNotes('');
    },
    onError: (err: any) => setFeedback(`❌ Lỗi đánh giá KPI: ${err.message}`),
  });

  const createRecogMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await createStaffRecognition(actor?.actorId || '', actor?.actorRole || '', payload);
      const targetStaff = staffQuery.data?.find((s) => s.actorId === payload.staffActorId);
      const targetName = targetStaff?.displayName || payload.staffActorId;

      if (payload.recognitionType !== 'DISCIPLINE_WARNING') {
        // Gửi Bell Notice thông báo TOÀN THỂ nhân viên Tâm An khi cá nhân có thành tích hoặc khen thưởng
        await sendSystemNotification({
          title: `🌟 VINH DANH KHEN THƯỞNG: ${payload.title}`,
          message: `Tâm An Care trân trọng vinh danh & khen thưởng Nhân viên ${targetName}: ${payload.description}`,
          type: 'HONOR_NOTICE',
          severity: 'INFO',
          isGlobal: true, // Gửi Bell notice toàn viện
        });
      } else {
        // Cảnh báo cá nhân riêng cho nhân viên
        await sendSystemNotification({
          targetStaffId: payload.staffActorId,
          title: `⚠️ BIÊN BẢN NHẮC NHỞ KỶ LUẬT: ${payload.title}`,
          message: `Quản lý ${actor?.displayName} đã lập biên bản nhắc nhở: ${payload.description}`,
          type: 'WARNING_NOTICE',
          severity: 'HIGH',
          isGlobal: false,
        });
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-recognitions'] });
      setShowRecogModal(false);
      setFormRecogStaffId('');
      setFormRecogTitle('');
      setFormRecogDesc('');
      setFeedback('🎉 Đã trao Khen thưởng / Nhắc nhở thành công & phát Bell Notice toàn viện!');
    },
    onError: (err: any) => setFeedback(`❌ Lỗi ghi nhận khen thưởng: ${err.message}`),
  });

  // Modal States for Staff Account Management
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState<StaffActor | null>(null);
  const [showResetModal, setShowResetModal] = useState<StaffActor | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<StaffActor | null>(null);

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

  // Auto-fill codes sequentially when role or name changes
  const handleRoleChangeInForm = (nextRole: HumanActorRole) => {
    setFormRole(nextRole);
    const prefixMap: Record<HumanActorRole, { prefix: string; dept: string }> = {
      ADMIN: { prefix: 'ADM', dept: 'Ban Quản Trị Hệ Thống' },
      SUPERVISOR: { prefix: 'DIR', dept: 'Ban Giám đốc' },
      CARE_MANAGER: { prefix: 'MGR', dept: 'Khối Quản Lý Vận Hành' },
      NURSE: { prefix: 'NUR', dept: 'Khối Y Tế' },
      CAREGIVER: { prefix: 'CG', dept: 'Khối Chăm Sóc Trực Tiếp' },
      NUTRITIONIST: { prefix: 'NUT', dept: 'Bộ Phận Dinh Dưỡng & Bếp Ăn' },
      ACCOUNTANT: { prefix: 'ACC', dept: 'Phòng Kế Toán & Viện Phí' },
      RECEPTIONIST: { prefix: 'REC', dept: 'Bộ Phận Lễ Tân & Tiếp Đón' },
      PSYCHOLOGIST: { prefix: 'PSY', dept: 'Tư Vấn & Trị Liệu Tâm Lý' },
      SOCIAL_WORKER: { prefix: 'SW', dept: 'Công Tác Xã Hội & Đời Sống' },
      REHABILITATION_SPECIALIST: { prefix: 'REH', dept: 'Vật Lý Trị Liệu & PHCN' },
      COMMUNICATIONS: { prefix: 'COM', dept: 'Bộ Phận Truyền Thông & Marketing' },
      HOUSEKEEPING: { prefix: 'HK', dept: 'Bộ Phận Buồng Phòng & Tạp Vụ' },
      SECURITY: { prefix: 'SEC', dept: 'Đội An Ninh & Trật Tự' },
      GUARDIAN: { prefix: 'GUA', dept: 'Cổng Thân Nhân' },
    };

    const config = prefixMap[nextRole] || { prefix: 'STF', dept: 'Vận Hành & Chăm Sóc' };
    const seq = getNextSequentialStaffCode(nextRole, staffQuery.data || []);
    setFormStaffCode(seq.staffCode);
    setFormActorId(seq.actorId);
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

  // Delete Staff Account Mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (targetStaff: StaffActor) => {
      if (!actor) throw new Error('Chưa đăng nhập');
      return deleteStaffAccount(actor, targetStaff.actorId);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['staff-actors'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setShowDeleteConfirmModal(null);
      setFeedback(`✅ Đã xoá/bớt tài khoản nhân sự ${res.deletedActor.displayName} (${res.deletedActor.actorId}) khỏi hệ thống thành công.`);
    },
    onError: (err) => {
      setFeedback(`❌ Lỗi: ${errorText(err, 'Không thể xoá tài khoản nhân sự')}`);
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
    const text = `[TRUNG TÂM DƯỠNG LÃO TÂM AN CARE - THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP]
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

      {/* Navigation Sub-Tabs (Block Cards Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          {
            id: 'STAFF_ACCOUNTS' as const,
            title: '1. Danh Sách & Cấp Tài Khoản',
            icon: '👥',
            badgeText: `${staffQuery.data?.length ?? 0} tài khoản`,
            desc: 'Quản lý tài khoản, vai trò & phân quyền nhân sự',
          },
          {
            id: 'RESIDENT_ACCESS' as const,
            title: '2. Quyền Tiếp Cận Hồ Sơ',
            icon: '📋',
            badgeText: `${assignmentQuery.data?.length ?? 0} phân công`,
            desc: 'Cấp quyền truy cập hồ sơ người cao tuổi',
          },
          {
            id: 'KPI_EVALUATION' as const,
            title: '3. Giám Sát & Tổng Hợp KPI',
            icon: '📊',
            badgeText: `${kpiEvaluationsQuery.data?.length ?? 0} đánh giá`,
            desc: 'Theo dõi hiệu suất & chỉ số công việc nhân viên',
          },
          {
            id: 'RECOGNITION_HONOR' as const,
            title: '4. Khen Thưởng & Thành Tích',
            icon: '🏆',
            badgeText: `${recognitionsQuery.data?.length ?? 0} vinh danh`,
            desc: 'Ghi nhận thành tích & khen thưởng cá nhân/tập thể',
          },
        ].map((block) => {
          const isActive = activeMainTab === block.id;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => setActiveMainTab(block.id)}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.65rem',
                border: isActive ? '2px solid #166534' : '1px solid #cbd5e1',
                background: isActive ? '#f0fdf4' : '#ffffff',
                boxShadow: isActive ? '0 4px 12px rgba(22, 101, 52, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '1.25rem' }}>{block.icon}</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '0.35rem',
                    background: isActive ? '#166534' : '#f1f5f9',
                    color: isActive ? '#ffffff' : '#475569',
                  }}
                >
                  {isActive ? 'ĐANG XEM' : block.badgeText}
                </span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isActive ? '#166534' : '#1e293b' }}>
                  {block.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: isActive ? '#15803d' : '#64748b', marginTop: '0.15rem' }}>
                  {block.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action / Export Button */}
      {(activeMainTab === 'STAFF_ACCOUNTS' || activeMainTab === 'RESIDENT_ACCESS') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          {activeMainTab === 'STAFF_ACCOUNTS' && (
            <button
              onClick={exportStaffAccountsCSV}
              className="btn btn-secondary"
              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700, fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
            >
              📥 Xuất Báo Cáo Nhân Sự Excel/CSV
            </button>
          )}
          {activeMainTab === 'RESIDENT_ACCESS' && (
            <button
              onClick={exportResidentAssignmentsCSV}
              className="btn btn-secondary"
              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700, fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
            >
              📥 Xuất Báo Cáo Phân Công Excel/CSV
            </button>
          )}
        </div>
      )}

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
              <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>Nhân viên y tế, Nhân viên dinh dưỡng, PHCN</div>
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

          {/* Accounts Table & Mobile Cards */}
          <div className="desktop-only-table">
            <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left', whiteSpace: 'nowrap' }}>
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

                                  {/* Delete / Remove button (Admin & Ban Giám đốc) */}
                                  {canDeleteStaff && !isAdminAccount && item.actorId !== 'Admin' && item.actorId !== 'SYSTEM-ROOT' && (
                                    <button
                                      onClick={() => setShowDeleteConfirmModal(item)}
                                      title="Bớt / Xoá tài khoản nhân sự khỏi hệ thống"
                                      style={{
                                        background: '#fef2f2',
                                        border: '1px solid #fecaca',
                                        color: '#b91c1c',
                                        padding: '0.28rem 0.6rem',
                                        borderRadius: '0.35rem',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      🗑️ Xoá
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

          {/* Mobile Cards View (< 768px) */}
          <div className="mobile-only-cards">
            {staffList.length === 0 ? (
              <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                Không tìm thấy tài khoản nhân sự nào phù hợp với bộ lọc tìm kiếm.
              </div>
            ) : (
              staffList.map((item) => {
                const isAdminAccount = item.primaryOperationalRole === 'ADMIN';
                const isDirectorAccount = item.primaryOperationalRole === 'SUPERVISOR';
                const canManageThisAccount = isAdmin || (isDirector && !isAdminAccount) || (!isDirectorAccount && !isAdminAccount && isManager);

                return (
                  <div
                    key={item.actorId}
                    className="mobile-card-item"
                    style={{
                      background: isAdminAccount ? '#fef2f2' : isDirectorAccount ? '#fffdf7' : '#ffffff',
                      borderColor: isAdminAccount ? '#fecaca' : isDirectorAccount ? '#fef3c7' : '#cbd5e1',
                    }}
                  >
                    {/* Header: Name & Status */}
                    <div className="mobile-card-header">
                      <div>
                        <div className="mobile-card-title">👤 {item.displayName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                          Tham chiếu: {item.employmentReference ?? 'Hợp đồng chính thức'}
                        </div>
                      </div>
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
                    </div>

                    {/* Information fields */}
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Mã NV / ID:</span>
                      <span className="mobile-card-value" style={{ fontFamily: 'monospace' }}>
                        <b>{item.staffCode}</b> ({item.actorId})
                      </span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Bộ phận:</span>
                      <span className="mobile-card-value">{item.department}</span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Vai trò hệ thống:</span>
                      <span className="mobile-card-value">
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: isAdminAccount ? '#fee2e2' : isDirectorAccount ? '#fef3c7' : item.primaryOperationalRole === 'CARE_MANAGER' ? '#eff6ff' : item.primaryOperationalRole === 'NURSE' ? '#e0f2fe' : '#f1f5f9',
                            color: isAdminAccount ? '#b91c1c' : isDirectorAccount ? '#92400e' : item.primaryOperationalRole === 'CARE_MANAGER' ? '#1e40af' : item.primaryOperationalRole === 'NURSE' ? '#0369a1' : '#334155',
                          }}
                        >
                          {ROLE_LABEL[item.primaryOperationalRole] || item.primaryOperationalRole}
                        </span>
                      </span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Email & SĐT:</span>
                      <span className="mobile-card-value">
                        <div>{item.email}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{item.phone}</div>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="mobile-card-actions">
                      {canManageThisAccount ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowHandoverModal(item)}
                            title="Bàn giao tài khoản & In phiếu"
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #86efac',
                              color: '#166534',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            📋 Bàn Giao
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setNewResetPassword(generateSecurePassword());
                              setShowResetModal(item);
                            }}
                            title="Đặt lại mật khẩu"
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1e40af',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            🔑 Đổi MK
                          </button>

                          {!isAdminAccount && (
                            <button
                              type="button"
                              onClick={() => toggleStatusMutation.mutate({ actorId: item.actorId, currentStatus: item.status })}
                              title={item.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              style={{
                                background: item.status === 'ACTIVE' ? '#fef2f2' : '#ecfdf5',
                                border: `1px solid ${item.status === 'ACTIVE' ? '#fecaca' : '#a7f3d0'}`,
                                color: item.status === 'ACTIVE' ? '#b91c1c' : '#047857',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '0.35rem',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {item.status === 'ACTIVE' ? '🔒 Khóa' : '🔓 Mở'}
                            </button>
                          )}

                          {canDeleteStaff && !isAdminAccount && item.actorId !== 'Admin' && item.actorId !== 'SYSTEM-ROOT' && (
                            <button
                              type="button"
                              onClick={() => setShowDeleteConfirmModal(item)}
                              title="Bớt / Xoá tài khoản nhân sự khỏi hệ thống"
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#b91c1c',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '0.35rem',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              🗑️ Xoá
                            </button>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.3rem 0.75rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: isAdminAccount ? '#fee2e2' : '#fef3c7',
                              color: isAdminAccount ? '#b91c1c' : '#92400e',
                              border: `1px solid ${isAdminAccount ? '#fca5a5' : '#fde68a'}`,
                            }}
                          >
                            {isAdminAccount ? '🔒 Quyền Admin' : '🔒 Quyền Ban Giám Đốc'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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
                  Chỉ định Nhân viên y tế hoặc Nhân viên chăm sóc phụ trách cụ thể từng cụ để mở quyền truy cập hồ sơ y tế và nhật ký chăm sóc.
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
                    <option value="NURSE">Nhân viên y tế</option>
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
                  <div className="table-responsive" style={{ overflowX: 'auto' }}>
                    <table className="data-table table-wide-700" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
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
                                {a.actorRole === 'NURSE' ? '🩺 Nhân viên y tế' : '🤝 Nhân viên chăm sóc'}
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
                    <div className="table-responsive" style={{ overflowX: 'auto' }}>
                      <table className="data-table table-wide-900" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
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
                                      {group.actorRole === 'NURSE' ? '🩺 Nhân viên y tế' : '🤝 Nhân viên chăm sóc'}
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
                      <div className="table-responsive" style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
                        <table className="table-wide-700" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Nhân sự</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Vai trò</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Người cao tuổi</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Trạng thái</th>
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


      {/* TAB 3: GIÁM SÁT & TỔNG HỢP ĐÁNH GIÁ KPI */}
      {activeMainTab === 'KPI_EVALUATION' && (
        <div>
          {/* Sub-mode Selector */}
          <div className="kpi-submode-nav">
            <button
              type="button"
              onClick={() => setKpiSubMode('DAILY_CHECKLIST')}
              className={`btn btn-sm kpi-submode-btn ${kpiSubMode === 'DAILY_CHECKLIST' ? 'btn-primary' : 'btn-secondary'}`}
            >
              📝 1. Giám Sát & Tick KPI Ca/Ngày Theo Nhóm Công Việc
            </button>
            <button
              type="button"
              onClick={() => setKpiSubMode('PERIOD_SYNTHESIS')}
              className={`btn btn-sm kpi-submode-btn ${kpiSubMode === 'PERIOD_SYNTHESIS' ? 'btn-primary' : 'btn-secondary'}`}
            >
              📊 2. Bảng Tổng Hợp Đánh Giá KPI (Tháng / Quý / Năm)
            </button>
            <button
              type="button"
              onClick={() => setKpiSubMode('FACILITY_OVERVIEW')}
              className={`btn btn-sm kpi-submode-btn ${kpiSubMode === 'FACILITY_OVERVIEW' ? 'btn-primary' : 'btn-secondary'}`}
            >
              📈 3. Giám Sát Mức Độ Hoàn Thành Toàn Viện
            </button>
          </div>

          {/* SUB-MODE 1: DAILY CHECKLIST */}
          {kpiSubMode === 'DAILY_CHECKLIST' && (
            <div className="card kpi-card">
              <div className="kpi-card-header">
                <div>
                  <h3 className="kpi-card-title">
                    📝 Đánh Giá KPI Ca Trực Hàng Ngày Cho Nhân Viên
                  </h3>
                  <p className="kpi-card-subtitle">
                    Nhân viên quản lý quan sát thực tế, kiểm tra ca trực và tick chọn các tiêu chí để phục vụ tổng hợp KPI tháng/quý/năm.
                  </p>
                </div>
                <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                  🔒 Thẩm quyền Quản lý & Ban Giám đốc
                </span>
              </div>

              {/* Selection Row */}
              <div className="kpi-form-grid">
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                    1. CHỌN NHÂN VIÊN ĐƯỢC ĐÁNH GIÁ *
                  </label>
                  <select
                    className="form-select"
                    value={kpiStaffId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setKpiStaffId(selectedId);
                      const foundStaff = staffQuery.data?.find((s) => s.actorId === selectedId);
                      if (foundStaff) {
                        setKpiStaffName(foundStaff.displayName);
                        const role = foundStaff.primaryOperationalRole;
                        let group: JobGroup = 'CAREGIVER';
                        if (role === 'NURSE') group = 'NURSE';
                        else if (role === 'NUTRITIONIST') group = 'NUTRITIONIST';
                        else if (role === 'HOUSEKEEPING') group = 'HOUSEKEEPING';
                        else if (role === 'REHABILITATION_SPECIALIST') group = 'REHABILITATION_SPECIALIST';
                        else if (['ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'PSYCHOLOGIST', 'SOCIAL_WORKER'].includes(role)) group = 'OFFICE_ADMIN';
                        setKpiJobGroup(group);
                        setKpiTickResults({});
                      }
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Chọn nhân sự ({staffQuery.data?.length || 0}) --</option>
                    {staffQuery.data?.map((s) => (
                      <option key={s.actorId} value={s.actorId}>
                        {s.staffCode} - {s.displayName} ({ROLE_LABEL[s.primaryOperationalRole] || s.primaryOperationalRole})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                    2. NHÓM CÔNG VIỆC CHUYÊN MÔN
                  </label>
                  <select
                    className="form-select"
                    value={kpiJobGroup}
                    onChange={(e) => {
                      setKpiJobGroup(e.target.value as JobGroup);
                      setKpiTickResults({});
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, color: '#166534' }}
                  >
                    {(Object.keys(JOB_GROUP_LABELS) as JobGroup[]).map((g) => (
                      <option key={g} value={g}>{JOB_GROUP_LABELS[g]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                    3. NGÀY ĐÁNH GIÁ
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={kpiShiftDate}
                    onChange={(e) => setKpiShiftDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                    4. CA TRỰC GIÁM SÁT
                  </label>
                  <select
                    className="form-select"
                    value={kpiShiftName}
                    onChange={(e) => setKpiShiftName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="Ca Sáng (06:00 - 14:00)">Ca Sáng (06:00 - 14:00)</option>
                    <option value="Ca Chiều (14:00 - 22:00)">Ca Chiều (14:00 - 22:00)</option>
                    <option value="Ca Đêm (22:00 - 06:00)">Ca Đêm (22:00 - 06:00)</option>
                    <option value="Ca 24h Toàn Ngày">Ca 24h Toàn Ngày</option>
                    <option value="Ca Linh Hoạt / Hành Chính">Ca Linh Hoạt / Hành Chính</option>
                  </select>
                </div>
              </div>

              {/* Criteria Checklist */}
              {kpiStaffId ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="kpi-criteria-header">
                    <div className="kpi-criteria-title" style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                      📋 BỘ TIÊU CHÍ HOẠT ĐỘNG TRONG CA TRỰC — {JOB_GROUP_LABELS[kpiJobGroup].toUpperCase()}
                    </div>
                    <div className="kpi-criteria-staff" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Ghi nhận cho nhân viên: <strong style={{ color: '#166534' }}>{kpiStaffName}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {(DEFAULT_KPI_CRITERIA_BY_GROUP[kpiJobGroup] || []).map((criterion) => {
                      const currentStatus = kpiTickResults[criterion.id] || 'PASSED';
                      return (
                        <div
                          key={criterion.id}
                          className="kpi-criterion-item"
                          style={{
                            background: currentStatus === 'FAILED' ? '#fff5f5' : currentStatus === 'EXCELLENT' ? '#f0fdf4' : '#fafafa',
                            border: `1px solid ${currentStatus === 'FAILED' ? '#fecaca' : currentStatus === 'EXCELLENT' ? '#86efac' : '#e2e8f0'}`,
                          }}
                        >
                          <div className="kpi-criterion-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span className="badge badge-secondary" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem' }}>
                                {criterion.code}
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                {criterion.category}
                              </span>
                              <strong className="kpi-criterion-title" style={{ fontSize: '0.88rem', color: '#0f172a' }}>{criterion.title}</strong>
                              <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                Trọng số: {criterion.weight}%
                              </span>
                            </div>
                            <div className="kpi-criterion-desc" style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.2rem' }}>
                              {criterion.description}
                            </div>
                          </div>

                          <div className="kpi-criterion-actions">
                            <button
                              type="button"
                              onClick={() => setKpiTickResults((prev) => ({ ...prev, [criterion.id]: 'PASSED' }))}
                              className="kpi-criterion-btn"
                              style={{
                                border: currentStatus === 'PASSED' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                                background: currentStatus === 'PASSED' ? '#dcfce7' : '#fff',
                                color: currentStatus === 'PASSED' ? '#15803d' : '#64748b',
                              }}
                            >
                              🟢 ĐẠT YÊU CẦU
                            </button>

                            <button
                              type="button"
                              onClick={() => setKpiTickResults((prev) => ({ ...prev, [criterion.id]: 'EXCELLENT' }))}
                              className="kpi-criterion-btn"
                              style={{
                                border: currentStatus === 'EXCELLENT' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                background: currentStatus === 'EXCELLENT' ? '#dbeafe' : '#fff',
                                color: currentStatus === 'EXCELLENT' ? '#1e40af' : '#64748b',
                              }}
                            >
                              ⭐ XUẤT SẮC
                            </button>

                            <button
                              type="button"
                              onClick={() => setKpiTickResults((prev) => ({ ...prev, [criterion.id]: 'FAILED' }))}
                              className="kpi-criterion-btn"
                              style={{
                                border: currentStatus === 'FAILED' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                                background: currentStatus === 'FAILED' ? '#fee2e2' : '#fff',
                                color: currentStatus === 'FAILED' ? '#b91c1c' : '#64748b',
                              }}
                            >
                              🔴 CHƯA ĐẠT
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                      NHẬN XÉT & GHI CHÚ QUAN SÁT THỰC TẾ CỦA QUẢN LÝ
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Ghi nhận chi tiết quan sát thực tế ca trực (ví dụ: Chăm sóc chu đáo, tuân thủ đúng 5 đúng eMAR, nhắc nhở thu gom túi rác y tế)..."
                      value={kpiEvaluationNotes}
                      onChange={(e) => setKpiEvaluationNotes(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button
                        type="button"
                        disabled={submitKpiMutation.isPending}
                        onClick={() => {
                          const criteriaList = DEFAULT_KPI_CRITERIA_BY_GROUP[kpiJobGroup] || [];
                          const results: KPICriterionResult[] = criteriaList.map((c) => ({
                            criterionId: c.id,
                            criterionCode: c.code,
                            criterionTitle: c.title,
                            status: kpiTickResults[c.id] || 'PASSED',
                          }));

                          submitKpiMutation.mutate({
                            staffId: kpiStaffId,
                            staffName: kpiStaffName,
                            jobGroup: kpiJobGroup,
                            shiftDate: kpiShiftDate,
                            shiftName: kpiShiftName,
                            results,
                            notes: kpiEvaluationNotes,
                          });
                        }}
                        className="btn btn-primary kpi-submit-btn"
                        style={{ padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', borderRadius: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        {submitKpiMutation.isPending ? '⏳ Đang ghi nhận...' : '✅ Hoàn Tất Đánh Giá & Phát Bell Notice'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: '#64748b', background: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                  👈 Vui lòng chọn <strong>Nhân viên</strong> ở trên để hiển thị bộ tiêu chí KPI ca trực theo đúng nhóm công việc chuyên môn.
                </div>
              )}

              {/* Lịch sử Đánh giá gần đây */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                  📜 LỊCH SỬ ĐÁNH GIÁ CA TRỰC GẦN ĐÂY ({kpiEvaluationsQuery.data?.length || 0})
                </h4>
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table kpi-history-table" style={{ width: '100%', minWidth: '900px', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th>ID / Ngày Ca</th>
                        <th>Nhân Viên</th>
                        <th>Nhóm Công Việc</th>
                        <th>Ca Trực</th>
                        <th>Quản Lý Đánh Giá</th>
                        <th>Điểm KPI</th>
                        <th>Xếp Loại</th>
                        <th>Ghi Chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(kpiEvaluationsQuery.data || []).map((rec) => (
                        <tr key={rec.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {rec.id}<br/>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{rec.shiftDate}</span>
                          </td>
                          <td><strong style={{ color: '#0f172a' }}>{rec.staffName}</strong></td>
                          <td><span className="badge badge-secondary">{rec.jobGroupLabel}</span></td>
                          <td>{rec.shiftName}</td>
                          <td>{rec.evaluatorName}</td>
                          <td>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: rec.totalScore >= 90 ? '#166534' : rec.totalScore >= 70 ? '#1e40af' : '#b91c1c' }}>
                              {rec.totalScore}/100
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${rec.overallGrade === 'EXCELLENT' ? 'badge-success' : rec.overallGrade === 'GOOD' ? 'badge-info' : 'badge-danger'}`}>
                              {rec.overallGradeLabel}
                            </span>
                          </td>
                          <td style={{ maxWidth: '200px', fontSize: '0.78rem', color: '#475569' }}>{rec.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-MODE 2: PERIOD SYNTHESIS (MONTH / QUARTER / YEAR) */}
          {kpiSubMode === 'PERIOD_SYNTHESIS' && (() => {
            const summary: KPISynthesisSummary = synthesizeStaffKPI(
              synthesisPeriodType,
              synthesisPeriodValue,
              synthesisJobGroupFilter
            );

            return (
              <div className="card kpi-card">
                <div className="kpi-card-header">
                  <div>
                    <h3 className="kpi-card-title">
                      📊 Bảng Tổng Hợp Đánh Giá KPI Nhân Sự ({summary.items[0]?.periodLabel || synthesisPeriodValue})
                    </h3>
                    <p className="kpi-card-subtitle">
                      Tự động tổng hợp dữ liệu ca trực hàng ngày thành kết quả đánh giá thi đua Tháng, Quý và Năm của từng nhân viên.
                    </p>
                  </div>

                  <div className="kpi-synthesis-actions">
                    <button
                      onClick={async () => {
                        const count = await publishPeriodKPIHonorNotices(actor!, summary);
                        if (count > 0) {
                          alert(`🔔 Đã phát Bell Notice vinh danh thành công ${count} nhân viên đạt Hạng A+ trong ${summary.periodValue} tới TOÀN THỂ nhân viên Tâm An Care!`);
                          setFeedback(`🌟 Đã phát Bell Notice vinh danh toàn viện cho ${count} nhân sự xuất sắc kỳ ${summary.periodValue}!`);
                        } else {
                          alert(`Chưa có nhân sự đạt Hạng A+ (Xuất sắc vượt bậc) trong kỳ ${summary.periodValue} để phát Bell Notice vinh danh.`);
                        }
                      }}
                      className="btn btn-secondary"
                      style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe', fontWeight: 700, fontSize: '0.8rem' }}
                    >
                      🔔 Phát Bell Notice Vinh Danh Thi Đua Kỳ ({summary.items.filter(i => i.finalRank === 'A+').length} NV A+)
                    </button>

                    <button
                      onClick={() => exportKPISynthesisCSV(summary)}
                      className="btn btn-secondary"
                      style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700, fontSize: '0.8rem' }}
                    >
                      📥 Xuất Báo Cáo KPI Excel/CSV
                    </button>
                  </div>
                </div>

                {/* Period Selectors */}
                <div className="kpi-form-grid">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                      KỲ TỔNG HỢP (THÁNG / QUÝ / NĂM)
                    </label>
                    <select
                      className="form-select"
                      value={synthesisPeriodType}
                      onChange={(e) => {
                        const type = e.target.value as 'MONTH' | 'QUARTER' | 'YEAR';
                        setSynthesisPeriodType(type);
                        if (type === 'MONTH') setSynthesisPeriodValue('2026-09');
                        else if (type === 'QUARTER') setSynthesisPeriodValue('2026-Q3');
                        else setSynthesisPeriodValue('2026');
                      }}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      <option value="MONTH">📅 Đánh Giá Theo Tháng</option>
                      <option value="QUARTER">🏛️ Đánh Giá Theo Quý</option>
                      <option value="YEAR">🏆 Đánh Giá Theo Năm</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                      CHỌN KỲ ĐÁNH GIÁ CỤ THỂ
                    </label>
                    <select
                      className="form-select"
                      value={synthesisPeriodValue}
                      onChange={(e) => setSynthesisPeriodValue(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, color: '#166534' }}
                    >
                      {synthesisPeriodType === 'MONTH' && (
                        <>
                          <option value="2026-09">Tháng 09/2026 (Hiện tại)</option>
                          <option value="2026-08">Tháng 08/2026</option>
                          <option value="2026-07">Tháng 07/2026</option>
                        </>
                      )}
                      {synthesisPeriodType === 'QUARTER' && (
                        <>
                          <option value="2026-Q3">Quý 3/2026 (Tháng 7 - Tháng 9)</option>
                          <option value="2026-Q2">Quý 2/2026 (Tháng 4 - Tháng 6)</option>
                          <option value="2026-Q1">Quý 1/2026 (Tháng 1 - Tháng 3)</option>
                        </>
                      )}
                      {synthesisPeriodType === 'YEAR' && (
                        <>
                          <option value="2026">Năm 2026</option>
                          <option value="2025">Năm 2025</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                      LỌC THEO NHÓM CÔNG VIỆC
                    </label>
                    <select
                      className="form-select"
                      value={synthesisJobGroupFilter}
                      onChange={(e) => setSynthesisJobGroupFilter(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="ALL">Tất cả nhóm công việc (6 nhóm)</option>
                      {(Object.keys(JOB_GROUP_LABELS) as JobGroup[]).map((g) => (
                        <option key={g} value={g}>{JOB_GROUP_LABELS[g]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Metric Overview Cards */}
                <div className="kpi-metric-grid">
                  <div className="card kpi-metric-card" style={{ padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
                    <div className="kpi-metric-title" style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>TỔNG NHÂN VIÊN ĐÃ ĐÁNH GIÁ</div>
                    <div className="kpi-metric-number" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                      {summary.totalStaffEvaluated} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>nhân sự</span>
                    </div>
                    <div className="kpi-metric-subtext" style={{ fontSize: '0.72rem', color: '#64748b' }}>Đã ghi nhận dữ liệu ca trực</div>
                  </div>

                  <div className="card kpi-metric-card" style={{ padding: '0.85rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.65rem' }}>
                    <div className="kpi-metric-title" style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>ĐIỂM KPI TRUNG BÌNH TOÀN VIỆN</div>
                    <div className="kpi-metric-number" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534', margin: '0.2rem 0' }}>
                      {summary.averageFacilityScore}/100 <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>điểm</span>
                    </div>
                    <div className="kpi-metric-subtext" style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>Chỉ số hiệu suất tổng hợp</div>
                  </div>

                  <div className="card kpi-metric-card" style={{ padding: '0.85rem 1rem', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '0.65rem' }}>
                    <div className="kpi-metric-title" style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>XUẤT SẮC VƯỢT BẬC (A+)</div>
                    <div className="kpi-metric-number" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0369a1', margin: '0.2rem 0' }}>
                      {summary.excellentStaffCount} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>cá nhân</span>
                    </div>
                    <div className="kpi-metric-subtext" style={{ fontSize: '0.72rem', color: '#0369a1' }}>Đủ tiêu chuẩn khen thưởng</div>
                  </div>

                  <div className="card kpi-metric-card" style={{ padding: '0.85rem 1rem', background: summary.warningStaffCount > 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${summary.warningStaffCount > 0 ? '#fecaca' : '#e2e8f0'}`, borderRadius: '0.65rem' }}>
                    <div className="kpi-metric-title" style={{ fontSize: '0.7rem', color: summary.warningStaffCount > 0 ? '#b91c1c' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>CẦN CẢI THIỆN / CẢNH BÁO</div>
                    <div className="kpi-metric-number" style={{ fontSize: '1.4rem', fontWeight: 800, color: summary.warningStaffCount > 0 ? '#b91c1c' : '#0f172a', margin: '0.2rem 0' }}>
                      {summary.warningStaffCount} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>cá nhân</span>
                    </div>
                    <div className="kpi-metric-subtext" style={{ fontSize: '0.72rem', color: summary.warningStaffCount > 0 ? '#b91c1c' : '#64748b' }}>Phát hiện tiêu chí chưa đạt</div>
                  </div>
                </div>

                {/* Detailed Synthesis Table */}
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table kpi-synthesis-table" style={{ width: '100%', minWidth: '950px', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th>Mã & Nhân Viên</th>
                        <th>Nhóm Công Việc</th>
                        <th>Kỳ Đánh Giá</th>
                        <th>Số Ca Đã Đánh Giá</th>
                        <th>Điểm TB</th>
                        <th>Tỷ Lệ Đạt Tiêu Chí</th>
                        <th>Số Vi Phạm</th>
                        <th>Xếp Loại Thi Đua Kỳ</th>
                        <th>Tóm Tắt Tổng Hợp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.items.length > 0 ? (
                        summary.items.map((item) => (
                          <tr key={item.staffId}>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{item.staffName}</strong><br/>
                              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>{item.staffId}</span>
                            </td>
                            <td><span className="badge badge-secondary">{item.jobGroupLabel}</span></td>
                            <td><strong>{item.periodLabel}</strong></td>
                            <td>{item.totalEvaluatedShifts} ca</td>
                            <td>
                              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: item.averageScore >= 90 ? '#166534' : item.averageScore >= 75 ? '#1e40af' : '#b91c1c' }}>
                                {item.averageScore}/100
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', minWidth: '40px' }}>
                                  <div style={{ width: `${item.criterionPassRatePercent}%`, height: '100%', background: item.criterionPassRatePercent >= 90 ? '#16a34a' : '#2563eb' }} />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>{item.criterionPassRatePercent}%</span>
                              </div>
                            </td>
                            <td>
                              {item.failedCount > 0 ? (
                                <span className="badge badge-danger">⚠️ {item.failedCount} lỗi</span>
                              ) : (
                                <span className="badge badge-success">✓ Không lỗi</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${item.finalRank === 'A+' ? 'badge-success' : item.finalRank === 'A' ? 'badge-info' : 'badge-warning'}`} style={{ fontWeight: 800 }}>
                                {item.finalRankLabel}
                              </span>
                            </td>
                            <td style={{ maxWidth: '220px', fontSize: '0.78rem', color: '#475569' }}>{item.evaluationSummary}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                            Chưa có dữ liệu tổng hợp KPI cho kỳ <strong>{synthesisPeriodValue}</strong>. Vui lòng thực hiện đánh giá ca trực ở Sub-mode 1.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* SUB-MODE 3: FACILITY OVERVIEW */}
          {kpiSubMode === 'FACILITY_OVERVIEW' && (
            <div className="card kpi-card">
              <h3 className="kpi-card-title" style={{ marginBottom: '0.4rem' }}>
                📈 Giám Sát Mức Độ Hoàn Thành & Tuân Thủ Tiêu Chí Toàn Viện
              </h3>
              <p className="kpi-card-subtitle" style={{ marginBottom: '1.25rem' }}>
                Tổng quan chỉ số hiệu suất theo các phòng ban chuyên môn và tỷ lệ tuân thủ quy chuẩn y tế Viện Dưỡng Lão Tâm An.
              </p>

              <div className="kpi-facility-grid">
                {(workforceKpiQuery.data?.teams || []).map((team) => (
                  <div key={team.role} style={{ border: '1px solid #e2e8f0', borderRadius: '0.55rem', padding: '0.85rem 1rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{team.role}</strong>
                      <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>{team.completionRate}% hoàn thành</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <div>Tổng nhân sự: <b>{team.totalStaff}</b></div>
                      <div>Tổng ca trực: <b>{team.totalShifts}</b></div>
                      <div>Ca hoàn thành: <b>{team.completedShifts}</b></div>
                      <div>Điểm KPI: <b style={{ color: '#166534' }}>{team.kpiScore}/100</b></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: KHEN THƯỞNG & THÀNH TÍCH */}
      {activeMainTab === 'RECOGNITION_HONOR' && (
        <div className="card" style={{ padding: '1.25rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏆 Khen Thưởng, Vinh Danh & Quản Lý Kỷ Luật Nhân Sự
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Ghi nhận thành tích thi đua đột xuất, bằng khen vinh danh và biên bản nhắc nhở kỷ luật nhân sự Tâm An Care.
              </p>
            </div>

            {isDirector && (
              <button
                onClick={() => {
                  setFormRecogStaffId('');
                  setFormRecogTitle('');
                  setFormRecogDesc('');
                  setFormRecogBonus(15);
                  setShowRecogModal(true);
                }}
                className="btn btn-primary"
                style={{ fontWeight: 700, padding: '0.55rem 1.1rem', borderRadius: '0.45rem' }}
              >
                🎖️ + Trao Khen Thưởng / Tạo Biên Bản Nhắc Nhở
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Tìm kiếm theo tên nhân viên, tiêu đề khen thưởng..."
              value={recogSearch}
              onChange={(e) => setRecogSearch(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
            />

            <select
              className="form-select"
              value={recogTypeFilter}
              onChange={(e) => setRecogTypeFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
            >
              <option value="ALL">Tất cả loại ghi nhận (Khen thưởng & Nhắc nhở)</option>
              <option value="COMMENDATION">🏆 Khen thưởng xuất sắc</option>
              <option value="SPECIAL_ACHIEVEMENT">⭐ Thành tích đột xuất</option>
              <option value="EFFORT_RECOGNITION">💪 Nỗ lực vượt bậc</option>
              <option value="SAFETY_AWARD">🛡️ An toàn & Cứu hộ khẩn cấp</option>
              <option value="DISCIPLINE_WARNING">⚠️ Biên bản nhắc nhở / Kỷ luật</option>
            </select>
          </div>

          {/* Recognitions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(recognitionsQuery.data || [])
              .filter((r) => {
                if (recogTypeFilter !== 'ALL' && r.recognition_type !== recogTypeFilter) return false;
                if (recogSearch.trim()) {
                  const needle = recogSearch.toLowerCase();
                  return (
                    r.staffName?.toLowerCase().includes(needle) ||
                    r.title.toLowerCase().includes(needle) ||
                    r.description.toLowerCase().includes(needle)
                  );
                }
                return true;
              })
              .map((rec) => {
                const isWarning = rec.recognition_type === 'DISCIPLINE_WARNING';
                return (
                  <div
                    key={rec.recognition_id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.6rem',
                      background: isWarning ? '#fff5f5' : '#f0fdf4',
                      border: `1px solid ${isWarning ? '#fecaca' : '#bbf7d0'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                        <span className={`badge ${isWarning ? 'badge-danger' : 'badge-success'}`} style={{ fontWeight: 700 }}>
                          {isWarning ? '⚠️ BIÊN BẢN NHẮC NHỞ' : '🏆 KHEN THƯỞNG VINH DANH'}
                        </span>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{rec.title}</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '0.4rem' }}>
                        {rec.description}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span>Nơi trao / Nhân viên: <strong>{rec.staffName}</strong> ({rec.staffRole})</span>
                        <span>Người quyết định: <strong>{rec.awardedByName || rec.awarded_by}</strong></span>
                        <span>Ngày ghi nhận: {rec.awarded_date}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${isWarning ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                        {rec.kpi_bonus_points >= 0 ? `+${rec.kpi_bonus_points}` : rec.kpi_bonus_points} điểm thi đua
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
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
          className="modal-overlay print-modal-overlay"
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
            className="modal-card printable-a4-sheet"
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
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>TRUNG TÂM DƯỠNG LÃO TÂM AN CARE — BẢO MẬT & PHÂN QUYỀN</div>
                <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', color: '#0f172a' }}>PHIẾU BÀN GIAO TÀI KHOẢN ĐĂNG NHẬP</h2>
              </div>
              <button
                type="button"
                className="no-print"
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

              <div className="signature-box" style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'center', fontSize: '0.8rem' }}>
                <div>
                  <b>NGƯỜI BÀN GIAO</b><br />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Ký & ghi rõ họ tên)</span>
                </div>
                <div>
                  <b>NGƯỜI NHẬN TÀI KHOẢN</b><br />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Ký & ghi rõ họ tên)</span>
                </div>
              </div>
            </div>

            {copyFeedback && (
              <div className="no-print" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.82rem', fontWeight: 600, marginBottom: '1rem' }}>
                {copyFeedback}
              </div>
            )}

            {/* Action buttons */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                className="no-print"
                onClick={() => triggerPrint()}
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
                className="modal-close"
                title="Đóng cửa sổ"
                aria-label="Đóng cửa sổ"
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
                      {assignmentRole === 'NURSE' ? '🩺 Nhân viên y tế' : '🤝 Nhân viên chăm sóc'}
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

      {/* Modal Confirmation: Delete Staff Account (Admin & Ban Giám đốc) */}
      {showDeleteConfirmModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: '0.75rem',
              maxWidth: '480px', width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
              overflow: 'hidden', border: '1px solid #fecaca',
            }}
          >
            {/* Header */}
            <div style={{ background: '#b91c1c', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🗑️</span>
                <h2 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 700 }}>
                  Xác nhận xoá / bớt tài khoản nhân sự
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(null)}
                className="modal-close"
                title="Đóng cửa sổ"
                aria-label="Đóng cửa sổ"
              >✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', color: '#475569' }}>
                Hành động này sẽ <strong>xoá hoàn toàn tài khoản nhân sự</strong> khỏi danh sách quản lý của hệ thống:
              </p>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.55rem', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 0.75rem', fontSize: '0.87rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Họ & tên:</span>
                  <span style={{ fontWeight: 700, color: '#b91c1c' }}>{showDeleteConfirmModal.displayName}</span>

                  <span style={{ color: '#64748b', fontWeight: 600 }}>Mã NV / ID:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{showDeleteConfirmModal.staffCode} ({showDeleteConfirmModal.actorId})</span>

                  <span style={{ color: '#64748b', fontWeight: 600 }}>Bộ phận:</span>
                  <span style={{ fontWeight: 600 }}>{showDeleteConfirmModal.department}</span>

                  <span style={{ color: '#64748b', fontWeight: 600 }}>Vai trò:</span>
                  <span style={{ fontWeight: 700, color: '#0369a1' }}>{ROLE_LABEL[showDeleteConfirmModal.primaryOperationalRole] || showDeleteConfirmModal.primaryOperationalRole}</span>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#b91c1c', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '0.4rem', padding: '0.65rem 0.85rem', marginBottom: '1.25rem' }}>
                ⚠️ <b>Lưu ý bảo mật & kiểm toán:</b> Hành động xoá tài khoản sẽ được ghi nhận lại trên hệ thống kiểm toán AuditLog tối cao.
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(null)}
                  style={{
                    padding: '0.55rem 1.2rem', borderRadius: '0.45rem',
                    background: '#f1f5f9', border: '1px solid #cbd5e1',
                    color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                  }}
                >
                  Hủy thao tác
                </button>
                <button
                  type="button"
                  disabled={deleteAccountMutation.isPending}
                  onClick={() => deleteAccountMutation.mutate(showDeleteConfirmModal)}
                  style={{
                    padding: '0.55rem 1.4rem', borderRadius: '0.45rem',
                    background: '#b91c1c', border: 'none',
                    color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}
                >
                  {deleteAccountMutation.isPending ? '⏳ Đang xoá...' : '🗑️ Xác nhận xoá tài khoản'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL TRAO KHEN THƯỞNG / NHẮC NHỞ */}
      {showRecogModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: '0.75rem',
              maxWidth: '550px', width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
              overflow: 'hidden', border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ background: '#166534', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 700 }}>
                🎖️ Trao Khen Thưởng / Biên Bản Nhắc Nhở Kỷ Luật
              </h3>
              <button
                type="button"
                onClick={() => setShowRecogModal(false)}
                className="modal-close"
                title="Đóng cửa sổ"
                aria-label="Đóng cửa sổ"
              >✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formRecogStaffId || !formRecogTitle.trim() || !formRecogDesc.trim()) {
                  alert('Vui lòng chọn nhân viên và nhập đầy đủ tiêu đề, nội dung.');
                  return;
                }
                createRecogMutation.mutate({
                  staffActorId: formRecogStaffId,
                  recognitionType: formRecogType,
                  title: formRecogTitle.trim(),
                  description: formRecogDesc.trim(),
                  kpiBonusPoints: formRecogType === 'DISCIPLINE_WARNING' ? -Math.abs(formRecogBonus) : Math.abs(formRecogBonus),
                  awardedDate: formRecogDate,
                });
              }}
              style={{ padding: '1.25rem' }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                  NHÂN VIÊN ĐƯỢC GHI NHẬN *
                </label>
                <select
                  className="form-select"
                  value={formRecogStaffId}
                  onChange={(e) => setFormRecogStaffId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  required
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {staffQuery.data?.map((s) => (
                    <option key={s.actorId} value={s.actorId}>
                      {s.staffCode} - {s.displayName} ({ROLE_LABEL[s.primaryOperationalRole] || s.primaryOperationalRole})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                  LOẠI HÌNH GHI NHẬN *
                </label>
                <select
                  className="form-select"
                  value={formRecogType}
                  onChange={(e) => setFormRecogType(e.target.value as any)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  <option value="COMMENDATION">🏆 Khen thưởng xuất sắc</option>
                  <option value="SPECIAL_ACHIEVEMENT">⭐ Thành tích đột xuất</option>
                  <option value="EFFORT_RECOGNITION">💪 Nỗ lực vượt bậc trong ca</option>
                  <option value="SAFETY_AWARD">🛡️ An toàn & Cứu hộ khẩn cấp</option>
                  <option value="DISCIPLINE_WARNING">⚠️ Biên bản nhắc nhở / Kỷ luật</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                  TIÊU ĐỀ QUYẾT ĐỊNH / BẰNG KHEN *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: Khen thưởng xử lý cấp cứu kịp thời sự cố té ngã..."
                  value={formRecogTitle}
                  onChange={(e) => setFormRecogTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                  NỘI DUNG CHI TIẾT GHI NHẬN *
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Mô tả cụ thể hành động xuất sắc hoặc lỗi cần nhắc nhở..."
                  value={formRecogDesc}
                  onChange={(e) => setFormRecogDesc(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                    ĐIỂM ĐỘT XUẤT
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formRecogBonus}
                    onChange={(e) => setFormRecogBonus(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                    NGÀY QUYẾT ĐỊNH
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formRecogDate}
                    onChange={(e) => setFormRecogDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRecogModal(false)}
                  style={{ padding: '0.55rem 1.2rem', borderRadius: '0.45rem', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Hủy thao tác
                </button>
                <button
                  type="submit"
                  disabled={createRecogMutation.isPending}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 1.4rem', fontWeight: 700, fontSize: '0.88rem' }}
                >
                  {createRecogMutation.isPending ? '⏳ Đang lưu...' : '💾 Xác Nhận Trao Quyết Định'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default StaffAccessPage;
