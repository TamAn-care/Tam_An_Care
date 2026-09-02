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

export async function fetchShifts(
  actorId: string,
  actorRole: string,
  params: { staffActorId?: string; shiftDate?: string; status?: string; shiftType?: string; limit?: number; offset?: number } = {},
): Promise<ListShiftsResponse> {
  const q = new URLSearchParams();
  if (params.staffActorId) q.append('staffActorId', params.staffActorId);
  if (params.shiftDate) q.append('shiftDate', params.shiftDate);
  if (params.status) q.append('status', params.status);
  if (params.shiftType) q.append('shiftType', params.shiftType);
  q.append('limit', String(params.limit ?? 50));
  q.append('offset', String(params.offset ?? 0));

  const res = await fetch(`/api/workforce/shifts?${q.toString()}`, {
    headers: getHeaders(actorId, actorRole),
  });
  if (!res.ok) {
    throw new Error(`Lỗi tải danh sách ca kíp: HTTP ${res.status}`);
  }
  return res.json();
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
  const res = await fetch('/api/workforce/shifts', {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi phân ca: HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkinShift(
  actorId: string,
  actorRole: string,
  shiftId: string,
): Promise<ShiftItem> {
  const res = await fetch(`/api/workforce/shifts/${shiftId}/checkin`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi điểm danh vào ca: HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkoutShift(
  actorId: string,
  actorRole: string,
  shiftId: string,
  notes?: string,
): Promise<ShiftItem> {
  const res = await fetch(`/api/workforce/shifts/${shiftId}/checkout`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi kết thúc ca: HTTP ${res.status}`);
  }
  return res.json();
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
  const res = await fetch(`/api/workforce/shifts/${shiftId}/handover`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi tạo phiếu bàn giao: HTTP ${res.status}`);
  }
  return res.json();
}

export async function acknowledgeHandover(
  actorId: string,
  actorRole: string,
  handoverId: string,
): Promise<HandoverItem> {
  const res = await fetch(`/api/workforce/handovers/${handoverId}/acknowledge`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi xác nhận bàn giao: HTTP ${res.status}`);
  }
  return res.json();
}

export async function cancelShift(
  actorId: string,
  actorRole: string,
  shiftId: string,
  reason: string,
): Promise<ShiftItem> {
  const res = await fetch(`/api/workforce/shifts/${shiftId}/cancel`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi hủy ca trực: HTTP ${res.status}`);
  }
  return res.json();
}
