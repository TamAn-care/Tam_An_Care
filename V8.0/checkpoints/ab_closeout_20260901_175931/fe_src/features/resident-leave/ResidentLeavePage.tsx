import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import {
  fetchLeaveRequests,
  createLeaveRequest,
  confirmSubsequentDays,
  recordLeaveReturn,
  cancelLeaveRequest,
  LeaveType,
  LeaveStatus,
  ResidentLeaveItem,
} from '../../api/resident-leave';
import { listResidents, ResidentContextResponse } from '../../api/residents';

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  FAMILY_VISIT: 'Thăm gia đình',
  MEDICAL_OUTING: 'Khám bệnh ngoài viện',
  TEMPORARY_HOSPITALIZATION: 'Nhập viện điều trị',
  VACATION: 'Nghỉ dưỡng/Du lịch',
  OTHER: 'Khác',
};

const STATUS_LABELS: Record<LeaveStatus, { text: string; bg: string; textCol: string }> = {
  REGISTERED: { text: 'Đã đăng ký', bg: 'bg-blue-100', textCol: 'text-blue-800' },
  ACTIVE_LEAVE: { text: 'Đang tạm vắng', bg: 'bg-amber-100', textCol: 'text-amber-800' },
  RETURNED: { text: 'Đã trở lại viện', bg: 'bg-green-100', textCol: 'text-green-800' },
  CANCELLED: { text: 'Đã hủy', bg: 'bg-gray-100', textCol: 'text-gray-800' },
};

