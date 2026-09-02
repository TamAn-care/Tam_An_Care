import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import {
  fetchShifts,
  scheduleShift,
  checkinShift,
  checkoutShift,
  submitHandover,
  acknowledgeHandover,
  cancelShift,
  ShiftItem,
  ShiftType,
  ShiftStatus,
} from '../../api/workforce';

const SHIFT_TYPE_META: Record<ShiftType, { label: string; bg: string; text: string }> = {
  MORNING: { label: 'Ca Sáng (06:00 - 14:00)', bg: 'bg-amber-100', text: 'text-amber-800' },
  AFTERNOON: { label: 'Ca Chiều (14:00 - 22:00)', bg: 'bg-sky-100', text: 'text-sky-800' },
  NIGHT: { label: 'Ca Đêm (22:00 - 06:00)', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  CUSTOM: { label: 'Ca Linh Hoạt', bg: 'bg-purple-100', text: 'text-purple-800' },
};

const STATUS_META: Record<ShiftStatus, { label: string; bg: string; text: string }> = {
  SCHEDULED: { label: 'Đã phân ca', bg: 'bg-blue-100', text: 'text-blue-800' },
  IN_PROGRESS: { label: 'Đang trực', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  COMPLETED: { label: 'Hoàn thành', bg: 'bg-gray-100', text: 'text-gray-800' },
  ABSENT: { label: 'Vắng mặt', bg: 'bg-rose-100', text: 'text-rose-800' },
  CANCELLED: { label: 'Đã hủy', bg: 'bg-gray-100', text: 'text-gray-500' },
};

export default function WorkforcePage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const isSupervisor = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER';

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modals
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [handoverShift, setHandoverShift] = useState<ShiftItem | null>(null);

  // Form State - Schedule
  const [staffActorId, setStaffActorId] = useState('');
  const [shiftType, setShiftType] = useState<ShiftType>('MORNING');
  const [startTime, setStartTime] = useState(`${todayStr}T06:00`);
  const [endTime, setEndTime] = useState(`${todayStr}T14:00`);
  const [notes, setNotes] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Form State - Handover
  const [handoverSummary, setHandoverSummary] = useState('');
  const [handoverAlerts, setHandoverAlerts] = useState('');
  const [handoverToId, setHandoverToId] = useState('');
  const [handoverError, setHandoverError] = useState<string | null>(null);

  // Queries
  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['workforce-shifts', selectedDate, statusFilter, typeFilter, actorId],
    queryFn: () =>
      fetchShifts(actorId, actorRole, {
        shiftDate: selectedDate || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        shiftType: typeFilter === 'ALL' ? undefined : typeFilter,
        limit: 100,
      }),
    enabled: Boolean(actorId),
  });

  // Mutations
  const scheduleMutation = useMutation({
    mutationFn: (payload: any) => scheduleShift(actorId, actorRole, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] });
      setIsScheduleOpen(false);
      resetScheduleForm();
    },
    onError: (err: any) => setScheduleError(err.message || 'Lỗi phân ca'),
  });

  const checkinMutation = useMutation({
    mutationFn: (id: string) => checkinShift(actorId, actorRole, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] }),
    onError: (err: any) => alert(err.message),
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => checkoutShift(actorId, actorRole, id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] }),
    onError: (err: any) => alert(err.message),
  });

  const handoverMutation = useMutation({
    mutationFn: (payload: any) => submitHandover(actorId, actorRole, handoverShift!.shiftId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] });
      setHandoverShift(null);
      resetHandoverForm();
    },
    onError: (err: any) => setHandoverError(err.message || 'Lỗi bàn giao ca'),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeHandover(actorId, actorRole, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] }),
    onError: (err: any) => alert(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelShift(actorId, actorRole, id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] }),
    onError: (err: any) => alert(err.message),
  });

  const resetScheduleForm = () => {
    setStaffActorId('');
    setShiftType('MORNING');
    setStartTime(`${selectedDate}T06:00`);
    setEndTime(`${selectedDate}T14:00`);
    setNotes('');
    setScheduleError(null);
  };

  const resetHandoverForm = () => {
    setHandoverSummary('');
    setHandoverAlerts('');
    setHandoverToId('');
    setHandoverError(null);
  };

  const handleShiftTypeChange = (type: ShiftType) => {
    setShiftType(type);
    if (type === 'MORNING') {
      setStartTime(`${selectedDate}T06:00`);
      setEndTime(`${selectedDate}T14:00`);
    } else if (type === 'AFTERNOON') {
      setStartTime(`${selectedDate}T14:00`);
      setEndTime(`${selectedDate}T22:00`);
    } else if (type === 'NIGHT') {
      setStartTime(`${selectedDate}T22:00`);
      const nextDay = new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setEndTime(`${nextDay}T06:00`);
    }
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffActorId || !selectedDate || !startTime || !endTime) {
      setScheduleError('Vui lòng điền đầy đủ thông tin phân ca.');
      return;
    }
    scheduleMutation.mutate({
      staffActorId,
      shiftDate: selectedDate,
      shiftType,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      notes: notes || undefined,
    });
  };

  const handleHandoverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverSummary) {
      setHandoverError('Vui lòng nhập tóm tắt bàn giao ca.');
      return;
    }
    const alerts = handoverAlerts
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    handoverMutation.mutate({
      summaryNote: handoverSummary,
      criticalAlerts: alerts,
      toActorId: handoverToId || undefined,
    });
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản Lý Lịch Trực & Ca Kíp Nhân Sự</h1>
          <p className="text-sm text-gray-500 mt-1">
            Series AB: Phân ca trực, điểm danh vào/ra ca và ghi nhận biên bản bàn giao ca trực chuẩn y khoa.
          </p>
        </div>
        {isSupervisor && (
          <button
            onClick={() => {
              resetScheduleForm();
              setIsScheduleOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition"
          >
            + Phân ca trực mới
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Ngày trực:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm p-2 border focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Loại ca:</label>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm p-2 border focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="ALL">Tất cả ca trực</option>
            <option value="MORNING">Ca Sáng</option>
            <option value="AFTERNOON">Ca Chiều</option>
            <option value="NIGHT">Ca Đêm</option>
            <option value="CUSTOM">Ca Linh Hoạt</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm p-2 border focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="SCHEDULED">Đã phân ca</option>
            <option value="IN_PROGRESS">Đang trực</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nhân viên trực</th>
                <th className="px-4 py-3 text-left font-semibold">Ca trực</th>
                <th className="px-4 py-3 text-left font-semibold">Khung giờ dự kiến</th>
                <th className="px-4 py-3 text-left font-semibold">Vào ca / Tan ca</th>
                <th className="px-4 py-3 text-left font-semibold">Bàn giao ca</th>
                <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    Đang tải danh sách ca kíp...
                  </td>
                </tr>
              ) : shiftsData?.items?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    Không có ca trực nào trong ngày {selectedDate}.
                  </td>
                </tr>
              ) : (
                shiftsData?.items?.map((shift: ShiftItem) => {
                  const typeMeta = SHIFT_TYPE_META[shift.shiftType] || {
                    label: shift.shiftType,
                    bg: 'bg-gray-100',
                    text: 'text-gray-800',
                  };
                  const statusMeta = STATUS_META[shift.status] || {
                    label: shift.status,
                    bg: 'bg-gray-100',
                    text: 'text-gray-800',
                  };

                  const isMyShift = shift.staffActorId === actorId;
                  const canCheckin = (isMyShift || isSupervisor) && shift.status === 'SCHEDULED';
                  const canCheckout = (isMyShift || isSupervisor) && shift.status === 'IN_PROGRESS';

                  return (
                    <tr key={shift.shiftId} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{shift.staffName || shift.staffActorId}</div>
                        <div className="text-xs text-gray-500">
                          {shift.staffCode} • {shift.staffRole}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${typeMeta.bg} ${typeMeta.text}`}
                        >
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{new Date(shift.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-xs text-gray-400">{shift.shiftDate}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div>Vào: {shift.actualCheckinAt ? new Date(shift.actualCheckinAt).toLocaleTimeString('vi-VN') : '—'}</div>
                        <div>Ra: {shift.actualCheckoutAt ? new Date(shift.actualCheckoutAt).toLocaleTimeString('vi-VN') : '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {shift.handovers && shift.handovers.length > 0 ? (
                          <div className="space-y-1">
                            {shift.handovers.map(h => (
                              <div key={h.handoverId} className="text-xs">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded font-medium ${
                                    h.status === 'ACKNOWLEDGED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {h.status === 'ACKNOWLEDGED' ? 'Đã nhận bàn giao' : 'Chờ xác nhận'}
                                </span>
                                {h.status === 'SUBMITTED' && (
                                  <button
                                    onClick={() => ackMutation.mutate(h.handoverId)}
                                    className="ml-2 text-xs text-emerald-600 hover:underline font-semibold"
                                  >
                                    Xác nhận nhận
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Chưa có biên bản</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.bg} ${statusMeta.text}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {canCheckin && (
                          <button
                            onClick={() => checkinMutation.mutate(shift.shiftId)}
                            className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded shadow-sm"
                          >
                            Vào ca
                          </button>
                        )}
                        {canCheckout && (
                          <>
                            <button
                              onClick={() => setHandoverShift(shift)}
                              className="text-xs px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium rounded border border-sky-300"
                            >
                              Bàn giao ca
                            </button>
                            <button
                              onClick={() => {
                                const note = prompt('Ghi chú kết thúc ca (nếu có):');
                                checkoutMutation.mutate({ id: shift.shiftId, notes: note || undefined });
                              }}
                              className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded border border-amber-300"
                            >
                              Tan ca
                            </button>
                          </>
                        )}
                        {isSupervisor && shift.status === 'SCHEDULED' && (
                          <button
                            onClick={() => {
                              const reason = prompt('Nhập lý do hủy ca trực:');
                              if (reason) cancelMutation.mutate({ id: shift.shiftId, reason });
                            }}
                            className="text-xs px-2 py-1 text-rose-600 hover:bg-rose-50 rounded"
                          >
                            Hủy ca
                          </button>
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

      {/* Modal Phân Ca Mới */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">Phân Ca Trực Nhân Sự</h2>
              <button onClick={() => setIsScheduleOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                &times;
              </button>
            </div>

            {scheduleError && (
              <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {scheduleError}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mã nhân viên trực (Staff Actor ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={staffActorId}
                  onChange={e => setStaffActorId(e.target.value)}
                  placeholder="hqa-supervisor-001 hoặc staff ID"
                  required
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Loại ca trực <span className="text-rose-500">*</span>
                </label>
                <select
                  value={shiftType}
                  onChange={e => handleShiftTypeChange(e.target.value as ShiftType)}
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                >
                  <option value="MORNING">Ca Sáng (06:00 - 14:00)</option>
                  <option value="AFTERNOON">Ca Chiều (14:00 - 22:00)</option>
                  <option value="NIGHT">Ca Đêm (22:00 - 06:00)</option>
                  <option value="CUSTOM">Ca Linh Hoạt</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Thời gian bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    required
                    className="w-full text-sm p-2 border rounded-lg border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Thời gian kết thúc</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    required
                    className="w-full text-sm p-2 border rounded-lg border-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú phân ca</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú phân công khu vực, phòng phụ trách..."
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={scheduleMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {scheduleMutation.isPending ? 'Đang lưu...' : 'Lưu phân ca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bàn Giao Ca */}
      {handoverShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">Biên Bản Bàn Giao Ca Trực</h2>
              <button onClick={() => setHandoverShift(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                &times;
              </button>
            </div>

            {handoverError && (
              <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {handoverError}
              </div>
            )}

            <form onSubmit={handleHandoverSubmit} className="space-y-3">
              <div className="text-xs bg-gray-50 p-3 rounded-lg border">
                <div className="font-semibold text-gray-800">
                  Ca trực: {SHIFT_TYPE_META[handoverShift.shiftType]?.label} ({handoverShift.shiftDate})
                </div>
                <div className="text-gray-600">Nhân viên bàn giao: {handoverShift.staffName || handoverShift.staffActorId}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nội dung tóm tắt bàn giao <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={handoverSummary}
                  onChange={e => setHandoverSummary(e.target.value)}
                  rows={3}
                  placeholder="Tình hình sức khỏe người cao tuổi, thuốc đã uống, diễn biến trong ca..."
                  required
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cảnh báo & Chú ý đặc biệt (Mỗi dòng một cảnh báo)
                </label>
                <textarea
                  value={handoverAlerts}
                  onChange={e => setHandoverAlerts(e.target.value)}
                  rows={2}
                  placeholder="Phòng 101 cụ A sốt nhẹ 38 độ&#10;Phòng 102 cụ B cần đo huyết áp lúc 20:00"
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nhân viên nhận bàn giao (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={handoverToId}
                  onChange={e => setHandoverToId(e.target.value)}
                  placeholder="Mã nhân viên ca tiếp theo"
                  className="w-full text-sm p-2 border rounded-lg border-gray-300"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setHandoverShift(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={handoverMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {handoverMutation.isPending ? 'Đang lưu...' : 'Gửi biên bản bàn giao'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
