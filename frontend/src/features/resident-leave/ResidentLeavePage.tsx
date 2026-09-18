import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { triggerPrint } from '../../utils/print';
import {
  cancelLeaveRequest,
  confirmSubsequentDays,
  createLeaveRequest,
  fetchLeaveRequests,
  recordLeaveReturn,
  LeaveStatus,
  LeaveType,
  ResidentLeaveItem,
  // Staff Leave APIs & types
  fetchStaffLeaveRequests,
  createStaffLeaveRequest,
  approveStaffLeaveRequest,
  rejectStaffLeaveRequest,
  cancelStaffLeaveRequest,
  StaffLeaveItem,
  StaffLeaveType,
  StaffLeaveStatus,
} from '../../api/resident-leave';
import { listResidents } from '../../api/residents';
import { getElderIcon, formatResidentNameWithSalutation } from '../residents/resident-ui';

const LEAVE_TYPE_LABEL: Record<string, string> = {
  FAMILY_VISIT: 'Thăm gia đình',
  MEDICAL_OUTING: 'Khám bệnh bên ngoài',
  TEMPORARY_HOSPITALIZATION: 'Điều trị bệnh viện',
  VACATION: 'Nghỉ dưỡng',
  OTHER: 'Lý do khác',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  REGISTERED: { label: 'Đã đăng ký', className: 'badge badge-info' },
  ACTIVE_LEAVE: { label: 'Đang tạm vắng', className: 'badge badge-warning' },
  RETURNED: { label: 'Đã trở lại', className: 'badge badge-success' },
  CANCELLED: { label: 'Đã hủy', className: 'badge badge-neutral' },
};

const STAFF_LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: 'Nghỉ phép năm',
  PERSONAL: 'Nghỉ việc riêng',
  SICK: 'Nghỉ ốm / y tế',
  UNPAID: 'Nghỉ không hưởng lương',
  OTHER: 'Lý do khác',
};

const STAFF_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Chờ duyệt', className: 'badge badge-warning' },
  APPROVED: { label: 'Đã duyệt', className: 'badge badge-success' },
  REJECTED: { label: 'Từ chối', className: 'badge badge-danger' },
  CANCELLED: { label: 'Đã hủy', className: 'badge badge-neutral' },
};