export default function ResidentLeavePage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [residentFilter, setResidentFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('FAMILY_VISIT');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [reporterRelationship, setReporterRelationship] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: residentsData } = useQuery<ResidentContextResponse[]>({
    queryKey: ['residents-list-active', actorId],
    queryFn: () => listResidents(actor),
  });

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

  // Calculate advance notice live
  const noticeCalc = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate).getTime();
    const now = Date.now();
    const hours = Math.round(((start - now) / (1000 * 60 * 60)) * 10) / 10;
    const is48h = hours >= 48.0;
    return { hours, is48h };
  }, [startDate]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => createLeaveRequest(actorId, actorRole, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Lỗi khi tạo yêu cầu tạm vắng');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmSubsequentDays(actorId, actorRole, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] });
    },
    onError: (err: any) => alert(err.message),
  });

  const returnMutation = useMutation({
    mutationFn: (id: string) => recordLeaveReturn(actorId, actorRole, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] });
    },
    onError: (err: any) => alert(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelLeaveRequest(actorId, actorRole, id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resident-leave-requests'] });
    },
    onError: (err: any) => alert(err.message),
  });

  const resetForm = () => {
    setSelectedResidentId('');
    setLeaveType('FAMILY_VISIT');
    setStartDate('');
    setExpectedEndDate('');
    setReportedBy('');
    setReporterRelationship('');
    setNote('');
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidentId || !startDate || !expectedEndDate || !reportedBy || !reporterRelationship) {
      setFormError('Vui lòng điền đầy đủ các trường thông tin bắt buộc.');
      return;
    }
    createMutation.mutate({
      residentId: selectedResidentId,
      leaveType,
      startDate: new Date(startDate).toISOString(),
      expectedEndDate: new Date(expectedEndDate).toISOString(),
      reportedBy,
      reporterRelationship,
      note: note || undefined,
    });
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản Lý Nghỉ Phép & Tạm Vắng Người Cao Tuổi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quy định RLA-BR-01: Báo trước ≥48h để được giảm trừ tiền ăn. Báo muộn &lt;48h tính ngày đầu tiên.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          + Đăng ký tạm vắng mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm p-2 border focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="REGISTERED">Đã đăng ký</option>
            <option value="ACTIVE_LEAVE">Đang tạm vắng</option>
            <option value="RETURNED">Đã trở lại</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Người cao tuổi:</label>
          <select
            value={residentFilter}
            onChange={e => setResidentFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm p-2 border focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="ALL">Tất cả người cao tuổi</option>
            {residentsData?.map(item => (
              <option key={item.resident.residentId} value={item.resident.residentId}>
                {item.resident.displayName} ({item.resident.residentCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Người cao tuổi</th>
                <th className="px-4 py-3 text-left font-semibold">Loại tạm vắng</th>
                <th className="px-4 py-3 text-left font-semibold">Thời gian dự kiến</th>
                <th className="px-4 py-3 text-left font-semibold">Báo trước</th>
                <th className="px-4 py-3 text-left font-semibold">Giảm trừ tiền ăn</th>
                <th className="px-4 py-3 text-left font-semibold">Người báo</th>
                <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    Đang tải dữ liệu tạm vắng...
                  </td>
                </tr>
              ) : leaveData?.items?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    Không có yêu cầu tạm vắng nào.
                  </td>
                </tr>
              ) : (
                leaveData?.items?.map((item: ResidentLeaveItem) => {
                  const statusMeta = STATUS_LABELS[item.status] || {
                    text: item.status,
                    bg: 'bg-gray-100',
                    textCol: 'text-gray-800',
                  };

                  return (
                    <tr key={item.leaveRequestId} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.residentName || item.residentId}</div>
                        <div className="text-xs text-gray-500">{item.residentCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">
                          {LEAVE_TYPE_LABELS[item.leaveType] || item.leaveType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>Từ: {new Date(item.startDate).toLocaleDateString('vi-VN')}</div>
                        <div>Đến: {new Date(item.expectedEndDate).toLocaleDateString('vi-VN')}</div>
                        {item.actualEndDate && (
                          <div className="text-xs text-emerald-600">
                            Thực tế: {new Date(item.actualEndDate).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                            item.isAdvanceNotice48h
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.noticeHours}h {item.isAdvanceNotice48h ? '(≥48h)' : '(<48h)'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.mealDeductionEligible ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.firstDayChargeable ? 'Từ ngày thứ 2' : 'Được giảm toàn kỳ'}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Tính đủ tiền ăn
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="font-medium">{item.reportedBy}</div>
                        <div className="text-xs text-gray-500">({item.reporterRelationship})</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.bg} ${statusMeta.textCol}`}
                        >
                          {statusMeta.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {item.status !== 'RETURNED' && item.status !== 'CANCELLED' && (
                          <>
                            {!item.isAdvanceNotice48h && !item.subsequentDaysConfirmed && (
                              <button
                                onClick={() => confirmMutation.mutate(item.leaveRequestId)}
                                title="Xác nhận tiếp tục vắng để giảm trừ tiền ăn các ngày sau"
                                className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded border border-amber-300"
                              >
                                Xác nhận ngày sau
                              </button>
                            )}
                            <button
                              onClick={() => returnMutation.mutate(item.leaveRequestId)}
                              className="text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded border border-emerald-300"
                            >
                              Ghi nhận trở lại
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Nhập lý do hủy tạm vắng:');
                                if (reason) cancelMutation.mutate({ id: item.leaveRequestId, reason });
                              }}
                              className="text-xs px-2 py-1 text-rose-600 hover:bg-rose-50 rounded"
                            >
                              Hủy
                            </button>
                          </>
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

      {/* Modal Đăng Ký Tạm Vắng */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">Đăng Ký Nghỉ Phép / Tạm Vắng</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Người cao tuổi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedResidentId}
                  onChange={e => setSelectedResidentId(e.target.value)}
                  required
                  className="w-full text-sm p-2.5 border rounded-lg border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">-- Chọn người cao tuổi --</option>
                  {residentsData?.map(item => (
                    <option key={item.resident.residentId} value={item.resident.residentId}>
                      {item.resident.displayName} ({item.resident.residentCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Loại tạm vắng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value as LeaveType)}
                    className="w-full text-sm p-2.5 border rounded-lg border-gray-300"
                  >
                    <option value="FAMILY_VISIT">Thăm gia đình</option>
                    <option value="MEDICAL_OUTING">Khám bệnh ngoài</option>
                    <option value="TEMPORARY_HOSPITALIZATION">Nhập viện điều trị</option>
                    <option value="VACATION">Nghỉ dưỡng/Du lịch</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Thời gian bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                    className="w-full text-sm p-2 border rounded-lg border-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dự kiến trở lại <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={expectedEndDate}
                  onChange={e => setExpectedEndDate(e.target.value)}
                  required
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                />
              </div>

              {/* RLA Notice Live Assessment */}
              {noticeCalc && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-1 ${
                    noticeCalc.is48h
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="font-semibold">
                    Đánh giá quy định RLA-BR-01 (Thời gian báo trước: {noticeCalc.hours}h):
                  </div>
                  {noticeCalc.is48h ? (
                    <div>✓ Đạt chuẩn báo trước ≥48h: Đủ điều kiện giảm trừ tiền ăn toàn bộ kỳ vắng.</div>
                  ) : (
                    <div>
                      ⚠ Báo trước &lt;48h: Ngày đầu tiên vẫn tính tiền ăn. Các ngày sau cần xác nhận kế hoạch để giảm
                      trừ.
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Người báo tin <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reportedBy}
                    onChange={e => setReportedBy(e.target.value)}
                    placeholder="Họ tên người thân"
                    required
                    className="w-full text-sm p-2 border rounded-lg border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Quan hệ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reporterRelationship}
                    onChange={e => setReporterRelationship(e.target.value)}
                    placeholder="Con trai, Con gái,..."
                    required
                    className="w-full text-sm p-2 border rounded-lg border-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú thêm</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú về sức khỏe, địa chỉ đến, người đón..."
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Đang lưu...' : 'Xác nhận đăng ký'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
