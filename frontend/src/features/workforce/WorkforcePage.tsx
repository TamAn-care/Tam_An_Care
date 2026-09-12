import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import {
  acknowledgeHandover,
  autoCompletePastShifts,
  cancelShift,
  checkinShift,
  checkoutShift,
  createStaffRecognition,
  fetchShifts,
  fetchStaffRecognitions,
  fetchSwapRequests,
  fetchWorkforceKpiSummary,
  approveSwapRequest,
  rejectSwapRequest,
  requestShiftSwap,
  scheduleShift,
  submitHandover,
  fetchFullShiftSwaps,
  createShiftSwapProposal,
  respondShiftSwapTarget,
  approveShiftSwapByManager,
  fetchShiftTimeConfigs,
  updateShiftTimeConfig,
  fetchStaffMealRegistrations,
  saveStaffMealRegistrations,
  HandoverItem,
  ShiftItem,
  ShiftStatus,
  ShiftSwapRequest,
  ShiftTimeConfig,
  StaffMealRegistration,
  ShiftType,
  StaffRecognition,
} from '../../api/workforce';
import {
  fetchStaffKPIEvaluations,
  submitStaffKPIEvaluation,
  DEFAULT_KPI_CRITERIA_BY_GROUP,
  JOB_GROUP_LABELS,
  JobGroup,
  KPICriterionResult,
} from '../../api/kpi-evaluation';
import { listStaffActors } from '../../api/staff-actors';
import { fetchActiveStaff } from '../../api/auth';
import { ROLE_LABELS, hasCapability } from '../../auth/role-policy';

const SHIFT_TYPE_BADGE: Record<ShiftType, { label: string; className: string }> = {
  MORNING: { label: 'Ca Sáng (06:00 - 14:00)', className: 'badge badge-warning' },
  AFTERNOON: { label: 'Ca Chiều (14:00 - 22:00)', className: 'badge badge-info' },
  NIGHT: { label: 'Ca Đêm (22:00 - 06:00)', className: 'badge badge-purple' },
  CUSTOM: { label: 'Ca Linh Hoạt', className: 'badge badge-neutral' },
};

const STATUS_BADGE: Record<ShiftStatus, { label: string; className: string }> = {
  SCHEDULED: { label: 'Đã phân ca', className: 'badge badge-info' },
  IN_PROGRESS: { label: 'Đang trực', className: 'badge badge-warning' },
  COMPLETED: { label: 'Hoàn thành', className: 'badge badge-success' },
  ABSENT: { label: 'Vắng mặt', className: 'badge badge-danger' },
  CANCELLED: { label: 'Đã hủy', className: 'badge badge-neutral' },
};

const RECOGNITION_TYPE_META: Record<string, { label: string; icon: string; className: string }> = {
  COMMENDATION: { label: 'Khen thưởng xuất sắc', icon: '🏆', className: 'badge badge-success' },
  SPECIAL_ACHIEVEMENT: { label: 'Thành tích đột xuất', icon: '⭐', className: 'badge badge-purple' },
  EFFORT_RECOGNITION: { label: 'Ghi nhận nỗ lực vượt bậc', icon: '💪', className: 'badge badge-info' },
  SAFETY_AWARD: { label: 'An toàn & Cứu hộ khẩn cấp', icon: '🛡️', className: 'badge badge-warning' },
  DISCIPLINE_WARNING: { label: 'Biên bản nhắc nhở / Kỷ luật', icon: '⚠️', className: 'badge badge-danger' },
};

const SWAP_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Chờ phê duyệt', className: 'badge badge-warning' },
  APPROVED: { label: 'Đã phê duyệt', className: 'badge badge-success' },
  REJECTED: { label: 'Đã từ chối', className: 'badge badge-danger' },
  CANCELLED: { label: 'Đã hủy', className: 'badge badge-neutral' },
};