export default function ResidentLeavePage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const canManage = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER' || actorRole === 'NURSE';
  const canViewMealDeduction = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER' || actorRole === 'ACCOUNTANT';
  const isStaffApprover = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER' || actorRole === 'ADMIN';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'STAFF_LEAVE' | 'RESIDENT_LEAVE'>('STAFF_LEAVE');

  // --- RESIDENT LEAVE STATE ---
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [residentFilter, setResidentFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [residentId, setResidentId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('FAMILY_VISIT');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [reporterRelationship, setReporterRelationship] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // --- STAFF LEAVE STATE ---
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>('ALL');
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [isStaffRegisterOpen, setIsStaffRegisterOpen] = useState(false);

  const [staffLeaveType, setStaffLeaveType] = useState<StaffLeaveType>('ANNUAL');
  const [staffStartDate, setStaffStartDate] = useState('');
  const [staffEndDate, setStaffEndDate] = useState('');
  const [staffReason, setStaffReason] = useState('');
  const [isSpecialCase, setIsSpecialCase] = useState(false);
  const [specialReason, setSpecialReason] = useState('');
  const [staffFormError, setStaffFormError] = useState<string | null>(null);

  // Staff Review Modal state
  const [reviewItem, setReviewItem] = useState<StaffLeaveItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  // Printable A4 Leave Request Modal (RLA-BR-01)
  const [viewingPrintItem, setViewingPrintItem] = useState<ResidentLeaveItem | null>(null);

  // --- QUERIES ---
  const { data: leaveData, isLoading } = useQuery({
    queryKey: ['resident-leave-requests', statusFilter, residentFilter, actorId],
    queryFn: () =>
      fetchLeaveRequests(actorId, actorRole, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        residentId: residentFilter === 'ALL' ? undefined : residentFilter,
        limit: 100,
      }),
    enabled: Boolean(actorId) && activeTab === 'RESIDENT_LEAVE',
  });

  const { data: residentsData } = useQuery({
    queryKey: ['residents-list', actorId],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor) && activeTab === 'RESIDENT_LEAVE',
  });

  const { data: staffLeaveData, isLoading: isStaffLoading } = useQuery({
    queryKey: ['staff-leave-requests', staffStatusFilter, actorId],
    queryFn: () =>
      fetchStaffLeaveRequests(actorId, actorRole, {
        status: staffStatusFilter === 'ALL' ? undefined : staffStatusFilter,
        limit: 100,
      }),
    enabled: Boolean(actorId) && activeTab === 'STAFF_LEAVE',
  });

  // --- MUTATIONS ---
  const registerMutation = useMutation({
    mutationFn: (payload: any) => createLeaveRequest(actorId, actorRole, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] });
      setIsRegisterOpen(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message || 'Lỗi đăng ký tạm vắng'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmSubsequentDays(actorId, actorRole, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] }),
    onError: (err: any) => alert(err.message),
  });

  const returnMutation = useMutation({
    mutationFn: (id: string) => recordLeaveReturn(actorId, actorRole, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] }),
    onError: (err: any) => alert(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelLeaveRequest(actorId, actorRole, id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] }),
    onError: (err: any) => alert(err.message),
  });

  // Staff Mutations
  const createStaffMutation = useMutation({
    mutationFn: (payload: any) => createStaffLeaveRequest(actorId, actorRole, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
      setIsStaffRegisterOpen(false);
      resetStaffForm();
    },
    onError: (err: any) => setStaffFormError(err.message || 'Lỗi gửi đơn xin nghỉ phép'),
  });

  const approveStaffMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => approveStaffLeaveRequest(actorId, actorRole, id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
      setReviewItem(null);
      setReviewNote('');
    },
    onError: (err: any) => alert(err.message),
  });

  const rejectStaffMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => rejectStaffLeaveRequest(actorId, actorRole, id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
      setReviewItem(null);
      setReviewNote('');
    },
    onError: (err: any) => alert(err.message),
  });

  const cancelStaffMutation = useMutation({
    mutationFn: (id: string) => cancelStaffLeaveRequest(actorId, actorRole, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] }),
    onError: (err: any) => alert(err.message),
  });

  const resetForm = () => {
    setResidentId('');
    setLeaveType('FAMILY_VISIT');
    setStartDate('');
    setExpectedEndDate('');
    setReportedBy('');
    setReporterRelationship('');
    setNote('');
    setFormError(null);
  };

  const resetStaffForm = () => {
    setStaffLeaveType('ANNUAL');
    setStaffStartDate('');
    setStaffEndDate('');
    setStaffReason('');
    setIsSpecialCase(false);
    setSpecialReason('');
    setStaffFormError(null);
  };

  // 48h Preview calculation for Resident
  const noticePreview = useMemo(() => {
    if (!startDate) return null;
    const startMs = new Date(startDate).getTime();
    const nowMs = Date.now();
    const diffHours = (startMs - nowMs) / (1000 * 60 * 60);
    const is48h = diffHours >= 48;
    return {
      hours: Math.round(diffHours * 10) / 10,
      is48h,
      eligible: is48h,
      chargeFirstDay: !is48h,
    };
  }, [startDate]);

  // 48h Notice calculation for Staff
  const staffNoticePreview = useMemo(() => {
    if (!staffStartDate) return null;
    const startMs = new Date(staffStartDate).getTime();
    const nowMs = Date.now();
    const diffHours = (startMs - nowMs) / (1000 * 60 * 60);
    const is48h = diffHours >= 48;
    return {
      hours: Math.round(diffHours * 10) / 10,
      is48h,
    };
  }, [staffStartDate]);

  const filteredItems = useMemo(() => {
    const items = leaveData?.items ?? [];
    if (!search.trim()) return items;
    const needle = search.toLowerCase();
    return items.filter(
      item =>
        item.residentName?.toLowerCase().includes(needle) ||
        item.residentCode?.toLowerCase().includes(needle) ||
        item.reportedBy?.toLowerCase().includes(needle) ||
        item.note?.toLowerCase().includes(needle),
    );
  }, [leaveData?.items, search]);

  const filteredStaffItems = useMemo(() => {
    const items = staffLeaveData?.items ?? [];
    if (!staffSearch.trim()) return items;
    const needle = staffSearch.toLowerCase();
    return items.filter(
      item =>
        item.staffName?.toLowerCase().includes(needle) ||
        item.staffCode?.toLowerCase().includes(needle) ||
        item.reason?.toLowerCase().includes(needle) ||
        item.specialReason?.toLowerCase().includes(needle),
    );
  }, [staffLeaveData?.items, staffSearch]);

  const kpis = useMemo(() => {
    const items = leaveData?.items ?? [];
    return {
      total: items.length,
      active: items.filter(x => x.status === 'ACTIVE_LEAVE').length,
      returned: items.filter(x => x.status === 'RETURNED').length,
      mealDeduction: items.filter(x => x.mealDeductionEligible).length,
    };
  }, [leaveData?.items]);

  const staffKpis = useMemo(() => {
    const items = staffLeaveData?.items ?? [];
    return {
      total: items.length,
      pending: items.filter(x => x.status === 'PENDING').length,
      approved: items.filter(x => x.status === 'APPROVED').length,
      rejected: items.filter(x => x.status === 'REJECTED').length,
      special: items.filter(x => x.isSpecialCase).length,
    };
  }, [staffLeaveData?.items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentId || !startDate || !expectedEndDate) {
      setFormError('Vui lòng điền đầy đủ người cao tuổi, ngày bắt đầu và kết thúc.');
      return;
    }
    if (new Date(expectedEndDate) <= new Date(startDate)) {
      setFormError('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }
    registerMutation.mutate({
      residentId,
      leaveType,
      startDate: new Date(startDate).toISOString(),
      expectedEndDate: new Date(expectedEndDate).toISOString(),
      reportedBy: reportedBy || 'Gia đình',
      reporterRelationship: reporterRelationship || 'Người thân',
      note: note || undefined,
    });
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError(null);

    if (!staffStartDate || !staffEndDate || !staffReason.trim()) {
      setStaffFormError('Vui lòng điền đầy đủ ngày bắt đầu, ngày kết thúc và lý do xin nghỉ.');
      return;
    }

    if (new Date(staffEndDate) <= new Date(staffStartDate)) {
      setStaffFormError('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }

    const startMs = new Date(staffStartDate).getTime();
    const diffHours = (startMs - Date.now()) / (1000 * 60 * 60);
    if (diffHours < 48 && !isSpecialCase) {
      setStaffFormError('Yêu cầu xin nghỉ phép phải được báo trước ít nhất 2 ngày (48 giờ) trừ trường hợp đặc biệt. Vui lòng chọn ô "Trường hợp đặc biệt" và nhập lý do khẩn cấp.');
      return;
    }

    if (isSpecialCase && !specialReason.trim()) {
      setStaffFormError('Vui lòng nhập lý do giải trình cho trường hợp đặc biệt.');
      return;
    }

    createStaffMutation.mutate({
      leaveType: staffLeaveType,
      startDate: new Date(staffStartDate).toISOString(),
      endDate: new Date(staffEndDate).toISOString(),
      reason: staffReason.trim(),
      isSpecialCase,
      specialReason: isSpecialCase ? specialReason.trim() : undefined,
    });
  };

  return (
    <div className="page-content">
      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activeTab === 'STAFF_LEAVE' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('STAFF_LEAVE')}
          style={{ fontWeight: 600, fontSize: '0.95rem' }}
        >
          📋 Xin nghỉ phép
        </button>
        <button
          className={`btn ${activeTab === 'RESIDENT_LEAVE' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('RESIDENT_LEAVE')}
          style={{ fontWeight: 600, fontSize: '0.95rem' }}
        >
          🏥 Tạm vắng Người cao tuổi (RLA-BR-01)
        </button>
      </div>

      {/* ==================== TAB 1: TẠO ĐƠN XIN NGHỈ PHÉP NHÂN VIÊN ==================== */}
      {activeTab === 'STAFF_LEAVE' && (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                Tạo & Quản lý Đơn Xin Nghỉ Phép Nhân Viên
              </h2>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                {isStaffApprover
                  ? 'Tiếp nhận, theo dõi và duyệt đơn xin nghỉ phép của nhân viên toàn trung tâm (Yêu cầu báo trước ≥ 2 ngày).'
                  : 'Gửi đơn xin nghỉ phép cá nhân và theo dõi trạng thái phê duyệt từ Quản lý & Ban Giám đốc.'}
              </p>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <button
                onClick={() => {
                  resetStaffForm();
                  setIsStaffRegisterOpen(true);
                }}
                className="btn btn-primary"
              >
                + Tạo đơn xin nghỉ phép
              </button>
            </div>
          </div>

          {/* KPI Cards for Staff Leave */}
          <div className="kpi-row" style={{ marginBottom: '1.25rem' }}>
            <div className="kpi-card">
              <div className="kpi-label">Tổng số đơn</div>
              <div className="kpi-val">{staffKpis.total}</div>
              <div className="kpi-sub">Đơn xin nghỉ phép</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Chờ duyệt</div>
              <div className="kpi-val" style={{ color: '#d97706' }}>{staffKpis.pending}</div>
              <div className="kpi-sub">Quản lý / BGĐ chưa duyệt</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Đã duyệt</div>
              <div className="kpi-val" style={{ color: '#16a34a' }}>{staffKpis.approved}</div>
              <div className="kpi-sub">Chấp thuận nghỉ phép</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Từ chối</div>
              <div className="kpi-val" style={{ color: '#dc2626' }}>{staffKpis.rejected}</div>
              <div className="kpi-sub">Không chấp thuận</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Trường hợp đặc biệt</div>
              <div className="kpi-val" style={{ color: '#2563eb' }}>{staffKpis.special}</div>
              <div className="kpi-sub">Nghỉ đột xuất (&lt; 2 ngày)</div>
            </div>
          </div>

          {/* Filters */}
          <div className="filter-card">
            <div className="filter-group">
              <div className="filter-item">
                <span className="filter-label">Trạng thái:</span>
                <select
                  value={staffStatusFilter}
                  onChange={e => setStaffStatusFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Từ chối</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>
            </div>

            <div className="filter-group">
              <input
                type="text"
                placeholder="Tìm theo tên nhân viên, lý do..."
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                className="form-input"
                style={{ width: '260px' }}
              />
            </div>
          </div>

          {/* Table of Staff Leave Requests */}
          {!isStaffLoading && filteredStaffItems.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
              Chưa có đơn xin nghỉ phép nào được tạo.
            </div>
          ) : (
            <div className="table-responsive" style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
              <table className="ui-table table-wide-950" style={{ minWidth: '950px' }}>
                <thead>
                  <tr>
                    <th>Nhân viên xin nghỉ</th>
                    <th>Loại nghỉ</th>
                    <th>Thời gian nghỉ</th>
                    <th>Báo trước & Quy định</th>
                    <th>Lý do xin nghỉ</th>
                    <th>Trạng thái</th>
                    <th>Người duyệt / Ghi chú</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isStaffLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                        Đang tải danh sách xin nghỉ phép...
                      </td>
                    </tr>
                  ) : (
                    filteredStaffItems.map((item: StaffLeaveItem) => {
                      const statusMeta = STAFF_STATUS_BADGE[item.status] || {
                        label: item.status,
                        className: 'badge badge-neutral',
                      };
                      const canApproveReject = isStaffApprover && item.status === 'PENDING';
                      const canCancelItem = (item.staffActorId === actorId || isStaffApprover) && item.status === 'PENDING';

                      return (
                        <tr key={item.leaveId}>
                          <td>
                            <div className="cell-primary">{item.staffName || item.staffActorId}</div>
                            <div className="cell-secondary">{item.staffCode || ''} • {item.staffRole}</div>
                          </td>
                          <td>
                            <span className="badge badge-neutral">
                              {STAFF_LEAVE_TYPE_LABEL[item.leaveType] || item.leaveType}
                            </span>
                          </td>
                          <td>
                            <div>
                              {new Date(item.startDate).toLocaleDateString('vi-VN')} &rarr; {new Date(item.endDate).toLocaleDateString('vi-VN')}
                            </div>
                            <div className="cell-secondary">
                              Từ {new Date(item.startDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} đến {new Date(item.endDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td>
                            {item.isSpecialCase ? (
                              <span className="badge badge-warning" style={{ backgroundColor: '#f59e0b', color: '#ffffff', fontWeight: 600 }}>
                                ⚡ Trường hợp đặc biệt
                              </span>
                            ) : (
                              <span className={item.isAdvanceNotice48h ? 'badge badge-success' : 'badge badge-warning'}>
                                {item.noticeHours != null ? `${item.noticeHours}h` : '—'} {item.isAdvanceNotice48h ? '(≥ 2 ngày)' : '(< 2 ngày)'}
                              </span>
                            )}
                          </td>
                          <td style={{ maxWidth: '240px' }}>
                            <div>{item.reason}</div>
                            {item.specialReason && (
                              <div className="cell-secondary" style={{ color: '#d97706', fontStyle: 'italic', marginTop: '2px' }}>
                                Lý do đặc biệt: {item.specialReason}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={statusMeta.className}>{statusMeta.label}</span>
                          </td>
                          <td>
                            {item.reviewerName || item.reviewedBy ? (
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.reviewerName || item.reviewedBy}</div>
                                {item.reviewNote && <div className="cell-secondary">"{item.reviewNote}"</div>}
                              </div>
                            ) : (
                              <span className="cell-secondary">—</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="btn-group">
                              {canApproveReject && (
                                <>
                                  <button
                                    onClick={() => {
                                      setReviewItem(item);
                                      setReviewAction('APPROVE');
                                      setReviewNote('');
                                    }}
                                    className="btn btn-sm btn-success"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReviewItem(item);
                                      setReviewAction('REJECT');
                                      setReviewNote('');
                                    }}
                                    className="btn btn-sm btn-secondary"
                                    style={{ color: '#dc2626' }}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                              {canCancelItem && (
                                <button
                                  onClick={() => {
                                    if (confirm('Bạn có chắc chắn muốn hủy đơn xin nghỉ phép này?')) {
                                      cancelStaffMutation.mutate(item.leaveId);
                                    }
                                  }}
                                  className="btn btn-sm btn-ghost"
                                  style={{ color: 'var(--status-danger)' }}
                                >
                                  Hủy
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal Tạo Đơn Xin Nghỉ Phép (Staff) */}
          {isStaffRegisterOpen && (
            <div className="modal-overlay">
              <div className="modal-dialog modal-dialog-lg">
                <div className="modal-header">
                  <h2 className="modal-title">Tạo Đơn Xin Nghỉ Phép Nhân Viên</h2>
                  <button onClick={() => setIsStaffRegisterOpen(false)} className="modal-close">
                    &times;
                  </button>
                </div>

                <form onSubmit={handleStaffSubmit}>
                  <div className="modal-body">
                    {staffFormError && (
                      <div className="alert-card alert-danger" style={{ marginBottom: '1rem' }}>
                        <span>{staffFormError}</span>
                      </div>
                    )}

                    <div className="form-row">
                      <div>
                        <label className="form-label">
                          Loại nghỉ phép <span className="req">*</span>
                        </label>
                        <select
                          value={staffLeaveType}
                          onChange={e => setStaffLeaveType(e.target.value as StaffLeaveType)}
                          className="form-select"
                          style={{ width: '100%' }}
                        >
                          <option value="ANNUAL">Nghỉ phép năm</option>
                          <option value="PERSONAL">Nghỉ việc riêng</option>
                          <option value="SICK">Nghỉ ốm / Khẩn cấp y tế</option>
                          <option value="UNPAID">Nghỉ không hưởng lương</option>
                          <option value="OTHER">Lý do khác</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">
                          Thời gian bắt đầu nghỉ <span className="req">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={staffStartDate}
                          onChange={e => setStaffStartDate(e.target.value)}
                          required
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div>
                        <label className="form-label">
                          Thời gian kết thúc nghỉ <span className="req">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={staffEndDate}
                          onChange={e => setStaffEndDate(e.target.value)}
                          required
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: '#d97706' }}>
                          <input
                            type="checkbox"
                            checked={isSpecialCase}
                            onChange={e => setIsSpecialCase(e.target.checked)}
                            style={{ width: '18px', height: '18px' }}
                          />
                          ⚡ Trường hợp đặc biệt (khẩn cấp / đột xuất &lt; 2 ngày)
                        </label>
                      </div>
                    </div>

                    {/* Notice Check Banner */}
                    {staffNoticePreview && (
                      <div className={`alert-card ${staffNoticePreview.is48h ? 'alert-success' : 'alert-info'}`} style={{ marginTop: '0.5rem' }}>
                        <div>
                          <strong>Quy định báo trước 2 ngày (48 giờ):</strong>
                          <div style={{ marginTop: '0.2rem' }}>
                            Thời gian báo trước: <b>{staffNoticePreview.hours} giờ</b>.
                            {staffNoticePreview.is48h ? (
                              <span> Đạt quy định báo trước <b>≥ 2 ngày</b>.</span>
                            ) : (
                              <span style={{ color: '#b45309' }}>
                                {' '}Nhỏ hơn 2 ngày. Yêu cầu tích chọn <b>"Trường hợp đặc biệt"</b> và nhập lý do giải trình bên dưới.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {isSpecialCase && (
                      <div>
                        <label className="form-label">
                          Lý do trường hợp đặc biệt / khẩn cấp <span className="req">*</span>
                        </label>
                        <input
                          type="text"
                          value={specialReason}
                          onChange={e => setSpecialReason(e.target.value)}
                          placeholder="Ví dụ: Sốt đột xuất 39 độ, gia đình có việc khẩn cấp..."
                          className="form-input"
                          style={{ width: '100%' }}
                          required={isSpecialCase}
                        />
                      </div>
                    )}

                    <div>
                      <label className="form-label">
                        Lý do xin nghỉ phép <span className="req">*</span>
                      </label>
                      <textarea
                        value={staffReason}
                        onChange={e => setStaffReason(e.target.value)}
                        rows={3}
                        required
                        placeholder="Nêu rõ lý do nghỉ phép, kế hoạch bàn giao công việc ca trực..."
                        className="form-textarea"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setIsStaffRegisterOpen(false)}
                      className="btn btn-secondary"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={createStaffMutation.isPending}
                      className="btn btn-primary"
                    >
                      {createStaffMutation.isPending ? 'Đang gửi...' : 'Gửi đơn xin nghỉ phép'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Phê Duyệt / Từ Chối Staff Leave */}
          {reviewItem && reviewAction && (
            <div className="modal-overlay">
              <div className="modal-dialog">
                <div className="modal-header">
                  <h2 className="modal-title">
                    {reviewAction === 'APPROVE' ? 'Phê Duyệt Đơn Xin Nghỉ Phép' : 'Từ Chối Đơn Xin Nghỉ Phép'}
                  </h2>
                  <button onClick={() => setReviewItem(null)} className="modal-close">
                    &times;
                  </button>
                </div>

                <div className="modal-body">
                  <p style={{ margin: '0 0 0.75rem 0' }}>
                    Nhân viên: <b>{reviewItem.staffName || reviewItem.staffActorId}</b> ({STAFF_LEAVE_TYPE_LABEL[reviewItem.leaveType]})
                  </p>
                  <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Lý do xin nghỉ: {reviewItem.reason}
                  </p>

                  <label className="form-label">
                    Ghi chú của Quản lý / Ban Giám đốc {reviewAction === 'REJECT' && <span className="req">*</span>}
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={3}
                    placeholder={reviewAction === 'APPROVE' ? 'Nhập lưu ý hoặc hướng dẫn bàn giao (nếu có)...' : 'Nhập lý do từ chối...'}
                    className="form-textarea"
                  />
                </div>

                <div className="modal-footer">
                  <button onClick={() => setReviewItem(null)} className="btn btn-secondary">
                    Hủy
                  </button>
                  {reviewAction === 'APPROVE' ? (
                    <button
                      onClick={() => approveStaffMutation.mutate({ id: reviewItem.leaveId, note: reviewNote })}
                      disabled={approveStaffMutation.isPending}
                      className="btn btn-success"
                    >
                      {approveStaffMutation.isPending ? 'Đang duyệt...' : 'Xác nhận duyệt phép'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!reviewNote.trim()) {
                          alert('Vui lòng nhập lý do từ chối');
                          return;
                        }
                        rejectStaffMutation.mutate({ id: reviewItem.leaveId, note: reviewNote });
                      }}
                      disabled={rejectStaffMutation.isPending}
                      className="btn btn-danger"
                    >
                      {rejectStaffMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== TAB 2: TẠM VẮNG NGƯỜI CAO TUỔI ==================== */}
      {activeTab === 'RESIDENT_LEAVE' && (
        <>
          {canManage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
              <button
                onClick={() => {
                  resetForm();
                  setIsRegisterOpen(true);
                }}
                className="btn btn-primary"
              >
                + Đăng ký tạm vắng mới
              </button>
            </div>
          )}

          {/* KPI Cards */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Tổng số đơn vắng</div>
              <div className="kpi-val">{kpis.total}</div>
              <div className="kpi-sub">Ghi nhận toàn Trung tâm</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Đang tạm vắng</div>
              <div className="kpi-val" style={{ color: '#d97706' }}>{kpis.active}</div>
              <div className="kpi-sub">Hiện ở ngoài Tâm An</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Đã trở lại Tâm An</div>
              <div className="kpi-val" style={{ color: '#16a34a' }}>{kpis.returned}</div>
              <div className="kpi-sub">Đã hoàn thành kỳ nghỉ</div>
            </div>
            {canViewMealDeduction ? (
              <div className="kpi-card">
                <div className="kpi-label">Giảm trừ tiền ăn</div>
                <div className="kpi-val" style={{ color: '#2563eb' }}>{kpis.mealDeduction}</div>
                <div className="kpi-sub">Đủ điều kiện RLA-BR-01</div>
              </div>
            ) : (
              <div className="kpi-card">
                <div className="kpi-label">Báo trước hợp lệ</div>
                <div className="kpi-val" style={{ color: '#2563eb' }}>{kpis.mealDeduction}</div>
                <div className="kpi-sub">Thông báo kịp thời cho điều phối</div>
              </div>
            )}
          </div>

          {/* Filter Card */}
          <div className="filter-card">
            <div className="filter-group">
              <div className="filter-item">
                <span className="filter-label">Trạng thái:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="REGISTERED">Đã đăng ký</option>
                  <option value="ACTIVE_LEAVE">Đang tạm vắng</option>
                  <option value="RETURNED">Đã trở lại</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="filter-item">
                <span className="filter-label">Người cao tuổi:</span>
                <select
                  value={residentFilter}
                  onChange={e => setResidentFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="ALL">Tất cả người cao tuổi</option>
                  {residentsData?.map(r => (
                    <option key={r.resident.residentId} value={r.resident.residentId}>
                      {r.resident.displayName} ({r.resident.residentCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-group">
              <input
                type="text"
                placeholder="Tìm theo tên, mã hoặc ghi chú..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input"
                style={{ width: '260px' }}
              />
            </div>
          </div>

          {/* Data Table / Mobile Cards */}
          {!isLoading && filteredItems.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
              Không tìm thấy yêu cầu tạm vắng nào.
            </div>
          ) : (
            <>
              <div className="desktop-only-table">
                <div className="table-responsive">
                  <table className="ui-table table-wide-1000" style={{ minWidth: '1000px' }}>
                    <thead>
                      <tr>
                        <th>Người cao tuổi</th>
                        <th>Loại tạm vắng</th>
                        <th>Thời gian dự kiến</th>
                        <th>Báo trước</th>
                        {canViewMealDeduction && <th>Giảm trừ tiền ăn</th>}
                        <th>Người báo / Quan hệ</th>
                        <th>Trạng thái</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={canViewMealDeduction ? 8 : 7} className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                            Đang tải danh sách tạm vắng...
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item: ResidentLeaveItem) => {
                          const statusMeta = STATUS_BADGE[item.status] || {
                            label: item.status,
                            className: 'badge badge-neutral',
                          };
                          const canConfirmSubsequent = canManage && !item.subsequentDaysConfirmed && item.status !== 'CANCELLED' && item.status !== 'RETURNED';
                          const canMarkReturn = canManage && (item.status === 'ACTIVE_LEAVE' || item.status === 'REGISTERED');
                          const canCancel = canManage && item.status !== 'RETURNED' && item.status !== 'CANCELLED';

                          return (
                            <tr key={item.leaveRequestId}>
                              <td>
                                <div className="cell-primary">{item.residentName || item.residentId}</div>
                                <div className="cell-secondary">{item.residentCode}</div>
                              </td>
                              <td>
                                <span className="badge badge-neutral">
                                  {LEAVE_TYPE_LABEL[item.leaveType] || item.leaveType}
                                </span>
                              </td>
                              <td>
                                <div>
                                  {new Date(item.startDate).toLocaleDateString('vi-VN')} &rarr; {new Date(item.expectedEndDate).toLocaleDateString('vi-VN')}
                                </div>
                                {item.actualEndDate && (
                                  <div className="cell-secondary" style={{ color: '#16a34a' }}>
                                    Về ngày: {new Date(item.actualEndDate).toLocaleDateString('vi-VN')}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={item.isAdvanceNotice48h ? 'badge badge-success' : 'badge badge-warning'}>
                                  {item.noticeHours != null ? `${item.noticeHours}h` : '—'} {item.isAdvanceNotice48h ? '(\u2265 48h)' : '(< 48h)'}
                                </span>
                                {canViewMealDeduction && item.firstDayChargeable && (
                                  <div className="cell-secondary" style={{ color: '#dc2626' }}>
                                    Tính phí ngày đầu
                                  </div>
                                )}
                              </td>
                              {canViewMealDeduction && (
                                <td>
                                  {item.mealDeductionEligible ? (
                                    <span className="badge badge-success">Được giảm trừ</span>
                                  ) : (
                                    <span className="badge badge-neutral">Không giảm trừ</span>
                                  )}
                                  {item.subsequentDaysConfirmed && (
                                    <div className="cell-secondary" style={{ color: '#16a34a' }}>
                                      Đã xác nhận ngày sau
                                    </div>
                                  )}
                                </td>
                              )}
                              <td>
                                <div>{item.reportedBy || '—'}</div>
                                <div className="cell-secondary">{item.reporterRelationship || ''}</div>
                              </td>
                              <td>
                                <span className={statusMeta.className}>{statusMeta.label}</span>
                              </td>
                              <td className="text-right">
                                <div className="btn-group">
                                  {canConfirmSubsequent && (
                                    <button
                                      onClick={() => confirmMutation.mutate(item.leaveRequestId)}
                                      className="btn btn-sm btn-secondary"
                                      title={canViewMealDeduction ? "Xác nhận tiếp tục vắng để giảm trừ tiền ăn các ngày tiếp theo" : "Xác nhận tiếp tục vắng mặt"}
                                    >
                                      Xác nhận ngày sau
                                    </button>
                                  )}
                                  {canMarkReturn && (
                                    <button
                                      onClick={() => returnMutation.mutate(item.leaveRequestId)}
                                      className="btn btn-sm btn-success"
                                    >
                                      Trở lại Tâm An
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setViewingPrintItem(item)}
                                    className="btn btn-sm btn-neutral"
                                    title="In phiếu tạm vắng & giảm trừ viện phí A4 (RLA-BR-01)"
                                  >
                                    🖨️ In Phiếu
                                  </button>
                                  {canCancel && (
                                    <button
                                      onClick={() => {
                                        const reason = prompt('Nhập lý do hủy yêu cầu tạm vắng:');
                                        if (reason) cancelMutation.mutate({ id: item.leaveRequestId, reason });
                                      }}
                                      className="btn btn-sm btn-ghost"
                                      style={{ color: 'var(--status-danger)' }}
                                    >
                                      Hủy
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View (< 768px) */}
              <div className="mobile-only-cards">
                {filteredItems.map((item: ResidentLeaveItem) => {
                  const statusMeta = STATUS_BADGE[item.status] || {
                    label: item.status,
                    className: 'badge badge-neutral',
                  };
                  const canConfirmSubsequent = canManage && !item.subsequentDaysConfirmed && item.status !== 'CANCELLED' && item.status !== 'RETURNED';
                  const canMarkReturn = canManage && (item.status === 'ACTIVE_LEAVE' || item.status === 'REGISTERED');
                  const canCancel = canManage && item.status !== 'RETURNED' && item.status !== 'CANCELLED';

                  return (
                    <div key={item.leaveRequestId} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <div className="mobile-card-title">
                          {getElderIcon((item as any).gender, item.residentName || item.residentId)} {formatResidentNameWithSalutation(item.residentName || item.residentId, (item as any).gender)}{' '}
                          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>({item.residentCode})</span>
                        </div>
                        <span className={statusMeta.className}>{statusMeta.label}</span>
                      </div>

                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Loại vắng:</span>
                        <span className="mobile-card-value">{LEAVE_TYPE_LABEL[item.leaveType] || item.leaveType}</span>
                      </div>

                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Thời gian:</span>
                        <span className="mobile-card-value">
                          {new Date(item.startDate).toLocaleDateString('vi-VN')} &rarr; {new Date(item.expectedEndDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Báo trước:</span>
                        <span className="mobile-card-value">
                          <span className={item.isAdvanceNotice48h ? 'badge badge-success' : 'badge badge-warning'}>
                            {item.noticeHours != null ? `${item.noticeHours}h` : '—'} {item.isAdvanceNotice48h ? '(\u2265 48h)' : '(< 48h)'}
                          </span>
                        </span>
                      </div>

                      {canViewMealDeduction && (
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Giảm trừ ăn:</span>
                          <span className="mobile-card-value">
                            {item.mealDeductionEligible ? (
                              <span className="badge badge-success">Được giảm trừ</span>
                            ) : (
                              <span className="badge badge-neutral">Không giảm trừ</span>
                            )}
                          </span>
                        </div>
                      )}

                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Người báo:</span>
                        <span className="mobile-card-value">
                          {item.reportedBy || '—'} {item.reporterRelationship ? `(${item.reporterRelationship})` : ''}
                        </span>
                      </div>

                      <div className="mobile-card-actions">
                        {canConfirmSubsequent && (
                          <button
                            onClick={() => confirmMutation.mutate(item.leaveRequestId)}
                            className="btn btn-sm btn-secondary"
                          >
                            Xác nhận ngày sau
                          </button>
                        )}
                        {canMarkReturn && (
                          <button
                            onClick={() => returnMutation.mutate(item.leaveRequestId)}
                            className="btn btn-sm btn-success"
                          >
                            ✓ Trở lại Tâm An
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => {
                              const reason = prompt('Nhập lý do hủy yêu cầu tạm vắng:');
                              if (reason) cancelMutation.mutate({ id: item.leaveRequestId, reason });
                            }}
                            className="btn btn-sm btn-ghost"
                            style={{ color: 'var(--status-danger)' }}
                          >
                            Hủy đơn
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Registration Modal for Resident Leave */}
          {isRegisterOpen && (
            <div className="modal-overlay">
              <div className="modal-dialog modal-dialog-lg">
                <div className="modal-header">
                  <h2 className="modal-title">Đăng Ký Tạm Vắng Người Cao Tuổi</h2>
                  <button onClick={() => setIsRegisterOpen(false)} className="modal-close">
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    {formError && (
                      <div className="alert-card alert-danger">
                        <span>{formError}</span>
                      </div>
                    )}

                    <div>
                      <label className="form-label">
                        Người cao tuổi <span className="req">*</span>
                      </label>
                      <select
                        value={residentId}
                        onChange={e => setResidentId(e.target.value)}
                        required
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Chọn người cao tuổi --</option>
                        {residentsData?.map(r => (
                          <option key={r.resident.residentId} value={r.resident.residentId}>
                            {r.resident.displayName} ({r.resident.residentCode}) - Phòng: {r.resident.room || 'Chưa gán'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div>
                        <label className="form-label">
                          Lý do tạm vắng <span className="req">*</span>
                        </label>
                        <select
                          value={leaveType}
                          onChange={e => setLeaveType(e.target.value as LeaveType)}
                          className="form-select"
                          style={{ width: '100%' }}
                        >
                          <option value="FAMILY_VISIT">Thăm gia đình / Về nhà</option>
                          <option value="MEDICAL_OUTING">Khám bệnh bên ngoài</option>
                          <option value="TEMPORARY_HOSPITALIZATION">Điều trị bệnh viện</option>
                          <option value="VACATION">Nghỉ dưỡng / Du lịch</option>
                          <option value="OTHER">Lý do khác</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">
                          Thời điểm bắt đầu vắng <span className="req">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          required
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div>
                        <label className="form-label">
                          Thời điểm dự kiến về lại <span className="req">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={expectedEndDate}
                          onChange={e => setExpectedEndDate(e.target.value)}
                          required
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label className="form-label">Người báo tin & Quan hệ</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Họ tên người báo"
                            value={reportedBy}
                            onChange={e => setReportedBy(e.target.value)}
                            className="form-input"
                          />
                          <input
                            type="text"
                            placeholder="Quan hệ (Con, Cháu...)"
                            value={reporterRelationship}
                            onChange={e => setReporterRelationship(e.target.value)}
                            className="form-input"
                          />
                        </div>
                      </div>
                    </div>

                    {/* RLA-BR-01 Rule Preview Notice */}
                    {noticePreview && (
                      <div className={`alert-card ${noticePreview.is48h ? 'alert-success' : 'alert-info'}`}>
                        <div>
                          <strong>Đánh giá quy tắc báo trước tạm vắng:</strong>
                          <div style={{ marginTop: '0.2rem' }}>
                            Thời gian báo trước: <b>{noticePreview.hours} giờ</b>.
                            {canViewMealDeduction ? (
                              noticePreview.is48h ? (
                                <span> Đạt chuẩn <b>≥ 48h</b> &rarr; <b>Được giảm trừ toàn bộ tiền ăn</b> trong các ngày vắng mặt.</span>
                              ) : (
                                <span> Báo dưới 48h &rarr; <b>Tính phí ngày đầu tiên</b>. Tiền ăn các ngày tiếp theo sẽ được giảm trừ khi nhân viên xác nhận.</span>
                              )
                            ) : (
                              noticePreview.is48h ? (
                                <span> Đạt chuẩn báo trước <b>≥ 48h</b> theo quy định của Trung tâm.</span>
                              ) : (
                                <span> Báo gấp dưới 48h, cần phối hợp với bộ phận quản lý để điều phối chăm sóc.</span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="form-label">Ghi chú thêm</label>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={2}
                        placeholder="Thông tin liên hệ khi cần, thuốc mang theo..."
                        className="form-textarea"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setIsRegisterOpen(false)}
                      className="btn btn-secondary"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={registerMutation.isPending}
                      className="btn btn-primary"
                    >
                      {registerMutation.isPending ? 'Đang lưu...' : 'Lưu đăng ký tạm vắng'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL XEM TRƯỚC & IN PHIẾU TẠM VẮNG RLA-BR-01 */}
          {viewingPrintItem && (
            <div className="modal-overlay print-modal-overlay" onClick={() => setViewingPrintItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
              <div className="modal-card printable-a4-sheet" onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '750px', width: '100%', padding: '1.75rem', color: '#0f172a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #166534', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>TRUNG TÂM DƯỠNG LÃO TÂM AN CARE — QUY TRÌNH RLA-BR-01</div>
                    <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', color: '#0f172a' }}>PHIẾU ĐĂNG KÝ TẠM VẮNG & GIẢM TRỪ VIỆN PHÍ</h2>
                  </div>
                  <button type="button" className="no-print" onClick={() => setViewingPrintItem(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>

                <div className="table-responsive" style={{ border: '1px solid #cbd5e1', padding: '1.25rem', borderRadius: '0.5rem', background: '#ffffff', marginBottom: '1.25rem', overflowX: 'auto' }}>
                  <table className="table-wide-650" style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '6px', fontWeight: 700, width: '35%' }}>Họ tên người cao tuổi:</td>
                        <td style={{ padding: '6px' }}><b>{viewingPrintItem.residentName || viewingPrintItem.residentId}</b> ({viewingPrintItem.residentCode})</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px', fontWeight: 700 }}>Loại hình tạm vắng:</td>
                        <td style={{ padding: '6px' }}>{LEAVE_TYPE_LABEL[viewingPrintItem.leaveType] || viewingPrintItem.leaveType}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px', fontWeight: 700 }}>Thời gian vắng dự kiến:</td>
                        <td style={{ padding: '6px' }}>Từ <b>{new Date(viewingPrintItem.startDate).toLocaleDateString('vi-VN')}</b> đến <b>{new Date(viewingPrintItem.expectedEndDate).toLocaleDateString('vi-VN')}</b></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px', fontWeight: 700 }}>Báo trước 48h (RLA-BR-01):</td>
                        <td style={{ padding: '6px' }}>
                          {viewingPrintItem.isAdvanceNotice48h ? '✅ Đủ điều kiện báo trước (≥ 48h)' : '⚠️ Báo trước < 48h (Ngày đầu tính phí trọn gói)'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px', fontWeight: 700 }}>Quyền lợi giảm trừ tiền ăn:</td>
                        <td style={{ padding: '6px' }}>
                          {viewingPrintItem.mealDeductionEligible ? '✅ Được giảm trừ tiền ăn theo quy chế' : '❌ Không thuộc diện giảm trừ tiền ăn'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px', fontWeight: 700 }}>Người báo / Thân nhân:</td>
                        <td style={{ padding: '6px' }}>{viewingPrintItem.reportedBy || '—'} ({viewingPrintItem.reporterRelationship || 'Thân nhân'})</td>
                      </tr>
                      {viewingPrintItem.note && (
                        <tr>
                          <td style={{ padding: '6px', fontWeight: 700 }}>Ghi chú vận hành:</td>
                          <td style={{ padding: '6px' }}>{viewingPrintItem.note}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <div className="signature-box" style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center', fontSize: '0.82rem' }}>
                    <div>
                      <b>ĐẠI DIỆN THÂN NHÂN</b><br />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Ký & ghi rõ họ tên)</span>
                    </div>
                    <div>
                      <b>ĐIỀU DƯỠNG TRỰC CA</b><br />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Ký & ghi rõ họ tên)</span>
                    </div>
                    <div>
                      <b>BAN GIÁM ĐỐC / KẾ TOÁN</b><br />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Duyệt & xác nhận)</span>
                    </div>
                  </div>
                </div>

                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => triggerPrint()} className="btn btn-primary no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                    🖨️ In Phiếu (A4)
                  </button>
                  <button type="button" onClick={() => setViewingPrintItem(null)} className="btn btn-neutral">
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
