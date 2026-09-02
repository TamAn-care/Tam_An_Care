import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import {
  cancelLeaveRequest,
  confirmSubsequentDays,
  createLeaveRequest,
  fetchLeaveRequests,
  recordLeaveReturn,
  LeaveStatus,
  LeaveType,
  ResidentLeaveItem,
} from '../../api/resident-leave';
import { listResidents } from '../../api/residents';

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

export default function ResidentLeavePage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const canManage = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER' || actorRole === 'NURSE';
  const canViewMealDeduction = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER' || actorRole === 'ACCOUNTANT';

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [residentFilter, setResidentFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [residentId, setResidentId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('FAMILY_VISIT');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [reporterRelationship, setReporterRelationship] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: leaveData, isLoading } = useQuery({
    queryKey: ['resident-leave-requests', statusFilter, residentFilter, actorId],
    queryFn: () =>
      fetchLeaveRequests(actorId, actorRole, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        residentId: residentFilter === 'ALL' ? undefined : residentFilter,
        limit: 100,
      }),
    enabled: Boolean(actorId),
  });

  const { data: residentsData } = useQuery({
    queryKey: ['residents-list', actorId],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor),
  });

  // Mutations
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

  // 48h Preview calculation
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

  const kpis = useMemo(() => {
    const items = leaveData?.items ?? [];
    return {
      total: items.length,
      active: items.filter(x => x.status === 'ACTIVE_LEAVE').length,
      returned: items.filter(x => x.status === 'RETURNED').length,
      mealDeduction: items.filter(x => x.mealDeductionEligible).length,
    };
  }, [leaveData?.items]);

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

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Quản Lý Nghỉ Phép & Tạm Vắng Người Cao Tuổi</h1>
            <p className="page-description">
              {canViewMealDeduction
                ? 'Quy tắc RLA-BR-01: Báo trước ≥ 48 giờ được giảm trừ tiền ăn theo ngày vắng mặt. Báo gấp < 48 giờ tính phí ngày đầu, các ngày sau giảm trừ khi được xác nhận.'
                : 'Quản lý lịch trình tạm vắng, tiếp nhận thông tin người bảo hộ và theo dõi ngày người cao tuổi trở lại Tâm An.'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setIsRegisterOpen(true);
              }}
              className="btn btn-primary"
            >
              + Đăng ký tạm vắng mới
            </button>
          )}
        </div>
      </div>

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

      {/* Data Table */}
      <div className="table-responsive">
        <table className="ui-table">
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
                  Đang tải danh sách nghỉ phép & tạm vắng...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={canViewMealDeduction ? 8 : 7} className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                  Không tìm thấy yêu cầu nghỉ phép hoặc tạm vắng nào.
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
                        {canCancel && (
                          <button
                            onClick={() => {
                              const reason = prompt('Nhập lý do hủy yêu cầu tạm vắng:');
                              if (reason) cancelMutation.mutate({ id: item.leaveRequestId, reason });
                            }}
                            className="btn btn-sm btn-danger-outline"
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

      {/* Registration Modal */}
      {isRegisterOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog modal-dialog-lg">
            <div className="modal-header">
              <h2 className="modal-title">Đăng Ký Nghỉ Phép / Tạm Vắng Người Cao Tuổi</h2>
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
                            <span> Đạt chuẩn $\ge 48$h &rarr; <b>Được giảm trừ toàn bộ tiền ăn</b> trong các ngày vắng mặt.</span>
                          ) : (
                            <span> Báo dưới 48h &rarr; <b>Tính phí ngày đầu tiên</b>. Tiền ăn các ngày tiếp theo sẽ được giảm trừ khi nhân viên xác nhận.</span>
                          )
                        ) : (
                          noticePreview.is48h ? (
                            <span> Đạt chuẩn báo trước $\ge 48$h theo quy định của Trung tâm.</span>
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
    </div>
  );
}
