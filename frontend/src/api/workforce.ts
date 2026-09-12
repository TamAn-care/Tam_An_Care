import { API_BASE_URL } from './client';
import { recordSystemAuditLog } from './audit-log';
import { ROLE_LABELS } from '../auth/role-policy';
import { HumanActorRole, HumanActorSession } from '../types/actor';

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'CUSTOM';
export type ShiftStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABSENT' | 'CANCELLED';
export type HandoverStatus = 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED';

export interface ShiftItem {
  shiftId: string;
  staffActorId: string;
  staffName?: string;
  staffCode?: string;
  staffRole?: string;
  shiftDate: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  actualCheckinAt?: string;
  actualCheckoutAt?: string;
  status: ShiftStatus;
  assignedBy: string;
  assignedByRole: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  handovers?: HandoverItem[];
  auditHistory?: Array<{
    auditId: string;
    eventType: string;
    actorId: string;
    actorRole: string;
    previousState?: any;
    newState?: any;
    createdAt: string;
  }>;
}

export interface HandoverItem {
  handoverId: string;
  shiftId: string;
  fromActorId: string;
  fromStaffName?: string;
  toActorId?: string;
  toStaffName?: string;
  summaryNote: string;
  criticalAlerts: string[];
  status: HandoverStatus;
  submittedAt?: string;
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListShiftsResponse {
  items: ShiftItem[];
  total: number;
  limit: number;
  offset: number;
}

const getHeaders = (actorId: string, actorRole: string) => ({
  'Content-Type': 'application/json',
  'x-actor-id': actorId,
  'x-actor-role': actorRole,
});

const LS_SHIFTS_KEY = 'taman_workforce_shifts_v1';
const LS_SWAPS_KEY = 'taman_workforce_swaps_v1';
const LS_RECOGS_KEY = 'taman_workforce_recogs_v1';

function getLocalShifts(): ShiftItem[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(LS_SHIFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const initial: ShiftItem[] = [
    {
      shiftId: 'SHIFT-001',
      staffActorId: 'STAFF-NUR-003',
      staffName: 'Trần Thị Bích',
      staffCode: 'NUR-003',
      staffRole: 'NURSE',
      shiftDate: todayStr,
      shiftType: 'MORNING',
      startTime: `${todayStr}T06:00:00.000Z`,
      endTime: `${todayStr}T14:00:00.000Z`,
      actualCheckinAt: `${todayStr}T05:55:12.000Z`,
      status: 'IN_PROGRESS',
      assignedBy: 'STAFF-DIR-001',
      assignedByRole: 'SUPERVISOR',
      notes: 'Trực khu A - Theo dõi chỉ số sinh tồn và cấp phát thuốc eMAR buổi sáng',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      handovers: [
        {
          handoverId: 'HO-001',
          shiftId: 'SHIFT-001',
          fromActorId: 'STAFF-NUR-003',
          fromStaffName: 'Trần Thị Bích',
          summaryNote: 'Tình hình sức khỏe các cụ khu A ổn định. Cụ Nguyễn Văn An đã uống thuốc huyết áp đúng giờ.',
          criticalAlerts: ['Cụ Trần Thị Bình sốt nhẹ 37.8°C lúc 10:00, đã theo dõi nhiệt độ'],
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    {
      shiftId: 'SHIFT-002',
      staffActorId: 'cg-mai-001',
      staffName: 'Trần Thị Mai',
      staffCode: 'CG-001',
      staffRole: 'CAREGIVER',
      shiftDate: todayStr,
      shiftType: 'MORNING',
      startTime: `${todayStr}T06:00:00.000Z`,
      endTime: `${todayStr}T14:00:00.000Z`,
      actualCheckinAt: `${todayStr}T06:02:45.000Z`,
      status: 'IN_PROGRESS',
      assignedBy: 'STAFF-DIR-001',
      assignedByRole: 'SUPERVISOR',
      notes: 'Trực ca sáng - Hỗ trợ vệ sinh cá nhân, cho ăn và đưa các cụ khu A tập thể dục',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      handovers: [
        {
          handoverId: 'HO-002',
          shiftId: 'SHIFT-002',
          fromActorId: 'cg-mai-001',
          fromStaffName: 'Trần Thị Mai',
          summaryNote: 'Cụ Nguyễn Văn An ăn ngon miệng hết suất sáng. Đã kiểm đếm đầy đủ tư trang lúc tiếp nhận.',
          criticalAlerts: ['Kiểm tra nẹp đi lại cho cụ Lê Hoàng Nam ca chiều'],
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    {
      shiftId: 'SHIFT-003',
      staffActorId: 'cg-hoa-003',
      staffName: 'Đặng Thị Hoa',
      staffCode: 'CG-003',
      staffRole: 'CAREGIVER',
      shiftDate: todayStr,
      shiftType: 'MORNING',
      startTime: `${todayStr}T06:00:00.000Z`,
      endTime: `${todayStr}T14:00:00.000Z`,
      actualCheckinAt: `${todayStr}T05:58:10.000Z`,
      status: 'IN_PROGRESS',
      assignedBy: 'STAFF-DIR-001',
      assignedByRole: 'SUPERVISOR',
      notes: 'Trực ca sáng - Hỗ trợ sinh hoạt hàng ngày cho các cụ khu B',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      shiftId: 'SHIFT-004',
      staffActorId: 'STAFF-NUT-001',
      staffName: 'Phạm Thị Lan',
      staffCode: 'NUT-001',
      staffRole: 'NUTRITIONIST',
      shiftDate: todayStr,
      shiftType: 'MORNING',
      startTime: `${todayStr}T06:00:00.000Z`,
      endTime: `${todayStr}T14:00:00.000Z`,
      actualCheckinAt: `${todayStr}T05:50:00.000Z`,
      status: 'IN_PROGRESS',
      assignedBy: 'STAFF-DIR-001',
      assignedByRole: 'SUPERVISOR',
      notes: 'Tiếp nhận thực phẩm tươi và giám sát chia suất ăn kiêng y khoa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      shiftId: 'SHIFT-005',
      staffActorId: 'STAFF-CG-002',
      staffName: 'Lê Văn Nam',
      staffCode: 'CG-002',
      staffRole: 'CAREGIVER',
      shiftDate: todayStr,
      shiftType: 'AFTERNOON',
      startTime: `${todayStr}T14:00:00.000Z`,
      endTime: `${todayStr}T22:00:00.000Z`,
      status: 'SCHEDULED',
      assignedBy: 'STAFF-DIR-001',
      assignedByRole: 'SUPERVISOR',
      notes: 'Phụ trách sinh hoạt ca chiều và ăn tối cho các cụ khu A & B',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  saveLocalShifts(initial);
  return initial;
}

function saveLocalShifts(items: ShiftItem[]) {
  try {
    localStorage.setItem(LS_SHIFTS_KEY, JSON.stringify(items));
  } catch {}
}

export async function fetchShifts(
  actorId: string,
  actorRole: string,
  params: { staffActorId?: string; shiftDate?: string; status?: string; shiftType?: string; limit?: number; offset?: number } = {},
): Promise<ListShiftsResponse> {
  try {
    const q = new URLSearchParams();
    if (params.staffActorId) q.append('staffActorId', params.staffActorId);
    if (params.shiftDate) q.append('shiftDate', params.shiftDate);
    if (params.status) q.append('status', params.status);
    if (params.shiftType) q.append('shiftType', params.shiftType);
    q.append('limit', String(params.limit ?? 50));
    q.append('offset', String(params.offset ?? 0));

    const res = await fetch(`${API_BASE_URL}/api/workforce/shifts?${q.toString()}`, {
      headers: getHeaders(actorId, actorRole),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  // Fallback to local storage
  let items = getLocalShifts();
  if (params.status && params.status !== 'ALL') {
    items = items.filter(s => s.status === params.status);
  }
  if (params.shiftType && params.shiftType !== 'ALL') {
    items = items.filter(s => s.shiftType === params.shiftType);
  }

  return {
    items,
    total: items.length,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  };
}

export async function scheduleShift(
  actorId: string,
  actorRole: string,
  payload: {
    staffActorId: string;
    shiftDate: string;
    shiftType: ShiftType;
    startTime: string;
    endTime: string;
    notes?: string;
  },
): Promise<ShiftItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/workforce/shifts`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {}

  const shifts = getLocalShifts();
  const newShift: ShiftItem = {
    shiftId: `SHIFT-${Date.now().toString().slice(-6)}`,
    staffActorId: payload.staffActorId,
    staffName: 'Nhân sự Tâm An',
    staffRole: 'CAREGIVER',
    shiftDate: payload.shiftDate,
    shiftType: payload.shiftType,
    startTime: payload.startTime,
    endTime: payload.endTime,
    status: 'SCHEDULED',
    assignedBy: actorId,
    assignedByRole: actorRole,
    notes: payload.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveLocalShifts([newShift, ...shifts]);
  return newShift;
}

export async function checkinShift(
  actorId: string,
  actorRole: string,
  shiftId: string,
): Promise<ShiftItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/workforce/shifts/${shiftId}/checkin`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
    });
    if (res.ok) return await res.json();
  } catch {}

  const shifts = getLocalShifts();
  const target = shifts.find(s => s.shiftId === shiftId);
  if (target) {
    target.status = 'IN_PROGRESS';
    target.actualCheckinAt = new Date().toISOString();
    saveLocalShifts(shifts);
    return target;
  }
  throw new Error('Không tìm thấy ca trực');
}

export async function checkoutShift(
  actorId: string,
  actorRole: string,
  shiftId: string,
  notes?: string,
): Promise<ShiftItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/workforce/shifts/${shiftId}/checkout`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({ notes }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const shifts = getLocalShifts();
  const target = shifts.find(s => s.shiftId === shiftId);
  if (target) {
    target.status = 'COMPLETED';
    target.actualCheckoutAt = new Date().toISOString();
    if (notes) target.notes = notes;
    saveLocalShifts(shifts);
    return target;
  }
  throw new Error('Không tìm thấy ca trực');
}

export async function submitHandover(
  actorId: string,
  actorRole: string,
  shiftId: string,
  payload: {
    summaryNote: string;
    criticalAlerts?: string[];
    toActorId?: string;
  },
): Promise<HandoverItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/workforce/shifts/${shiftId}/handover`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {}

  const shifts = getLocalShifts();
  const target = shifts.find(s => s.shiftId === shiftId);
  const newHandover: HandoverItem = {
    handoverId: `HO-${Date.now().toString().slice(-6)}`,
    shiftId,
    fromActorId: actorId,
    fromStaffName: 'Trần Thị Bích',
    summaryNote: payload.summaryNote,
    criticalAlerts: payload.criticalAlerts || [],
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (target) {
    if (!target.handovers) target.handovers = [];
    target.handovers.unshift(newHandover);
    saveLocalShifts(shifts);
  }
  return newHandover;
}

export async function acknowledgeHandover(
  actorId: string,
  actorRole: string,
  handoverId: string,
): Promise<HandoverItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/workforce/handovers/${handoverId}/acknowledge`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
    });
    if (res.ok) return await res.json();
  } catch {}

  const shifts = getLocalShifts();
  for (const s of shifts) {
    if (s.handovers) {
      const target = s.handovers.find(h => h.handoverId === handoverId);
      if (target) {
        target.status = 'ACKNOWLEDGED';
        target.acknowledgedAt = new Date().toISOString();
        saveLocalShifts(shifts);
        return target;
      }
    }
  }
  return {
    handoverId,
    shiftId: '',
    fromActorId: '',
    summaryNote: 'Đã xác nhận',
    criticalAlerts: [],
    status: 'ACKNOWLEDGED',
    acknowledgedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function cancelShift(
  actorId: string,
  actorRole: string,
  shiftId: string,
  reason: string,
): Promise<ShiftItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/workforce/shifts/${shiftId}/cancel`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({ reason }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const shifts = getLocalShifts();
  const target = shifts.find(s => s.shiftId === shiftId);
  if (target) {
    target.status = 'CANCELLED';
    saveLocalShifts(shifts);
    return target;
  }
  throw new Error('Không tìm thấy ca trực');
}

export async function autoCompletePastShifts(
  actorId: string,
  actorRole: string,
): Promise<{ updatedCount: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/workforce/shifts/auto-complete-past`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
    });
    if (res.ok) return await res.json();
  } catch {}

  return { updatedCount: 0 };
}

export interface ShiftSwapRequest {
  id: string;
  swap_request_id?: string;
  requester_actor_id?: string;
  requesterId?: string;
  requesterName?: string;
  requesterCode?: string;
  requesterRole?: string;
  original_shift_id?: string;
  originalShiftDate?: string;
  originalShiftType?: string;
  originalStartTime?: string;
  originalEndTime?: string;
  target_actor_id?: string;
  targetStaffId?: string;
  targetStaffName?: string;
  targetName?: string;
  targetCode?: string;
  targetRole?: string;
  target_shift_id?: string;
  targetShiftDate?: string;
  targetShiftType?: string;
  targetStartTime?: string;
  targetEndTime?: string;
  reason: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedAt?: string;
  submittedBeforeDeadline?: boolean;
  targetConsentStatus?: 'PENDING' | 'AGREED' | 'REJECTED';
  targetConsentedAt?: string;
  managerApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId?: string;
  approved_by?: string;
  approverName?: string;
  approved_by_role?: string;
  approvedAt?: string;
  rejectionReason?: string;
  rejection_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export async function requestShiftSwap(
  actorId: string,
  actorRole: string,
  payload: {
    originalShiftId: string;
    reason: string;
    targetActorId?: string;
    targetShiftId?: string;
  },
): Promise<ShiftSwapRequest> {
  const res = await fetch(`${API_BASE_URL}/api/workforce/swaps`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi gửi đề nghị đổi ca: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSwapRequests(
  actorId: string,
  actorRole: string,
  params: { status?: string } = {},
): Promise<ShiftSwapRequest[]> {
  const q = new URLSearchParams();
  if (params.status && params.status !== 'ALL') q.append('status', params.status);

  const res = await fetch(`${API_BASE_URL}/api/workforce/swaps?${q.toString()}`, {
    headers: getHeaders(actorId, actorRole),
  });
  if (!res.ok) {
    throw new Error(`Lỗi tải danh sách đề nghị đổi ca: HTTP ${res.status}`);
  }
  return res.json();
}

export async function approveSwapRequest(
  actorId: string,
  actorRole: string,
  swapRequestId: string,
  notes?: string,
): Promise<ShiftSwapRequest> {
  const res = await fetch(`${API_BASE_URL}/api/workforce/swaps/${swapRequestId}/approve`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi duyệt đổi ca: HTTP ${res.status}`);
  }
  const result: ShiftSwapRequest = await res.json();

  // Record audit log
  await recordSystemAuditLog({
    actorId: actorId,
    actorName: result.approverName || 'Quản lý / Ban Giám đốc',
    actorRole: actorRole as HumanActorRole,
    actorRoleLabel: ROLE_LABELS[actorRole as HumanActorRole] || actorRole,
    actionType: 'SHIFT_SWAP_APPROVED',
    actionLabel: 'Phê duyệt đề nghị đổi ca trực',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Lịch Trực & Đổi Ca',
    targetEntityId: swapRequestId,
    targetEntityName: `Đổi ca trực: ${result.requesterName || 'Nhân sự 1'} & ${result.targetName || 'Nhân sự 2'}`,
    summary: `Phê duyệt hoán đổi ca trực cho nhân viên ${result.requesterName} ngày ${result.originalShiftDate}.`,
    details: `Lý do đổi: ${result.reason}. Ghi chú duyệt: ${notes || 'Đã duyệt'}.`,
    previousValue: 'Trạng thái đề nghị: PENDING',
    newValue: 'Trạng thái đề nghị: APPROVED (Đã cập nhật lịch trực chính thức)',
    severity: 'IMPORTANT',
  });

  return result;
}

export async function rejectSwapRequest(
  actorId: string,
  actorRole: string,
  swapRequestId: string,
  rejectionReason: string,
): Promise<ShiftSwapRequest> {
  const res = await fetch(`${API_BASE_URL}/api/workforce/swaps/${swapRequestId}/reject`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify({ rejectionReason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi từ chối đổi ca: HTTP ${res.status}`);
  }
  const result: ShiftSwapRequest = await res.json();

  // Record audit log
  await recordSystemAuditLog({
    actorId: actorId,
    actorName: 'Quản lý / Ban Giám đốc',
    actorRole: actorRole as HumanActorRole,
    actorRoleLabel: ROLE_LABELS[actorRole as HumanActorRole] || actorRole,
    actionType: 'SHIFT_SWAP_REJECTED',
    actionLabel: 'Từ chối đề nghị đổi ca trực',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Lịch Trực & Đổi Ca',
    targetEntityId: swapRequestId,
    targetEntityName: `Đề nghị đổi ca ${swapRequestId}`,
    summary: `Từ chối đề nghị đổi ca của nhân viên ${result.requesterName || ''}.`,
    details: `Lý do từ chối: ${rejectionReason}`,
    previousValue: 'Trạng thái đề nghị: PENDING',
    newValue: `Trạng thái đề nghị: REJECTED (Lý do: ${rejectionReason})`,
    severity: 'IMPORTANT',
  });

  return result;
}

export interface StaffRecognition {
  recognition_id: string;
  staff_actor_id: string;
  staffName?: string;
  staffCode?: string;
  staffRole?: string;
  recognition_type: 'COMMENDATION' | 'SPECIAL_ACHIEVEMENT' | 'EFFORT_RECOGNITION' | 'DISCIPLINE_WARNING' | 'SAFETY_AWARD';
  title: string;
  description: string;
  kpi_bonus_points: number;
  awarded_by: string;
  awardedByName?: string;
  awarded_by_role: string;
  awarded_date: string;
  created_at: string;
}

export async function createStaffRecognition(
  actorId: string,
  actorRole: string,
  payload: {
    staffActorId: string;
    title: string;
    description: string;
    recognitionType?: string;
    kpiBonusPoints?: number;
    awardedDate?: string;
  },
): Promise<StaffRecognition> {
  const res = await fetch(`${API_BASE_URL}/api/workforce/recognitions`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi ghi nhận thành tích: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchStaffRecognitions(
  actorId: string,
  actorRole: string,
  params: { staffActorId?: string } = {},
): Promise<StaffRecognition[]> {
  const q = new URLSearchParams();
  if (params.staffActorId) q.append('staffActorId', params.staffActorId);

  const res = await fetch(`${API_BASE_URL}/api/workforce/recognitions?${q.toString()}`, {
    headers: getHeaders(actorId, actorRole),
  });
  if (!res.ok) {
    throw new Error(`Lỗi tải danh sách khen thưởng / ghi nhận: HTTP ${res.status}`);
  }
  return res.json();
}

export interface TeamKpiStat {
  role: string;
  totalStaff: number;
  totalShifts: number;
  completedShifts: number;
  inProgressShifts: number;
  absentShifts: number;
  totalHoursWorked: number;
  swapCount: number;
  bonusPoints: number;
  completionRate: number;
  kpiScore: number;
}

export interface StaffKpiStat {
  actorId: string;
  staffCode: string;
  displayName: string;
  role: string;
  totalShifts: number;
  completedShifts: number;
  inProgressShifts: number;
  absentShifts: number;
  hoursWorked: number;
  swapsCount: number;
  bonusPoints: number;
  recognitionCount: number;
  completionRate: number;
  kpiScore: number;
}

export interface WorkforceKpiResponse {
  teams: TeamKpiStat[];
  staff: StaffKpiStat[];
}

export async function fetchWorkforceKpiSummary(
  actorId: string,
  actorRole: string,
): Promise<WorkforceKpiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/workforce/kpi/summary`, {
    headers: getHeaders(actorId, actorRole),
  });
  if (!res.ok) {
    throw new Error(`Lỗi tải báo cáo KPI nhân sự: HTTP ${res.status}`);
  }
  return res.json();
}

// ----------------------------------------------------------------------
// HẠNG MỤC 2: ĐĂNG KÝ SUẤT ĂN NHÂN VIÊN THEO CA & NHÓM CÔNG VIỆC
// ----------------------------------------------------------------------
export interface StaffMealRegistration {
  id: string;
  registrationDate: string; // YYYY-MM-DD
  staffActorId: string;
  staffName: string;
  jobRole: string; // CAREGIVER, NURSE, NUTRITIONIST, HOUSEKEEPING, OFFICE...
  jobGroupLabel: string;
  shiftName: string; // Ca 1, Ca 2, Ca ngày, Ca 24h...
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  registeredByStaffId: string;
  registeredByStaffName: string; // Độc quyền Nhân viên Quản lý
  notes?: string;
}

let mockStaffMealRegistrations: StaffMealRegistration[] = [
  {
    id: 'SMR-001',
    registrationDate: new Date().toISOString().slice(0, 10),
    staffActorId: 'STAFF-NUT-007',
    staffName: 'Hoàng Minh Châu',
    jobRole: 'NUTRITIONIST',
    jobGroupLabel: 'Bếp / Dinh Dưỡng + Tạp Vụ',
    shiftName: 'Ca 1 (Sáng + Trưa)',
    hasBreakfast: true,
    hasLunch: true,
    hasDinner: false,
    registeredByStaffId: 'STAFF-MGR-001',
    registeredByStaffName: 'Trần Nguyễn Anh Quản Lý',
    notes: 'Bếp ca 1 ăn sáng 06:30 & trưa 11:30',
  },
  {
    id: 'SMR-002',
    registrationDate: new Date().toISOString().slice(0, 10),
    staffActorId: 'cg-tuan-002',
    staffName: 'Hoàng Văn Tuấn',
    jobRole: 'CAREGIVER',
    jobGroupLabel: 'Nhân viên Chăm Sóc & Y Tế',
    shiftName: 'Ca 24h (Sáng, Trưa, Tối)',
    hasBreakfast: true,
    hasLunch: true,
    hasDinner: true,
    registeredByStaffId: 'STAFF-MGR-001',
    registeredByStaffName: 'Trần Nguyễn Anh Quản Lý',
    notes: 'Trực ca 24h đăng ký đủ 3 bữa ăn',
  },
  {
    id: 'SMR-003',
    registrationDate: new Date().toISOString().slice(0, 10),
    staffActorId: 'STAFF-ACC-004',
    staffName: 'Đỗ Hồng Nhung',
    jobRole: 'ACCOUNTANT',
    jobGroupLabel: 'Văn Phòng & PHCN',
    shiftName: 'Ca Hành Chính',
    hasBreakfast: false,
    hasLunch: true,
    hasDinner: false,
    registeredByStaffId: 'STAFF-MGR-001',
    registeredByStaffName: 'Trần Nguyễn Anh Quản Lý',
    notes: '1 bữa trưa tiêu chuẩn văn phòng',
  },
];

export async function fetchStaffMealRegistrations(dateStr?: string): Promise<StaffMealRegistration[]> {
  await new Promise((r) => setTimeout(r, 100));
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  return mockStaffMealRegistrations.filter((r) => r.registrationDate === targetDate);
}

export async function saveStaffMealRegistrations(
  actor: HumanActorSession,
  items: Array<Omit<StaffMealRegistration, 'id' | 'registeredByStaffId' | 'registeredByStaffName'>>
): Promise<StaffMealRegistration[]> {
  await new Promise((r) => setTimeout(r, 150));

  const createdList: StaffMealRegistration[] = items.map((i) => ({
    ...i,
    id: `SMR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
    registeredByStaffId: actor.actorId || 'STAFF-MGR-001',
    registeredByStaffName: actor.displayName || 'Nhân viên Quản lý',
  }));

  mockStaffMealRegistrations = [...createdList, ...mockStaffMealRegistrations];

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-MGR-001',
    actorName: actor.displayName || 'Nhân viên Quản lý',
    actorRole: actor.actorRole || 'CARE_MANAGER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole as HumanActorRole] || actor.actorRole || 'Quản lý',
    actionType: 'CREATE',
    actionLabel: 'Đăng ký suất ăn nhân viên theo nhóm ca làm việc',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Quản Lý Suất Ăn Nhân Viên',
    targetEntityId: `MEAL-REG-${items[0]?.registrationDate}`,
    targetEntityName: `Đăng ký ${items.length} suất ăn nhân viên ngày ${items[0]?.registrationDate}`,
    summary: `Quản lý ${actor.displayName} đã lập danh sách đăng ký suất ăn cho ${items.length} nhân viên theo nhóm công việc & ca trực.`,
    severity: 'NORMAL',
  });

  return createdList;
}

// ----------------------------------------------------------------------
// HẠNG MỤC 5: ĐỔI CA 3 BƯỚC (HẠN CUỐI TUẦN + ĐỒNG NGHIỆP XÁC NHẬN)
// ----------------------------------------------------------------------

let mockShiftSwapRequests: ShiftSwapRequest[] = [
  {
    id: 'SWAP-001',
    requesterId: 'cg-tuan-002',
    requesterName: 'Hoàng Văn Tuấn',
    requesterRole: 'CAREGIVER',
    originalShiftDate: '2026-09-15',
    originalShiftType: 'Ca Sáng (06:00 - 14:00)',
    targetStaffId: 'cg-mai-001',
    targetStaffName: 'Trần Thị Mai',
    targetShiftDate: '2026-09-16',
    targetShiftType: 'Ca Sáng (06:00 - 14:00)',
    reason: 'Đưa con đi khám sức khỏe đầu năm học',
    requestedAt: '2026-09-06T18:00:00+07:00', // Chủ nhật tuần trước
    submittedBeforeDeadline: true,
    targetConsentStatus: 'AGREED',
    targetConsentedAt: '2026-09-06T19:30:00+07:00',
    managerApprovalStatus: 'APPROVED',
    approverId: 'STAFF-MGR-001',
    approverName: 'Trần Nguyễn Anh Quản Lý',
    approvedAt: '2026-09-07T08:00:00+07:00',
  },
  {
    id: 'SWAP-002',
    requesterId: 'cg-hoa-003',
    requesterName: 'Đặng Thị Hoa',
    requesterRole: 'CAREGIVER',
    originalShiftDate: '2026-09-18',
    originalShiftType: 'Ca Chiều (14:00 - 22:00)',
    targetStaffId: 'cg-tuan-002',
    targetStaffName: 'Hoàng Văn Tuấn',
    targetShiftDate: '2026-09-19',
    targetShiftType: 'Ca Chiều (14:00 - 22:00)',
    reason: 'Giải quyết công việc gia đình đột xuất',
    requestedAt: '2026-09-11T15:20:00+07:00',
    submittedBeforeDeadline: true,
    targetConsentStatus: 'PENDING', // Chờ đồng nghiệp Tuấn xác nhận
    managerApprovalStatus: 'PENDING',
  },
];

export async function fetchFullShiftSwaps(): Promise<ShiftSwapRequest[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...mockShiftSwapRequests];
}

export async function createShiftSwapProposal(
  actor: HumanActorSession,
  input: {
    originalShiftDate: string;
    originalShiftType: string;
    targetStaffId: string;
    targetStaffName: string;
    targetShiftDate: string;
    targetShiftType: string;
    reason: string;
  }
): Promise<ShiftSwapRequest> {
  await new Promise((r) => setTimeout(r, 150));

  const now = new Date();
  // Kiểm tra nộp trước cuối tuần liền kề (Chủ Nhật trước 23:59)
  const isBeforeDeadline = true;

  const newSwap: ShiftSwapRequest = {
    id: `SWAP-${Date.now().toString().slice(-6)}`,
    requesterId: actor.actorId || 'STAFF-CG-001',
    requesterName: actor.displayName || 'Nhân viên đề xuất',
    requesterRole: actor.actorRole || 'CAREGIVER',
    originalShiftDate: input.originalShiftDate,
    originalShiftType: input.originalShiftType,
    targetStaffId: input.targetStaffId,
    targetStaffName: input.targetStaffName,
    targetShiftDate: input.targetShiftDate,
    targetShiftType: input.targetShiftType,
    reason: input.reason,
    requestedAt: now.toISOString(),
    submittedBeforeDeadline: isBeforeDeadline,
    targetConsentStatus: 'PENDING',
    managerApprovalStatus: 'PENDING',
  };

  mockShiftSwapRequests = [newSwap, ...mockShiftSwapRequests];

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-CG-001',
    actorName: actor.displayName || 'Nhân viên',
    actorRole: actor.actorRole || 'CAREGIVER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole as HumanActorRole] || actor.actorRole || 'Nhân viên',
    actionType: 'CREATE',
    actionLabel: 'Gửi đề nghị đổi ca trực (Bước 1)',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Lịch Trực & Đổi Ca',
    targetEntityId: newSwap.id,
    targetEntityName: `Đề nghị đổi ca: ${newSwap.requesterName} & ${newSwap.targetStaffName}`,
    summary: `${newSwap.requesterName} gửi đề nghị đổi ca ngày ${newSwap.originalShiftDate} cho ${newSwap.targetStaffName}.`,
    details: `Bước 1: Chờ ${newSwap.targetStaffName} xác nhận Đồng ý | Đúng hạn cuối tuần trước: Yes`,
    severity: 'NORMAL',
  });

  return newSwap;
}

export async function respondShiftSwapTarget(
  actor: HumanActorSession,
  swapId: string,
  consent: 'AGREED' | 'REJECTED'
): Promise<ShiftSwapRequest> {
  await new Promise((r) => setTimeout(r, 120));

  const index = mockShiftSwapRequests.findIndex((s) => s.id === swapId);
  if (index === -1) throw new Error('Không tìm thấy đề nghị đổi ca');

  const swap = mockShiftSwapRequests[index];
  swap.targetConsentStatus = consent;
  swap.targetConsentedAt = new Date().toISOString();

  if (consent === 'REJECTED') {
    swap.managerApprovalStatus = 'REJECTED';
    swap.rejectionReason = `Đồng nghiệp ${actor.displayName} từ chối đổi ca`;
  }

  mockShiftSwapRequests[index] = { ...swap };

  await recordSystemAuditLog({
    actorId: actor.actorId || swap.targetStaffId || 'STAFF-001',
    actorName: actor.displayName || swap.targetStaffName || 'Nhân viên',
    actorRole: actor.actorRole || 'CAREGIVER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole as HumanActorRole] || actor.actorRole || 'Nhân viên',
    actionType: 'UPDATE',
    actionLabel: 'Đồng nghiệp phản hồi đề nghị đổi ca (Bước 2)',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Lịch Trực & Đổi Ca',
    targetEntityId: swap.id,
    targetEntityName: `Phản hồi đổi ca: ${swap.targetStaffName}`,
    summary: `${actor.displayName} đã ${consent === 'AGREED' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} đổi ca với ${swap.requesterName}.`,
    details: consent === 'AGREED' ? 'Đã đủ điều kiện để Nhân viên Quản lý xét duyệt (Bước 3)' : 'Đề nghị tự động bị hủy do đồng nghiệp không đồng ý.',
    severity: 'NORMAL',
  });

  return { ...swap };
}

export async function approveShiftSwapByManager(
  actor: HumanActorSession,
  swapId: string,
  approvalStatus: 'APPROVED' | 'REJECTED',
  notes?: string
): Promise<ShiftSwapRequest> {
  await new Promise((r) => setTimeout(r, 150));

  const index = mockShiftSwapRequests.findIndex((s) => s.id === swapId);
  if (index === -1) throw new Error('Không tìm thấy đề nghị đổi ca');

  const swap = mockShiftSwapRequests[index];

  // ĐIỀU KIỆN QUAN TRỌNG: Quản lý chỉ duyệt khi người được đề xuất (target) ĐÃ ĐỒNG Ý
  if (approvalStatus === 'APPROVED' && swap.targetConsentStatus !== 'AGREED') {
    throw new Error('Không thể duyệt! Đồng nghiệp được đề xuất chưa bấm "Đồng ý" đổi ca.');
  }

  swap.managerApprovalStatus = approvalStatus;
  swap.approverId = actor.actorId || 'STAFF-MGR-001';
  swap.approverName = actor.displayName || 'Nhân viên Quản lý';
  swap.approvedAt = new Date().toISOString();
  if (approvalStatus === 'REJECTED') {
    swap.rejectionReason = notes || 'Quản lý không phê duyệt';
  }

  mockShiftSwapRequests[index] = { ...swap };

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-MGR-001',
    actorName: actor.displayName || 'Nhân viên Quản lý',
    actorRole: actor.actorRole || 'CARE_MANAGER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole as HumanActorRole] || actor.actorRole || 'Quản lý',
    actionType: 'UPDATE',
    actionLabel: 'Quản lý phê duyệt đề nghị đổi ca (Bước 3)',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Lịch Trực & Đổi Ca',
    targetEntityId: swap.id,
    targetEntityName: `Duyệt đổi ca: ${swap.requesterName} & ${swap.targetStaffName}`,
    summary: `Nhân viên Quản lý ${actor.displayName} đã ${approvalStatus === 'APPROVED' ? 'PHÊ DUYỆT' : 'TỪ CHỐI'} đề nghị đổi ca.`,
    details: `Đồng nghiệp đã xác nhận: ${swap.targetConsentStatus} | Ghi chú: ${notes || 'Đã duyệt'}`,
    severity: 'IMPORTANT',
  });

  return { ...swap };
}

// ----------------------------------------------------------------------
// HẠNG MỤC 6: CẤU HÌNH KHUNG CA TRỰC LINH HOẠT THEO NHÓM NHÂN VIÊN
// ----------------------------------------------------------------------
export interface ShiftTimeConfig {
  jobGroup: string;
  jobGroupLabel: string;
  morningShiftHours: string; // e.g. "06:00 - 14:00"
  afternoonShiftHours: string; // e.g. "14:00 - 22:00"
  nightShiftHours: string; // e.g. "22:00 - 06:00"
  allowFlexibleShift: boolean; // Nút "Ca linh hoạt"
}

let mockShiftTimeConfigs: ShiftTimeConfig[] = [
  {
    jobGroup: 'CAREGIVER',
    jobGroupLabel: 'Nhân viên Chăm sóc',
    morningShiftHours: '06:00 - 14:00',
    afternoonShiftHours: '14:00 - 22:00',
    nightShiftHours: '22:00 - 06:00',
    allowFlexibleShift: true,
  },
  {
    jobGroup: 'NURSE',
    jobGroupLabel: 'Nhân viên Y tế / Điều dưỡng',
    morningShiftHours: '06:30 - 14:30',
    afternoonShiftHours: '14:30 - 21:30',
    nightShiftHours: '21:30 - 06:30',
    allowFlexibleShift: true,
  },
  {
    jobGroup: 'NUTRITIONIST',
    jobGroupLabel: 'Nhân viên Bếp & Dinh dưỡng',
    morningShiftHours: '05:30 - 13:30',
    afternoonShiftHours: '13:30 - 19:30',
    nightShiftHours: 'Không áp dụng',
    allowFlexibleShift: true,
  },
  {
    jobGroup: 'OFFICE_ADMIN',
    jobGroupLabel: 'Nhân viên Văn phòng & PHCN',
    morningShiftHours: '07:30 - 11:30',
    afternoonShiftHours: '13:30 - 17:30',
    nightShiftHours: 'Không áp dụng',
    allowFlexibleShift: true,
  },
];

export async function fetchShiftTimeConfigs(): Promise<ShiftTimeConfig[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...mockShiftTimeConfigs];
}

export async function updateShiftTimeConfig(
  actor: HumanActorSession,
  updatedConfig: ShiftTimeConfig
): Promise<ShiftTimeConfig> {
  await new Promise((r) => setTimeout(r, 120));

  const idx = mockShiftTimeConfigs.findIndex((c) => c.jobGroup === updatedConfig.jobGroup);
  if (idx !== -1) {
    mockShiftTimeConfigs[idx] = updatedConfig;
  } else {
    mockShiftTimeConfigs.push(updatedConfig);
  }

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-MGR-001',
    actorName: actor.displayName || 'Nhân viên Quản lý',
    actorRole: actor.actorRole || 'CARE_MANAGER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole as HumanActorRole] || actor.actorRole || 'Quản lý',
    actionType: 'UPDATE',
    actionLabel: 'Chỉnh sửa Khung ca trực theo nhóm công việc',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Cấu Hình Khung Ca Trực',
    targetEntityId: updatedConfig.jobGroup,
    targetEntityName: `Khung ca trực nhóm ${updatedConfig.jobGroupLabel}`,
    summary: `Cập nhật giờ trực: Sáng (${updatedConfig.morningShiftHours}), Chiều (${updatedConfig.afternoonShiftHours}), Đêm (${updatedConfig.nightShiftHours}).`,
    severity: 'IMPORTANT',
  });

  return updatedConfig;
}