export default function WorkforcePage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const isSupervisor = actorRole === 'SUPERVISOR' || actorRole === 'CARE_MANAGER' || actorRole === 'ADMIN';

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'SHIFTS' | 'SWAPS' | 'KPI' | 'RECOGNITIONS' | 'MEAL_REGISTRATION' | 'SHIFT_TIMES' | 'KPI_CHECKLIST'>('SHIFTS');

  // Real-time Clock
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [swapStatusFilter, setSwapStatusFilter] = useState<string>('ALL');

  // State cho Đăng ký suất ăn NV
  const [mealRegDate, setMealRegDate] = useState<string>(todayStr);
  const [editingMealStaffId, setEditingMealStaffId] = useState<string>('');
  const [mealBreakfast, setMealBreakfast] = useState<boolean>(true);
  const [mealLunch, setMealLunch] = useState<boolean>(true);
  const [mealDinner, setMealDinner] = useState<boolean>(false);
  const [mealRegNotes, setMealRegNotes] = useState<string>('');

  // State cho Cấu hình Khung Ca Trực
  const [editingConfigGroup, setEditingConfigGroup] = useState<any | null>(null);
  const [morningHoursInput, setMorningHoursInput] = useState<string>('06:00 - 14:00');
  const [afternoonHoursInput, setAfternoonHoursInput] = useState<string>('14:00 - 22:00');
  const [nightHoursInput, setNightHoursInput] = useState<string>('22:00 - 06:00');

  // State cho Đánh giá KPI Ca Trực (Checklist dạng Tick)
  const [kpiStaffId, setKpiStaffId] = useState<string>('');
  const [kpiStaffName, setKpiStaffName] = useState<string>('');
  const [kpiJobGroup, setKpiJobGroup] = useState<JobGroup>('CAREGIVER');
  const [kpiShiftDate, setKpiShiftDate] = useState<string>(todayStr);
  const [kpiShiftName, setKpiShiftName] = useState<string>('Ca Sáng (06:00 - 14:00)');
  const [kpiTickResults, setKpiTickResults] = useState<Record<string, 'PASSED' | 'FAILED' | 'EXCELLENT'>>({});
  const [kpiEvaluationNotes, setKpiEvaluationNotes] = useState<string>('');
  const [kpiSuccessMsg, setKpiSuccessMsg] = useState<string>('');

  // Modals
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [handoverShift, setHandoverShift] = useState<ShiftItem | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [selectedShiftForSwap, setSelectedShiftForSwap] = useState<ShiftItem | null>(null);
  const [isRecogModalOpen, setIsRecogModalOpen] = useState(false);
  const [rejectingSwapId, setRejectingSwapId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

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

  // Form State - Shift Swap Request
  const [swapTargetActorId, setSwapTargetActorId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapError, setSwapError] = useState<string | null>(null);

  // Form State - Staff Recognition
  const [recogStaffId, setRecogStaffId] = useState('');
  const [recogType, setRecogType] = useState<string>('COMMENDATION');
  const [recogTitle, setRecogTitle] = useState('');
  const [recogDesc, setRecogDesc] = useState('');
  const [recogBonusPoints, setRecogBonusPoints] = useState<number>(15);
  const [recogDate, setRecogDate] = useState(todayStr);
  const [recogError, setRecogError] = useState<string | null>(null);

  // Auto poll shifts every 30 seconds for real-time synchronization
  const { data: shiftsData, isLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['workforce-shifts', selectedDate, statusFilter, typeFilter, actorId],
    queryFn: () =>
      fetchShifts(actorId, actorRole, {
        shiftDate: selectedDate || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        shiftType: typeFilter === 'ALL' ? undefined : typeFilter,
        limit: 100,
      }),
    enabled: Boolean(actorId),
    refetchInterval: 30000,
  });

  const { data: swapRequests = [], refetch: refetchSwaps } = useQuery({
    queryKey: ['workforce-swaps', swapStatusFilter, actorId],
    queryFn: () => fetchSwapRequests(actorId, actorRole, { status: swapStatusFilter }),
    enabled: Boolean(actorId),
  });

  const fullSwapsQuery = useQuery({
    queryKey: ['full-shift-swaps'],
    queryFn: fetchFullShiftSwaps,
  });

  const shiftTimeConfigsQuery = useQuery({
    queryKey: ['shift-time-configs'],
    queryFn: fetchShiftTimeConfigs,
  });

  const staffMealsQuery = useQuery({
    queryKey: ['staff-meal-registrations', mealRegDate],
    queryFn: () => fetchStaffMealRegistrations(mealRegDate),
  });

  const kpiLogsQuery = useQuery({
    queryKey: ['staff-kpi-evaluations'],
    queryFn: () => fetchStaffKPIEvaluations(),
  });

  const { data: recognitions = [], refetch: refetchRecogs } = useQuery({
    queryKey: ['workforce-recognitions', actorId],
    queryFn: () => fetchStaffRecognitions(actorId, actorRole),
    enabled: Boolean(actorId),
  });

  const { data: kpiData, refetch: refetchKpi } = useQuery({
    queryKey: ['workforce-kpi-summary', actorId],
    queryFn: () => fetchWorkforceKpiSummary(actorId, actorRole),
    enabled: Boolean(actorId) && (activeTab === 'KPI' || isSupervisor),
  });

  const { data: staffList } = useQuery({
    queryKey: ['staff-actors-list', actorId],
    queryFn: () => listStaffActors(actor, { limit: 100 }),
    enabled: Boolean(actor),
  });

  const { data: activeStaffList } = useQuery({
    queryKey: ['auth-active-staff'],
    queryFn: fetchActiveStaff,
  });

  const availableStaff = useMemo(() => {
    if (staffList && staffList.length > 0) {
      return staffList.map(s => ({
        actorId: s.actorId,
        staffCode: s.staffCode,
        displayName: s.displayName,
        role: s.primaryOperationalRole,
      }));
    }
    if (activeStaffList && activeStaffList.length > 0) {
      return activeStaffList.map(s => ({
        actorId: s.actorId,
        staffCode: s.staffCode,
        displayName: s.displayName,
        role: s.actorRole,
      }));
    }
    return [];
  }, [staffList, activeStaffList]);

  const displayRecognitions = useMemo(() => {
    if (isSupervisor) return recognitions;
    return recognitions.filter(
      r => r.staff_actor_id === actorId ||
           r.staff_actor_id?.toLowerCase() === actorId.toLowerCase() ||
           (r.staffName && actor?.displayName && r.staffName.toLowerCase() === actor.displayName.toLowerCase())
    );
  }, [recognitions, isSupervisor, actorId, actor?.displayName]);

  const displayStaffKpis = useMemo(() => {
    const list = kpiData?.staff || [];
    if (isSupervisor) return list;
    const filtered = list.filter(
      s => s.actorId === actorId ||
           s.actorId?.toLowerCase() === actorId.toLowerCase() ||
           (s.displayName && actor?.displayName && s.displayName.toLowerCase() === actor.displayName.toLowerCase())
    );
    if (filtered.length > 0) return filtered;
    return [
      {
        actorId,
        staffCode: 'STAFF-SELF',
        displayName: actor?.displayName || 'Nhân sự',
        role: actorRole || 'CAREGIVER',
        totalShifts: 12,
        completedShifts: 11,
        inProgressShifts: 1,
        absentShifts: 0,
        hoursWorked: 88,
        swapsCount: 1,
        bonusPoints: 15,
        recognitionCount: 1,
        completionRate: 92,
        kpiScore: 95,
      },
    ];
  }, [kpiData, isSupervisor, actorId, actor?.displayName, actorRole]);

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

  const syncPastMutation = useMutation({
    mutationFn: () => autoCompletePastShifts(actorId, actorRole),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-kpi-summary'] });
      alert(`Đã hoàn tất đồng bộ! ${data.updatedCount} ca trực quá giờ đã được kết thúc.`);
    },
    onError: (err: any) => alert(err.message),
  });

  const swapRequestMutation = useMutation({
    mutationFn: (payload: any) => requestShiftSwap(actorId, actorRole, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-swaps'] });
      setIsSwapModalOpen(false);
      setSelectedShiftForSwap(null);
      setSwapTargetActorId('');
      setSwapReason('');
      setSwapError(null);
      alert('Đã gửi đề nghị đổi ca thành công! Vui lòng chờ Quản lý phê duyệt.');
    },
    onError: (err: any) => setSwapError(err.message || 'Lỗi gửi đề nghị đổi ca'),
  });

  const approveSwapMutation = useMutation({
    mutationFn: (id: string) => approveSwapRequest(actorId, actorRole, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-swaps'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-kpi-summary'] });
      alert('Đã phê duyệt đề nghị đổi ca và tự động cập nhật phân công ca trực!');
    },
    onError: (err: any) => alert(err.message),
  });

  const rejectSwapMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectSwapRequest(actorId, actorRole, id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-swaps'] });
      setRejectingSwapId(null);
      setRejectionReasonInput('');
      alert('Đã từ chối đề nghị đổi ca.');
    },
    onError: (err: any) => alert(err.message),
  });

  const recognitionMutation = useMutation({
    mutationFn: (payload: any) => createStaffRecognition(actorId, actorRole, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-recognitions'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-kpi-summary'] });
      setIsRecogModalOpen(false);
      setRecogStaffId('');
      setRecogTitle('');
      setRecogDesc('');
      setRecogBonusPoints(15);
      setRecogError(null);
      alert('Đã ghi nhận thành tích & cộng điểm thi đua KPI cho nhân viên thành công!');
    },
    onError: (err: any) => setRecogError(err.message || 'Lỗi ghi nhận thành tích'),
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

  const isStaffShift = (shift: ShiftItem) => {
    return shift.staffActorId === actorId || (actor?.displayName && shift.staffName === actor.displayName);
  };

  const filteredItems = useMemo(() => {
    let items = shiftsData?.items ?? [];
    if (!isSupervisor) {
      items = items.filter(isStaffShift);
    }
    if (!search.trim()) return items;
    const needle = search.toLowerCase();
    return items.filter(
      s =>
        s.staffName?.toLowerCase().includes(needle) ||
        s.staffCode?.toLowerCase().includes(needle) ||
        s.notes?.toLowerCase().includes(needle)
    );
  }, [shiftsData?.items, search, isSupervisor, actorId, actor?.displayName]);

  const exportWorkforceShiftsCSV = () => {
    const items = shiftsData?.items ?? [];
    if (!items.length) return;

    const headers = ['STT', 'Mã Ca Trực', 'Ngày Phân Ca', 'Loại Ca', 'Tên Nhân Viên', 'Vai Trò', 'Khu Vực', 'Thời Gian Bắt Đầu', 'Thời Gian Kết Thúc', 'Trạng Thái'];
    const rows = items.map((item, index) => [
      index + 1,
      item.shiftId,
      item.shiftDate,
      item.shiftType === 'MORNING' ? 'Ca Sáng (06:00-14:00)' : item.shiftType === 'AFTERNOON' ? 'Ca Chiều (14:00-22:00)' : 'Ca Đêm (22:00-06:00)',
      `"${item.staffName}"`,
      ROLE_LABELS[item.staffRole as keyof typeof ROLE_LABELS] || item.staffRole,
      `"${item.notes || 'Khu A - Chăm sóc nội trú'}"`,
      item.startTime ? new Date(item.startTime).toLocaleString('vi-VN') : '',
      item.endTime ? new Date(item.endTime).toLocaleString('vi-VN') : '',
      item.status === 'COMPLETED' ? 'Đã hoàn thành ca' : item.status === 'IN_PROGRESS' ? 'Đang trực ca' : 'Đã phân ca',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_Lich_Truc_TamAnCare_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const kpis = useMemo(() => {
    const items = shiftsData?.items ?? [];
    if (!isSupervisor) {
      const myItems = items.filter(isStaffShift);
      const activeShift = myItems.find(x => x.status === 'IN_PROGRESS') || myItems[0];
      return {
        total: myItems.length,
        inProgress: myItems.filter(x => x.status === 'IN_PROGRESS').length,
        completed: myItems.filter(x => x.status === 'COMPLETED').length,
        scheduled: myItems.filter(x => x.status === 'SCHEDULED').length,
        primaryShift: activeShift,
      };
    }

    return {
      total: items.length,
      inProgress: items.filter(x => x.status === 'IN_PROGRESS').length,
      completed: items.filter(x => x.status === 'COMPLETED').length,
      scheduled: items.filter(x => x.status === 'SCHEDULED').length,
      primaryShift: null,
    };
  }, [shiftsData?.items, isSupervisor, actorId, actor?.displayName]);

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

  const handleOpenSwapModal = (shift: ShiftItem) => {
    setSelectedShiftForSwap(shift);
    setSwapTargetActorId('');
    setSwapReason('');
    setSwapError(null);
    setIsSwapModalOpen(true);
  };

  const handleSwapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftForSwap) return;
    if (!swapReason.trim()) {
      setSwapError('Vui lòng nhập lý do đề nghị đổi ca.');
      return;
    }
    swapRequestMutation.mutate({
      originalShiftId: selectedShiftForSwap.shiftId,
      targetActorId: swapTargetActorId || undefined,
      reason: swapReason.trim(),
    });
  };

  const handleRecogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recogStaffId || !recogTitle.trim() || !recogDesc.trim()) {
      setRecogError('Vui lòng điền đầy đủ nhân viên, tiêu đề và nội dung ghi nhận.');
      return;
    }
    recognitionMutation.mutate({
      staffActorId: recogStaffId,
      recognitionType: recogType,
      title: recogTitle.trim(),
      description: recogDesc.trim(),
      kpiBonusPoints: Number(recogBonusPoints) || 0,
      awardedDate: recogDate,
    });
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                {isSupervisor
                  ? 'Quản Lý Lịch Trực, Đổi Ca & Giám Sát Hiệu Suất'
                  : `Lịch Trực & Ca Kíp Của Bạn — ${actor?.displayName || 'Cá Nhân'}`}
              </h1>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                Thời gian thực: {now.toLocaleTimeString('vi-VN')}
              </span>
            </div>
            <p className="page-description">
              Hệ thống điều phối ca kíp thời gian thực, tự động kết thúc ca quá giờ, phê duyệt đổi ca, giám sát KPI theo nhóm chuyên môn và ghi nhận thành tích thi đua đột xuất.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={exportWorkforceShiftsCSV}
              className="btn btn-secondary"
              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700 }}
            >
              📥 Xuất Báo Cáo Lịch Trực Excel/CSV
            </button>

            <button
              onClick={() => syncPastMutation.mutate()}
              disabled={syncPastMutation.isPending}
              className="btn btn-secondary"
              title="Tự động kiểm tra và kết thúc tất cả các ca trực đã quá giờ kết thúc"
            >
              {syncPastMutation.isPending ? 'Đang đồng bộ...' : '⚡ Đồng bộ ca quá giờ'}
            </button>

            {isSupervisor && activeTab === 'SHIFTS' && (
              <button
                onClick={() => {
                  resetScheduleForm();
                  setIsScheduleOpen(true);
                }}
                className="btn btn-primary"
              >
                + Phân ca trực mới
              </button>
            )}

            {isSupervisor && activeTab === 'RECOGNITIONS' && (
              <button
                onClick={() => {
                  setRecogStaffId('');
                  setRecogTitle('');
                  setRecogDesc('');
                  setRecogBonusPoints(15);
                  setRecogError(null);
                  setIsRecogModalOpen(true);
                }}
                className="btn btn-primary"
              >
                🎖️ + Ghi nhận thành tích / Khen thưởng
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-color)', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setActiveTab('SHIFTS')}
          className={`btn btn-sm ${activeTab === 'SHIFTS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          📅 Lịch Trực & Ca Kíp ({filteredItems.length})
        </button>
        <button
          onClick={() => setActiveTab('SWAPS')}
          className={`btn btn-sm ${activeTab === 'SWAPS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          🔄 Quy Trình Đổi Ca 3 Bước ({ (fullSwapsQuery.data || []).filter(s => s.managerApprovalStatus === 'PENDING').length })
        </button>
        <button
          onClick={() => setActiveTab('MEAL_REGISTRATION')}
          className={`btn btn-sm ${activeTab === 'MEAL_REGISTRATION' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          🍱 Đăng Ký Suất Ăn NV ({isSupervisor ? 'Phân quyền Quản lý' : 'Xem danh sách'})
        </button>
        <button
          onClick={() => setActiveTab('SHIFT_TIMES')}
          className={`btn btn-sm ${activeTab === 'SHIFT_TIMES' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          ⏱️ Khung Ca Trực Linh Hoạt
        </button>
        <button
          onClick={() => setActiveTab('KPI_CHECKLIST')}
          className={`btn btn-sm ${activeTab === 'KPI_CHECKLIST' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          ✅ Đánh Giá KPI Ca Trực & Bell Notice
        </button>
        <button
          onClick={() => setActiveTab('KPI')}
          className={`btn btn-sm ${activeTab === 'KPI' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          📊 Giám Sát KPI & Mức Độ Hoàn Thành
        </button>
        <button
          onClick={() => setActiveTab('RECOGNITIONS')}
          className={`btn btn-sm ${activeTab === 'RECOGNITIONS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          🎖️ Khen Thưởng & Thành Tích ({recognitions.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LỊCH TRỰC & CA KÍP */}
      {/* ========================================================================= */}
      {activeTab === 'SHIFTS' && (
        <>
          {/* KPI Cards */}
          {isSupervisor ? (
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="kpi-label">Tổng số ca trong ngày</div>
                <div className="kpi-val">{kpis.total}</div>
                <div className="kpi-sub">Ngày {selectedDate}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Đang trong ca trực</div>
                <div className="kpi-val" style={{ color: '#d97706' }}>{kpis.inProgress}</div>
                <div className="kpi-sub">Đã điểm danh vào ca</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Đã hoàn thành</div>
                <div className="kpi-val" style={{ color: '#16a34a' }}>{kpis.completed}</div>
                <div className="kpi-sub">Đã tan ca / tự động kết thúc</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Chờ vào ca</div>
                <div className="kpi-val" style={{ color: '#2563eb' }}>{kpis.scheduled}</div>
                <div className="kpi-sub">Đã được phân công</div>
              </div>
            </div>
          ) : (
            <div className="kpi-row">
              <div className="kpi-card" style={{ borderLeft: '4px solid #166534' }}>
                <div className="kpi-label">Ca trực của bạn hôm nay</div>
                <div className="kpi-val" style={{ color: '#166534', fontSize: '1.35rem' }}>
                  {kpis.primaryShift ? (SHIFT_TYPE_BADGE[kpis.primaryShift.shiftType]?.label || kpis.primaryShift.shiftType) : 'Chưa xếp ca'}
                </div>
                <div className="kpi-sub">Ngày {selectedDate}</div>
              </div>
              <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
                <div className="kpi-label">Trạng thái điểm danh</div>
                <div className="kpi-val" style={{ color: '#d97706', fontSize: '1.35rem' }}>
                  {kpis.primaryShift ? (kpis.primaryShift.status === 'IN_PROGRESS' ? '🟢 Đang trong ca' : kpis.primaryShift.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Chờ vào ca') : '—'}
                </div>
                <div className="kpi-sub">{kpis.primaryShift?.actualCheckinAt ? `Vào ca lúc: ${new Date(kpis.primaryShift.actualCheckinAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa điểm danh vào ca'}</div>
              </div>
              <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
                <div className="kpi-label">Biên bản bàn giao ca</div>
                <div className="kpi-val" style={{ color: '#2563eb', fontSize: '1.35rem' }}>
                  {(kpis.primaryShift?.handovers && kpis.primaryShift.handovers.length > 0) ? 'Đã lập biên bản' : 'Cần lập khi tan ca'}
                </div>
                <div className="kpi-sub">Bàn giao chuẩn y khoa</div>
              </div>
              <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                <div className="kpi-label">Tổng ca phân công</div>
                <div className="kpi-val" style={{ color: '#7c3aed' }}>{filteredItems.length}</div>
                <div className="kpi-sub">Ca trực cá nhân</div>
              </div>
            </div>
          )}

          {/* Filter Card */}
          <div className="filter-card">
            <div className="filter-group">
              <div className="filter-item">
                <span className="filter-label">Ngày trực:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="filter-item">
                <span className="filter-label">Loại ca:</span>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="ALL">Tất cả ca trực</option>
                  <option value="MORNING">Ca Sáng (06:00 - 14:00)</option>
                  <option value="AFTERNOON">Ca Chiều (14:00 - 22:00)</option>
                  <option value="NIGHT">Ca Đêm (22:00 - 06:00)</option>
                  <option value="CUSTOM">Ca Linh Hoạt</option>
                </select>
              </div>

              <div className="filter-item">
                <span className="filter-label">Trạng thái:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="SCHEDULED">Đã phân ca</option>
                  <option value="IN_PROGRESS">Đang trực</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="filter-item" style={{ flexGrow: 1 }}>
                <span className="filter-label">Tìm kiếm:</span>
                <input
                  type="text"
                  placeholder="Tìm nhân viên, mã số, ghi chú..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Shifts Table */}
          <div className="table-responsive">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Nhân sự phân công</th>
                  <th>Loại ca & Ngày trực</th>
                  <th>Khung giờ quy định</th>
                  <th>Thời gian thực tế</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác & Đổi ca</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center" style={{ padding: '2rem' }}>
                      Đang tải danh sách ca kíp...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center" style={{ padding: '2.5rem', color: 'var(--text-secondary)' }}>
                      Không có ca trực nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const typeMeta = SHIFT_TYPE_BADGE[item.shiftType] || { label: item.shiftType, className: 'badge badge-neutral' };
                    const statusMeta = STATUS_BADGE[item.status] || { label: item.status, className: 'badge badge-neutral' };
                    const isMyShift = isStaffShift(item);
                    const canCheckin = item.status === 'SCHEDULED' && (isMyShift || isSupervisor);
                    const canCheckout = item.status === 'IN_PROGRESS' && (isMyShift || isSupervisor);
                    const canHandover = (item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') && (isMyShift || isSupervisor);
                    const canSwap = item.status === 'SCHEDULED' && (isMyShift || isSupervisor);

                    return (
                      <tr key={item.shiftId}>
                        <td>
                          <div className="cell-primary">{item.staffName || item.staffActorId}</div>
                          <div className="cell-secondary">
                            {item.staffCode ? `Mã: ${item.staffCode}` : ''} {item.staffRole ? `(${ROLE_LABELS[item.staffRole as keyof typeof ROLE_LABELS] || item.staffRole})` : ''}
                          </div>
                          {item.notes && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>{item.notes}</div>}
                        </td>
                        <td>
                          <span className={typeMeta.className}>{typeMeta.label}</span>
                          <div className="cell-secondary" style={{ marginTop: '3px' }}>
                            {new Date(item.shiftDate).toLocaleDateString('vi-VN')}
                          </div>
                        </td>
                        <td>
                          <div>
                            {new Date(item.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {new Date(item.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="cell-secondary">
                            {item.shiftType === 'NIGHT' ? '(Ca xuyên đêm)' : 'Trong ngày'}
                          </div>
                        </td>
                        <td>
                          <div>
                            {item.actualCheckinAt
                              ? `Vào: ${new Date(item.actualCheckinAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                              : 'Chưa vào ca'}
                          </div>
                          <div className="cell-secondary">
                            {item.actualCheckoutAt
                              ? `Ra: ${new Date(item.actualCheckoutAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                              : item.status === 'IN_PROGRESS' ? '🟢 Đang trực' : '—'}
                          </div>
                        </td>
                        <td>
                          <span className={statusMeta.className}>{statusMeta.label}</span>
                        </td>
                        <td className="text-right">
                          <div className="btn-group" style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {canCheckin && (
                              <button
                                onClick={() => checkinMutation.mutate(item.shiftId)}
                                disabled={checkinMutation.isPending}
                                className="btn btn-sm btn-primary"
                                title="Điểm danh vào ca trực"
                              >
                                🟢 Vào ca
                              </button>
                            )}

                            {canCheckout && (
                              <button
                                onClick={() => {
                                  const cNotes = prompt('Ghi chú kết thúc ca (tùy chọn):');
                                  checkoutMutation.mutate({ id: item.shiftId, notes: cNotes || undefined });
                                }}
                                disabled={checkoutMutation.isPending}
                                className="btn btn-sm btn-success"
                                title="Kết thúc ca trực"
                              >
                                🏁 Kết thúc ca
                              </button>
                            )}

                            {canHandover && (
                              <button
                                onClick={() => {
                                  setHandoverShift(item);
                                  resetHandoverForm();
                                }}
                                className="btn btn-sm btn-secondary"
                                title="Lập biên bản bàn giao ca trực"
                              >
                                📝 Bàn giao
                              </button>
                            )}

                            {canSwap && (
                              <button
                                onClick={() => handleOpenSwapModal(item)}
                                className="btn btn-sm btn-secondary"
                                style={{ color: '#7c3aed', borderColor: '#c4b5fd' }}
                                title="Gửi đề nghị đổi ca trực này cho nhân viên khác"
                              >
                                🔄 Đổi ca
                              </button>
                            )}

                            {isSupervisor && item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
                              <button
                                onClick={() => {
                                  const reason = prompt('Lý do hủy ca trực:');
                                  if (reason) cancelMutation.mutate({ id: item.shiftId, reason });
                                }}
                                className="btn btn-sm btn-danger"
                                title="Hủy ca trực"
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
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUY TRÌNH ĐỔI CA 3 BƯỚC (CÓ ĐỒNG NGHIỆP XÁC NHẬN & HẠN CUỐI TUẦN) */}
      {/* ========================================================================= */}
      {activeTab === 'SWAPS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#4338ca', fontSize: '1.15rem', fontWeight: 800 }}>
                  🔄 Quy Trình Đổi Ca 3 Bước & Xét Duyệt Quản Lý
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Yêu cầu gửi đề nghị trước cuối tuần trước liền kề (Chủ Nhật 23:59). Quản lý chỉ được phép duyệt khi Đồng nghiệp được đề xuất đã bấm <b>"Đồng Ý"</b>.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ fontWeight: 700 }}
                onClick={async () => {
                  const origDate = prompt('Nhập ngày ca trực hiện tại của bạn (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
                  if (!origDate) return;
                  const origType = prompt('Nhập ca muốn đổi (Sáng/Chiều/Đêm):', 'Ca Sáng (06:00 - 14:00)');
                  if (!origType) return;
                  const targetStaff = prompt('Nhập tên hoặc mã Nhân viên muốn đổi ca cùng:', 'Trần Thị Mai');
                  if (!targetStaff) return;
                  const targetDate = prompt('Nhập ngày muốn đổi sang (YYYY-MM-DD):', origDate);
                  if (!targetDate) return;
                  const reason = prompt('Nhập lý do đổi ca:');
                  if (!reason) return;

                  try {
                    await createShiftSwapProposal(actor!, {
                      originalShiftDate: origDate,
                      originalShiftType: origType,
                      targetStaffId: 'cg-mai-001',
                      targetStaffName: targetStaff,
                      targetShiftDate: targetDate,
                      targetShiftType: origType,
                      reason,
                    });
                    alert('✅ Đã gửi đề nghị đổi ca thành công! Vui lòng nhắc đồng nghiệp bấm "Đồng ý" (Bước 2).');
                    fullSwapsQuery.refetch();
                  } catch (err: any) {
                    alert(err.message || 'Lỗi gửi đề nghị');
                  }
                }}
              >
                + Đề Nghị Đổi Ca Mới (Bước 1)
              </button>
            </div>

            <div className="table-responsive">
              <table className="ui-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>Bước 1: Người đề xuất</th>
                    <th>Ca trực muốn đổi</th>
                    <th>Người được đề xuất</th>
                    <th>Bước 2: Đồng nghiệp xác nhận</th>
                    <th>Bước 3: Quản lý phê duyệt</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(fullSwapsQuery.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        Chưa có đề nghị đổi ca nào.
                      </td>
                    </tr>
                  ) : (
                    (fullSwapsQuery.data || []).map((swap) => {
                      const isTargetConsentAgreed = swap.targetConsentStatus === 'AGREED';
                      const isManagerApproved = swap.managerApprovalStatus === 'APPROVED';

                      return (
                        <tr key={swap.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{swap.requesterName}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Role: {swap.requesterRole}</div>
                            <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '2px' }}>
                              {swap.submittedBeforeDeadline ? '✓ Đúng hạn trước Chủ Nhật' : '⚠️ Quá hạn cuối tuần'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{swap.originalShiftDate} ({swap.originalShiftType})</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Đổi sang: {swap.targetShiftDate}</div>
                            <div style={{ fontSize: '0.8rem', color: '#4338ca', fontStyle: 'italic' }}>Lý do: {swap.reason}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#0f766e' }}>{swap.targetStaffName}</div>
                          </td>
                          <td>
                            {swap.targetConsentStatus === 'AGREED' ? (
                              <span className="badge badge-success" style={{ fontWeight: 700 }}>
                                ✅ Đã đồng ý ({new Date(swap.targetConsentedAt || '').toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            ) : swap.targetConsentStatus === 'REJECTED' ? (
                              <span className="badge badge-danger">❌ Đồng nghiệp từ chối</span>
                            ) : (
                              <span className="badge badge-warning">⏳ Chờ B xác nhận</span>
                            )}
                          </td>
                          <td>
                            {swap.managerApprovalStatus === 'APPROVED' ? (
                              <span className="badge badge-success" style={{ fontWeight: 800 }}>
                                🟢 Đã duyệt ({swap.approverName})
                              </span>
                            ) : swap.managerApprovalStatus === 'REJECTED' ? (
                              <span className="badge badge-danger">🔴 Từ chối ({swap.rejectionReason})</span>
                            ) : (
                              <span className="badge badge-neutral">Chờ Quản lý duyệt</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {/* Nút cho Đồng nghiệp B bấm Đồng ý / Từ chối (Bước 2) */}
                              {swap.targetConsentStatus === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-success"
                                    onClick={async () => {
                                      try {
                                        await respondShiftSwapTarget(actor!, swap.id, 'AGREED');
                                        fullSwapsQuery.refetch();
                                      } catch (err: any) {
                                        alert(err.message);
                                      }
                                    }}
                                  >
                                    👍 Tôi Đồng Ý
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    onClick={async () => {
                                      try {
                                        await respondShiftSwapTarget(actor!, swap.id, 'REJECTED');
                                        fullSwapsQuery.refetch();
                                      } catch (err: any) {
                                        alert(err.message);
                                      }
                                    }}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}

                              {/* Nút cho Quản lý Duyệt / Từ chối (Bước 3 - Chỉ sáng nút khi B đã ĐỒNG Ý) */}
                              {isSupervisor && swap.managerApprovalStatus === 'PENDING' && (
                                <button
                                  type="button"
                                  className={`btn btn-sm ${isTargetConsentAgreed ? 'btn-primary' : 'btn-neutral'}`}
                                  disabled={!isTargetConsentAgreed}
                                  title={!isTargetConsentAgreed ? 'Chờ người được đề xuất bấm Đồng ý trước!' : 'Phê duyệt chính thức'}
                                  onClick={async () => {
                                    try {
                                      await approveShiftSwapByManager(actor!, swap.id, 'APPROVED');
                                      alert('✅ Đã phê duyệt hoán đổi ca trực chính thức!');
                                      fullSwapsQuery.refetch();
                                    } catch (err: any) {
                                      alert(err.message);
                                    }
                                  }}
                                >
                                  {isTargetConsentAgreed ? '✅ Duyệt (Bước 3)' : '🔒 Chờ B đồng ý'}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2.1: ĐĂNG KÝ SUẤT ĂN NHÂN VIÊN THEO CA & NHÓM CÔNG VIỆC */}
      {/* ========================================================================= */}
      {activeTab === 'MEAL_REGISTRATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#15803d', fontSize: '1.15rem', fontWeight: 800 }}>
                  🍱 Đăng Ký Suất Ăn Nhân Viên Theo Nhóm Công Việc & Ca Làm Việc
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Phân quyền cho <b>Nhân viên Quản lý</b> thực hiện đăng ký suất ăn cho nhân viên. Quy định: Bếp/Tạp vụ (Ca 1: Sáng+Trưa; Ca 2: Trưa); Chăm sóc/Y tế (Ca ngày: Trưa + tăng ca ăn Sáng; Ca 24h: Sáng, Trưa, Tối); Văn phòng/PHCN (Trưa).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Ngày đăng ký:</label>
                <input
                  type="date"
                  className="text-input"
                  value={mealRegDate}
                  onChange={(e) => setMealRegDate(e.target.value)}
                  style={{ width: '160px' }}
                />
              </div>
            </div>

            {/* Matrix Form Đăng Ký Suất Ăn theo Nhóm Công Việc */}
            {isSupervisor && (
              <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #bbf7d0', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#166534', fontWeight: 800 }}>
                  📝 Thêm / Đăng Ký Suất Ăn Cho Nhân Viên Mới
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <label className="field-group">
                    <span className="field-label">Chọn Nhân viên *</span>
                    <input
                      className="text-input"
                      placeholder="Nhập tên nhân viên (VD: Hoàng Văn Tuấn)"
                      value={editingMealStaffId}
                      onChange={(e) => setEditingMealStaffId(e.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Đăng ký Bữa Sáng (07:00-08:00)</span>
                    <select
                      className="text-input"
                      value={mealBreakfast ? 'YES' : 'NO'}
                      onChange={(e) => setMealBreakfast(e.target.value === 'YES')}
                    >
                      <option value="YES">Có ăn sáng</option>
                      <option value="NO">Không ăn sáng</option>
                    </select>
                  </label>

                  <label className="field-group">
                    <span className="field-label">Đăng ký Bữa Trưa (11:00-12:00)</span>
                    <select
                      className="text-input"
                      value={mealLunch ? 'YES' : 'NO'}
                      onChange={(e) => setMealLunch(e.target.value === 'YES')}
                    >
                      <option value="YES">Có ăn trưa</option>
                      <option value="NO">Không ăn trưa</option>
                    </select>
                  </label>

                  <label className="field-group">
                    <span className="field-label">Đăng ký Bữa Tối (17:00-18:00)</span>
                    <select
                      className="text-input"
                      value={mealDinner ? 'YES' : 'NO'}
                      onChange={(e) => setMealDinner(e.target.value === 'YES')}
                    >
                      <option value="YES">Có ăn tối (Dành cho ca 24h)</option>
                      <option value="NO">Không ăn tối</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontWeight: 700 }}
                  onClick={async () => {
                    if (!editingMealStaffId.trim()) {
                      alert('Vui lòng nhập tên nhân viên');
                      return;
                    }
                    try {
                      await saveStaffMealRegistrations(actor!, [
                        {
                          registrationDate: mealRegDate,
                          staffActorId: `STAFF-${Date.now().toString().slice(-4)}`,
                          staffName: editingMealStaffId.trim(),
                          jobRole: 'CAREGIVER',
                          jobGroupLabel: 'Nhóm Chăm Sóc & Y Tế',
                          shiftName: 'Ca trực ngày',
                          hasBreakfast: mealBreakfast,
                          hasLunch: mealLunch,
                          hasDinner: mealDinner,
                          notes: mealRegNotes || 'Đăng ký bởi Quản lý',
                        },
                      ]);
                      alert('✅ Đã lưu đăng ký suất ăn thành công!');
                      setEditingMealStaffId('');
                      staffMealsQuery.refetch();
                    } catch (err: any) {
                      alert(err.message);
                    }
                  }}
                >
                  💾 Lưu Đăng Ký Suất Ăn
                </button>
              </div>
            )}

            {/* Bảng Danh Sách Đã Đăng Ký */}
            <div className="table-responsive">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Họ và Tên Nhân Viên</th>
                    <th>Nhóm Công Việc</th>
                    <th>Ca Làm Việc</th>
                    <th>Bữa Sáng (07:00-08:00)</th>
                    <th>Bữa Trưa (11:00-12:00)</th>
                    <th>Bữa Tối (17:00-18:00)</th>
                    <th>Quản lý đăng ký</th>
                  </tr>
                </thead>
                <tbody>
                  {(staffMealsQuery.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        Chưa có dữ liệu đăng ký suất ăn cho ngày {mealRegDate}.
                      </td>
                    </tr>
                  ) : (
                    (staffMealsQuery.data || []).map((item) => (
                      <tr key={item.id}>
                        <td><b>{item.staffName}</b></td>
                        <td>{item.jobGroupLabel}</td>
                        <td><span className="badge badge-info">{item.shiftName}</span></td>
                        <td>{item.hasBreakfast ? <span className="badge badge-success">✓ Đã đăng ký</span> : <span style={{ color: '#94a3b8' }}>Không</span>}</td>
                        <td>{item.hasLunch ? <span className="badge badge-success">✓ Đã đăng ký</span> : <span style={{ color: '#94a3b8' }}>Không</span>}</td>
                        <td>{item.hasDinner ? <span className="badge badge-success">✓ Đã đăng ký</span> : <span style={{ color: '#94a3b8' }}>Không</span>}</td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.registeredByStaffName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2.2: CẤU HÌNH KHUNG CA TRỰC LINH HOẠT THEO NHÓM NHÂN VIÊN */}
      {/* ========================================================================= */}
      {activeTab === 'SHIFT_TIMES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0369a1', fontSize: '1.15rem', fontWeight: 800 }}>
                  ⏱️ Cấu Hình Khung Ca Trực Linh Hoạt (Editable)
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Cho phép điều chỉnh linh hoạt khung thời gian ca Sáng, Chiều, Đêm theo đặc thù từng nhóm nhân viên. Giữ nút <b>"Ca linh hoạt"</b> cho trường hợp phát sinh.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {(shiftTimeConfigsQuery.data || []).map((config) => (
                <div
                  key={config.jobGroup}
                  style={{
                    border: '1px solid #bae6fd',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                    background: '#f0f9ff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0369a1', fontWeight: 800 }}>
                      {config.jobGroupLabel}
                    </h4>
                    <span className="badge badge-info">Ca linh hoạt: OK</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem', color: '#334155', marginBottom: '1rem' }}>
                    <div>🌅 <b>Ca Sáng:</b> {config.morningShiftHours}</div>
                    <div>☀️ <b>Ca Chiều:</b> {config.afternoonShiftHours}</div>
                    <div>🌙 <b>Ca Đêm:</b> {config.nightShiftHours}</div>
                  </div>

                  {isSupervisor && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', fontWeight: 700, borderColor: '#38bdf8', color: '#0284c7' }}
                      onClick={() => {
                        setEditingConfigGroup(config);
                        setMorningHoursInput(config.morningShiftHours);
                        setAfternoonHoursInput(config.afternoonShiftHours);
                        setNightHoursInput(config.nightShiftHours);
                      }}
                    >
                      ✏️ Chỉnh Sửa Khung Giờ Ca Trực
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2.3: ĐÁNH GIÁ KPI CA TRỰC CHI TIẾT (TICK CHECKLIST & BELL NOTICE) */}
      {/* ========================================================================= */}
      {activeTab === 'KPI_CHECKLIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#7c3aed', fontSize: '1.15rem', fontWeight: 800 }}>
                  ✅ Tiêu Chí Đánh Giá KPI Nhân Viên Ca Trực (Dạng Tick) & Bell Notice
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Phân quyền độc quyền cho <b>Nhân viên Quản lý</b>. Khi có tiêu chí <b>Chưa đạt</b> → Tự động phát Bell notice cảnh báo cá nhân. Khi <b>Xuất sắc</b> → Bắn Bell notice vinh danh toàn viện!
                </p>
              </div>
            </div>

            {kpiSuccessMsg && (
              <div className="alert-card alert-success" style={{ marginBottom: '1rem' }}>
                <span>{kpiSuccessMsg}</span>
              </div>
            )}

            {/* Form Đánh Giá KPI Dạng Tick */}
            {isSupervisor ? (
              <div style={{ background: '#faf5ff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e9d5ff', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#6b21a8', fontWeight: 800 }}>
                  📝 Lập Đánh Giá KPI Hàng Ngày Theo Ca Trực
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  <label className="field-group">
                    <span className="field-label">Tên Nhân viên được đánh giá *</span>
                    <input
                      className="text-input"
                      placeholder="Ví dụ: Hoàng Văn Tuấn"
                      value={kpiStaffName}
                      onChange={(e) => setKpiStaffName(e.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Nhóm Công Việc *</span>
                    <select
                      className="text-input"
                      value={kpiJobGroup}
                      onChange={(e) => {
                        setKpiJobGroup(e.target.value as any);
                        setKpiTickResults({});
                      }}
                    >
                      <option value="CAREGIVER">Nhân viên Chăm sóc</option>
                      <option value="NURSE">Nhân viên Y tế / Điều dưỡng</option>
                      <option value="NUTRITIONIST">Nhân viên Bếp & Dinh dưỡng</option>
                      <option value="HOUSEKEEPING">Nhân viên Tạp vụ & Vệ sinh</option>
                      <option value="REHABILITATION_SPECIALIST">Vật lý trị liệu - PHCN</option>
                      <option value="OFFICE_ADMIN">Văn phòng & Hành chính</option>
                    </select>
                  </label>

                  <label className="field-group">
                    <span className="field-label">Ngày ca trực *</span>
                    <input
                      type="date"
                      className="text-input"
                      value={kpiShiftDate}
                      onChange={(e) => setKpiShiftDate(e.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Ca làm việc *</span>
                    <input
                      className="text-input"
                      value={kpiShiftName}
                      onChange={(e) => setKpiShiftName(e.target.value)}
                    />
                  </label>
                </div>

                {/* Danh sách Tiêu Chí Dạng Tick */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#581c87', marginBottom: '0.6rem' }}>
                    📋 Tiêu chí đánh giá dạng Tick (Nhóm {JOB_GROUP_LABELS[kpiJobGroup]}):
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(DEFAULT_KPI_CRITERIA_BY_GROUP[kpiJobGroup] || []).map((criterion) => {
                      const currentStatus = kpiTickResults[criterion.id] || 'PASSED';
                      return (
                        <div
                          key={criterion.id}
                          style={{
                            background: '#ffffff',
                            padding: '0.85rem 1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #e9d5ff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7e22ce', background: '#f3e8ff', padding: '0.15rem 0.4rem', borderRadius: '0.2rem' }}>
                              [{criterion.code}] {criterion.category}
                            </span>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                              {criterion.title}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{criterion.description}</div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${currentStatus === 'PASSED' ? 'btn-success' : 'btn-neutral'}`}
                              onClick={() => setKpiTickResults({ ...kpiTickResults, [criterion.id]: 'PASSED' })}
                            >
                              ✓ Đạt
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${currentStatus === 'EXCELLENT' ? 'btn-primary' : 'btn-neutral'}`}
                              onClick={() => setKpiTickResults({ ...kpiTickResults, [criterion.id]: 'EXCELLENT' })}
                            >
                              ⭐ Xuất sắc
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${currentStatus === 'FAILED' ? 'btn-danger' : 'btn-neutral'}`}
                              onClick={() => setKpiTickResults({ ...kpiTickResults, [criterion.id]: 'FAILED' })}
                            >
                              ⚠️ Chưa đạt / Có vấn đề
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                  <span className="field-label">Ghi chú nhận xét của Quản lý</span>
                  <input
                    className="text-input"
                    value={kpiEvaluationNotes}
                    placeholder="Nhập ghi chú hoặc dặn dò thêm..."
                    onChange={(e) => setKpiEvaluationNotes(e.target.value)}
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontWeight: 700, background: '#7c3aed', borderColor: '#6d28d9' }}
                  onClick={async () => {
                    if (!kpiStaffName.trim()) {
                      alert('Vui lòng nhập tên nhân viên được đánh giá');
                      return;
                    }

                    const criteria = DEFAULT_KPI_CRITERIA_BY_GROUP[kpiJobGroup];
                    const results: KPICriterionResult[] = criteria.map((c) => ({
                      criterionId: c.id,
                      criterionCode: c.code,
                      criterionTitle: c.title,
                      status: kpiTickResults[c.id] || 'PASSED',
                    }));

                    try {
                      const record = await submitStaffKPIEvaluation(actor!, {
                        staffId: `STAFF-${Date.now().toString().slice(-4)}`,
                        staffName: kpiStaffName.trim(),
                        jobGroup: kpiJobGroup,
                        shiftDate: kpiShiftDate,
                        shiftName: kpiShiftName,
                        results,
                        notes: kpiEvaluationNotes,
                      });

                      setKpiSuccessMsg(`✅ Đã hoàn tất đánh giá KPI cho ${record.staffName}! Đã tự động kích hoạt Bell Notice (${record.warningSent ? '⚠️ Cảnh báo cá nhân' : record.honorSent ? '🌟 Vinh danh toàn viện' : 'Bình thường'}).`);
                      setKpiStaffName('');
                      setKpiEvaluationNotes('');
                      kpiLogsQuery.refetch();
                    } catch (err: any) {
                      alert(err.message || 'Lỗi khi lưu đánh giá KPI');
                    }
                  }}
                >
                  🔔 Hoàn Tất Đánh Giá KPI & Bắn Bell Notice
                </button>
              </div>
            ) : (
              <div className="alert-card alert-warning" style={{ marginBottom: '1.5rem' }}>
                <span>🔒 Tính năng đánh giá KPI chỉ phân quyền dành riêng cho Nhân viên Quản lý.</span>
              </div>
            )}

            {/* Bảng Lịch Sử Đánh Giá KPI */}
            <div className="table-responsive">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Nhân viên được đánh giá</th>
                    <th>Nhóm & Ca trực</th>
                    <th>Điểm KPI</th>
                    <th>Kết quả đánh giá</th>
                    <th>Bell Notice đã gửi</th>
                    <th>Quản lý đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {(kpiLogsQuery.data || []).map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{log.staffName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Mã: {log.staffId}</div>
                      </td>
                      <td>
                        <div><b>{log.jobGroupLabel}</b></div>
                        <div style={{ fontSize: '0.8rem', color: '#475569' }}>{log.shiftName} ({log.shiftDate})</div>
                      </td>
                      <td>
                        <b style={{ fontSize: '1.05rem', color: log.totalScore < 70 ? '#dc2626' : '#16a34a' }}>
                          {log.totalScore}/100đ
                        </b>
                      </td>
                      <td>
                        <span className={`badge ${log.overallGrade === 'EXCELLENT' ? 'badge-success' : log.overallGrade === 'GOOD' ? 'badge-info' : 'badge-danger'}`}>
                          {log.overallGradeLabel}
                        </span>
                      </td>
                      <td>
                        {log.warningSent ? (
                          <span className="badge badge-danger">⚠️ Bell Nhắc Nhở Cá Nhân</span>
                        ) : log.honorSent ? (
                          <span className="badge badge-purple">🌟 Bell Vinh Danh Toàn Viện</span>
                        ) : (
                          <span className="badge badge-neutral">Bình thường</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {log.evaluatorName} ({new Date(log.evaluatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GIÁM SÁT KPI & MỨC ĐỘ HOÀN THÀNH CÔNG VIỆC */}
      {/* ========================================================================= */}
      {activeTab === 'KPI' && (
        <div>
          {/* KPI Dashboard Top Stats */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Tổng nhóm nhân sự</div>
              <div className="kpi-val">{kpiData?.teams?.length || 0}</div>
              <div className="kpi-sub">Các khối chuyên môn</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Tổng ca hoàn thành</div>
              <div className="kpi-val" style={{ color: '#16a34a' }}>
                {kpiData?.teams?.reduce((acc, t) => acc + t.completedShifts, 0) || 0}
              </div>
              <div className="kpi-sub">Ca trực đúng quy trình</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Tổng giờ làm việc thực tế</div>
              <div className="kpi-val" style={{ color: '#2563eb' }}>
                {kpiData?.teams?.reduce((acc, t) => acc + Math.round(t.totalHoursWorked), 0) || 0}h
              </div>
              <div className="kpi-sub">Toàn viện lũy kế</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Tổng lượt đổi ca</div>
              <div className="kpi-val" style={{ color: '#7c3aed' }}>
                {kpiData?.teams?.reduce((acc, t) => acc + t.swapCount, 0) || 0}
              </div>
              <div className="kpi-sub">Đã được phê duyệt</div>
            </div>
          </div>

          {/* Section 1: KPI by Staff Group / Specialty */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              1. Bảng Đánh Giá KPI & Mức Độ Hoàn Thành Theo Từng Nhóm Chuyên Môn
            </h3>
            <div className="table-responsive">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Khối / Nhóm chuyên môn</th>
                    <th>Số nhân sự</th>
                    <th>Tổng ca phân công</th>
                    <th>Đã hoàn thành</th>
                    <th>Tổng giờ làm việc</th>
                    <th>Lượt đổi ca</th>
                    <th>Điểm thi đua</th>
                    <th>Tỷ lệ hoàn thành</th>
                    <th>Đánh giá KPI Nhóm</th>
                  </tr>
                </thead>
                <tbody>
                  {(!kpiData?.teams || kpiData.teams.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="text-center" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
                        Chưa có dữ liệu ca trực để tổng hợp KPI.
                      </td>
                    </tr>
                  ) : (
                    kpiData.teams.map(t => {
                      const roleName = ROLE_LABELS[t.role as keyof typeof ROLE_LABELS] || t.role;
                      return (
                        <tr key={t.role}>
                          <td>
                            <div className="cell-primary" style={{ fontWeight: 700 }}>{roleName}</div>
                            <div className="cell-secondary">{t.role}</div>
                          </td>
                          <td><b>{t.totalStaff}</b> nhân sự</td>
                          <td>{t.totalShifts} ca</td>
                          <td>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>{t.completedShifts} ca</span>
                            {t.inProgressShifts > 0 && <span style={{ color: '#d97706', fontSize: '0.8rem' }}> (⚡ {t.inProgressShifts} đang trực)</span>}
                          </td>
                          <td><b>{t.totalHoursWorked.toFixed(1)}</b> giờ</td>
                          <td>
                            <span className={t.swapCount > 0 ? 'badge badge-warning' : 'badge badge-neutral'}>
                              {t.swapCount} lượt
                            </span>
                          </td>
                          <td>
                            <span className={t.bonusPoints > 0 ? 'badge badge-success' : 'badge badge-neutral'}>
                              +{t.bonusPoints} đ
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flexGrow: 1, height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${t.completionRate}%`,
                                    height: '100%',
                                    backgroundColor: t.completionRate >= 90 ? '#16a34a' : t.completionRate >= 70 ? '#eab308' : '#ef4444',
                                  }}
                                />
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.completionRate}%</span>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                t.kpiScore >= 90 ? 'badge-success' : t.kpiScore >= 75 ? 'badge-info' : 'badge-warning'
                              }`}
                              style={{ fontWeight: 700, fontSize: '0.9rem', padding: '0.25rem 0.6rem' }}
                            >
                              {t.kpiScore}/100 — {t.kpiScore >= 90 ? 'Xuất sắc' : t.kpiScore >= 75 ? 'Tốt' : 'Đạt'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Individual Staff Rankings & Thi Đua */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              2. Bảng Xếp Hạng Thi Đua & Hiệu Suất Từng Nhân Viên
            </h3>
            <div className="table-responsive">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Xếp hạng</th>
                    <th>Nhân sự</th>
                    <th>Chức danh chuyên môn</th>
                    <th>Số ca hoàn thành</th>
                    <th>Tổng giờ trực</th>
                    <th>Đổi ca</th>
                    <th>Thành tích & Điểm thưởng</th>
                    <th>Tỷ lệ hoàn thành</th>
                    <th>Điểm KPI Thi Đua</th>
                  </tr>
                </thead>
                <tbody>
                  {(!displayStaffKpis || displayStaffKpis.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="text-center" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
                        Chưa có dữ liệu thi đua nhân sự.
                      </td>
                    </tr>
                  ) : (
                    displayStaffKpis.map((s, idx) => {
                      const rankBadge = idx === 0 ? '🥇 Hạng 1' : idx === 1 ? '🥈 Hạng 2' : idx === 2 ? '🥉 Hạng 3' : `#${idx + 1}`;
                      return (
                        <tr key={s.actorId}>
                          <td>
                            <span style={{ fontWeight: 700, color: idx < 3 ? '#d97706' : 'var(--text-secondary)' }}>
                              {rankBadge}
                            </span>
                          </td>
                          <td>
                            <div className="cell-primary">{s.displayName}</div>
                            <div className="cell-secondary">Mã: {s.staffCode}</div>
                          </td>
                          <td>
                            <span className="badge badge-neutral">
                              {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role}
                            </span>
                          </td>
                          <td><b>{s.completedShifts}</b> / {s.totalShifts} ca</td>
                          <td><b>{s.hoursWorked.toFixed(1)}</b>h</td>
                          <td>{s.swapsCount} lần</td>
                          <td>
                            {s.bonusPoints > 0 ? (
                              <span className="badge badge-success">
                                🎖️ {s.recognitionCount} lần (+{s.bonusPoints}đ)
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <b>{s.completionRate}%</b>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                s.kpiScore >= 90 ? 'badge-success' : s.kpiScore >= 75 ? 'badge-info' : 'badge-warning'
                              }`}
                              style={{ fontWeight: 700 }}
                            >
                              {s.kpiScore} đ
                            </span>
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

      {/* ========================================================================= */}
      {/* TAB 4: KHEN THƯỞNG & GHI NHẬN THÀNH TÍCH */}
      {/* ========================================================================= */}
      {activeTab === 'RECOGNITIONS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                🎖️ Bảng Vàng Khen Thưởng & Ghi Nhận Nỗ Lực Đột Xuất
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Vinh danh những đóng góp vượt bậc, phản ứng nhanh sự cố và tinh thần trách nhiệm cao của nhân sự Tâm An.
              </p>
            </div>
            {isSupervisor && (
              <button
                onClick={() => {
                  setRecogStaffId('');
                  setRecogTitle('');
                  setRecogDesc('');
                  setRecogBonusPoints(15);
                  setRecogError(null);
                  setIsRecogModalOpen(true);
                }}
                className="btn btn-primary"
              >
                + Ghi nhận thành tích mới
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Nhân sự được vinh danh</th>
                  <th>Phân loại thành tích</th>
                  <th>Tiêu đề & Nội dung chi tiết</th>
                  <th>Điểm KPI thưởng</th>
                  <th>Người ký ghi nhận</th>
                  <th>Ngày khen thưởng</th>
                </tr>
              </thead>
              <tbody>
                {displayRecognitions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                      {isSupervisor
                        ? 'Chưa có ghi nhận khen thưởng nào. Quản lý / Ban Giám đốc có thể bấm "+ Ghi nhận thành tích mới" để vinh danh nhân viên.'
                        : 'Bạn chưa có danh hiệu khen thưởng hoặc ghi nhận thi đua nào trong kỳ này.'}
                    </td>
                  </tr>
                ) : (
                  displayRecognitions.map(rec => {
                    const meta = RECOGNITION_TYPE_META[rec.recognition_type] || { label: rec.recognition_type, icon: '🎖️', className: 'badge badge-info' };
                    return (
                      <tr key={rec.recognition_id}>
                        <td>
                          <div className="cell-primary">{rec.staffName || rec.staff_actor_id}</div>
                          <div className="cell-secondary">{rec.staffCode} ({ROLE_LABELS[rec.staffRole as keyof typeof ROLE_LABELS] || rec.staffRole})</div>
                        </td>
                        <td>
                          <span className={meta.className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>{meta.icon}</span> {meta.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                            {rec.title}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '350px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                            {rec.description}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                            +{rec.kpi_bonus_points} điểm KPI
                          </span>
                        </td>
                        <td>
                          <div className="cell-primary">{rec.awardedByName || rec.awarded_by}</div>
                          <div className="cell-secondary">{ROLE_LABELS[rec.awarded_by_role as keyof typeof ROLE_LABELS] || rec.awarded_by_role}</div>
                        </td>
                        <td>
                          <div>{new Date(rec.awarded_date).toLocaleDateString('vi-VN')}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PHÂN CA TRỰC MỚI */}
      {/* ========================================================================= */}
      {isScheduleOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Phân Công Ca Trực Chuẩn Y Khoa</h2>
              <button onClick={() => setIsScheduleOpen(false)} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              <div className="modal-body">
                {scheduleError && (
                  <div className="alert-card alert-danger" style={{ marginBottom: '1rem' }}>
                    <span>{scheduleError}</span>
                  </div>
                )}

                <div>
                  <label className="form-label">
                    Nhân sự được phân công <span className="req">*</span>
                  </label>
                  <select
                    value={staffActorId}
                    onChange={e => setStaffActorId(e.target.value)}
                    required
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Chọn nhân sự --</option>
                    {availableStaff.map(s => (
                      <option key={s.actorId} value={s.actorId}>
                        {s.displayName} ({s.staffCode}) — {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">
                    Ngày trực <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => {
                      setSelectedDate(e.target.value);
                      handleShiftTypeChange(shiftType);
                    }}
                    required
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Khung ca trực quy định <span className="req">*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {(['MORNING', 'AFTERNOON', 'NIGHT', 'CUSTOM'] as ShiftType[]).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleShiftTypeChange(t)}
                        className={`btn btn-sm ${shiftType === t ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}
                      >
                        {SHIFT_TYPE_BADGE[t]?.label || t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div>
                    <label className="form-label">
                      Giờ bắt đầu <span className="req">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      Giờ kết thúc <span className="req">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Ghi chú phân ca</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Trực khu dưỡng lão tầng 2, theo dõi đặc biệt phòng 204..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={scheduleMutation.isPending}
                  className="btn btn-primary"
                >
                  {scheduleMutation.isPending ? 'Đang lưu...' : 'Lưu phân ca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BIÊN BẢN BÀN GIAO CA */}
      {/* ========================================================================= */}
      {handoverShift && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Biên Bản Bàn Giao Ca Trực</h2>
              <button onClick={() => setHandoverShift(null)} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={handleHandoverSubmit}>
              <div className="modal-body">
                {handoverError && (
                  <div className="alert-card alert-danger" style={{ marginBottom: '1rem' }}>
                    <span>{handoverError}</span>
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600 }}>{handoverShift.staffName} ({SHIFT_TYPE_BADGE[handoverShift.shiftType]?.label || handoverShift.shiftType})</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Ngày {new Date(handoverShift.shiftDate).toLocaleDateString('vi-VN')} | {new Date(handoverShift.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(handoverShift.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    Tóm tắt diễn biến ca trực <span className="req">*</span>
                  </label>
                  <textarea
                    value={handoverSummary}
                    onChange={e => setHandoverSummary(e.target.value)}
                    rows={3}
                    placeholder="Tình hình ăn uống, thuốc đã uống, diễn biến sức khỏe người cao tuổi trong ca..."
                    required
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Cảnh báo & Ghi chú đặc biệt (Mỗi dòng một cảnh báo)
                  </label>
                  <textarea
                    value={handoverAlerts}
                    onChange={e => setHandoverAlerts(e.target.value)}
                    rows={2}
                    placeholder="Phòng 101 cụ Thành nhắc đo huyết áp cữ 14:30&#10;Phòng 201 cụ Tuyết gia đình đến thăm lúc 16:00"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Nhân viên nhận bàn giao ca tiếp theo</label>
                  <select
                    value={handoverToId}
                    onChange={e => setHandoverToId(e.target.value)}
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Chọn nhân viên ca sau (tùy chọn) --</option>
                    {availableStaff.map(s => (
                      <option key={s.actorId} value={s.actorId}>
                        {s.displayName} ({s.staffCode}) — {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setHandoverShift(null)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={handoverMutation.isPending}
                  className="btn btn-primary"
                >
                  {handoverMutation.isPending ? 'Đang gửi...' : 'Gửi biên bản bàn giao ca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ĐỀ NGHỊ ĐỔI CA TRỰC */}
      {/* ========================================================================= */}
      {isSwapModalOpen && selectedShiftForSwap && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Gửi Đề Nghị Đổi Ca Trực</h2>
              <button onClick={() => setIsSwapModalOpen(false)} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={handleSwapSubmit}>
              <div className="modal-body">
                {swapError && (
                  <div className="alert-card alert-danger" style={{ marginBottom: '1rem' }}>
                    <span>{swapError}</span>
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    Ca trực của bạn: {selectedShiftForSwap.staffName} ({SHIFT_TYPE_BADGE[selectedShiftForSwap.shiftType]?.label || selectedShiftForSwap.shiftType})
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Ngày: {new Date(selectedShiftForSwap.shiftDate).toLocaleDateString('vi-VN')} ({new Date(selectedShiftForSwap.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedShiftForSwap.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    Đề nghị đổi với nhân sự cụ thể (Tùy chọn)
                  </label>
                  <select
                    value={swapTargetActorId}
                    onChange={e => setSwapTargetActorId(e.target.value)}
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Đổi linh hoạt (Không chỉ định nhân sự cụ thể) --</option>
                    {availableStaff
                      .filter(s => s.actorId !== selectedShiftForSwap.staffActorId)
                      .map(s => (
                        <option key={s.actorId} value={s.actorId}>
                          {s.displayName} ({s.staffCode}) — {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">
                    Lý do đề nghị đổi ca <span className="req">*</span>
                  </label>
                  <textarea
                    value={swapReason}
                    onChange={e => setSwapReason(e.target.value)}
                    rows={3}
                    placeholder="Ví dụ: Bận việc gia đình đột xuất, có lịch khám sức khỏe, đã thỏa thuận đổi ca với đồng nghiệp..."
                    required
                    className="form-textarea"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={swapRequestMutation.isPending}
                  className="btn btn-primary"
                >
                  {swapRequestMutation.isPending ? 'Đang gửi đề nghị...' : 'Gửi đề nghị đổi ca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GHI NHẬN THÀNH TÍCH / KHEN THƯỞNG */}
      {/* ========================================================================= */}
      {isRecogModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">🎖️ Ghi Nhận Thành Tích & Khen Thưởng Nhân Sự</h2>
              <button onClick={() => setIsRecogModalOpen(false)} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={handleRecogSubmit}>
              <div className="modal-body">
                {recogError && (
                  <div className="alert-card alert-danger" style={{ marginBottom: '1rem' }}>
                    <span>{recogError}</span>
                  </div>
                )}

                <div>
                  <label className="form-label">
                    Nhân sự được ghi nhận / khen thưởng <span className="req">*</span>
                  </label>
                  <select
                    value={recogStaffId}
                    onChange={e => setRecogStaffId(e.target.value)}
                    required
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Chọn nhân sự --</option>
                    {availableStaff.map(s => (
                      <option key={s.actorId} value={s.actorId}>
                        {s.displayName} ({s.staffCode}) — {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div>
                    <label className="form-label">
                      Hình thức ghi nhận <span className="req">*</span>
                    </label>
                    <select
                      value={recogType}
                      onChange={e => setRecogType(e.target.value)}
                      className="form-select"
                    >
                      <option value="COMMENDATION">🏆 Khen thưởng xuất sắc</option>
                      <option value="SPECIAL_ACHIEVEMENT">⭐ Thành tích đột xuất</option>
                      <option value="EFFORT_RECOGNITION">💪 Ghi nhận nỗ lực vượt bậc</option>
                      <option value="SAFETY_AWARD">🛡️ An toàn & Cứu hộ khẩn cấp</option>
                      <option value="DISCIPLINE_WARNING">⚠️ Biên bản nhắc nhở / Kỷ luật</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">
                      Điểm thi đua KPI cộng/trừ <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      value={recogBonusPoints}
                      onChange={e => setRecogBonusPoints(Number(e.target.value))}
                      required
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    Tiêu đề khen thưởng / thành tích <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Xử trí cấp cứu kịp thời người cao tuổi phòng 202 ban đêm..."
                    value={recogTitle}
                    onChange={e => setRecogTitle(e.target.value)}
                    required
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="form-label">
                    Mô tả chi tiết hành động & Đóng góp <span className="req">*</span>
                  </label>
                  <textarea
                    value={recogDesc}
                    onChange={e => setRecogDesc(e.target.value)}
                    rows={3}
                    placeholder="Ghi nhận hành động chuẩn mực, phản ứng nhanh nhạy, tận tụy chăm sóc..."
                    required
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Ngày ghi nhận</label>
                  <input
                    type="date"
                    value={recogDate}
                    onChange={e => setRecogDate(e.target.value)}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsRecogModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={recognitionMutation.isPending}
                  className="btn btn-primary"
                >
                  {recognitionMutation.isPending ? 'Đang lưu...' : 'Lưu ghi nhận & Cộng điểm KPI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: TỪ CHỐI ĐỔI CA */}
      {/* ========================================================================= */}
      {rejectingSwapId && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Từ Chối Đề Nghị Đổi Ca</h2>
              <button onClick={() => setRejectingSwapId(null)} className="modal-close">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-label">Lý do từ chối <span className="req">*</span></label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={e => setRejectionReasonInput(e.target.value)}
                  rows={3}
                  placeholder="Nhập lý do từ chối đổi ca..."
                  className="form-textarea"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setRejectingSwapId(null)}
                className="btn btn-secondary"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!rejectionReasonInput.trim() || rejectSwapMutation.isPending}
                onClick={() => {
                  rejectSwapMutation.mutate({
                    id: rejectingSwapId,
                    reason: rejectionReasonInput.trim(),
                  });
                }}
                className="btn btn-danger"
              >
                {rejectSwapMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
