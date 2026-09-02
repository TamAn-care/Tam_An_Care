export type LeaveType =
  | 'FAMILY_VISIT'
  | 'MEDICAL_OUTING'
  | 'TEMPORARY_HOSPITALIZATION'
  | 'VACATION'
  | 'OTHER';

export type LeaveStatus =
  | 'REGISTERED'
  | 'ACTIVE_LEAVE'
  | 'RETURNED'
  | 'CANCELLED';

export interface ResidentLeaveItem {
  leaveRequestId: string;
  residentId: string;
  residentName?: string;
  residentCode?: string;
  leaveType: LeaveType;
  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string;
  noticeSubmittedAt: string;
  noticeHours: number;
  isAdvanceNotice48h: boolean;
  firstDayChargeable: boolean;
  subsequentDaysConfirmed: boolean;
  mealDeductionEligible: boolean;
  status: LeaveStatus;
  reportedBy: string;
  reporterRelationship: string;
  recordedBy: string;
  recordedByRole: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
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

export interface ListLeaveRequestsResponse {
  items: ResidentLeaveItem[];
  total: number;
  limit: number;
  offset: number;
}

const getHeaders = (actorId: string, actorRole: string) => ({
  'Content-Type': 'application/json',
  'x-actor-id': actorId,
  'x-actor-role': actorRole,
});

export async function fetchLeaveRequests(
  actorId: string,
  actorRole: string,
  params: { residentId?: string; status?: string; limit?: number; offset?: number } = {},
): Promise<ListLeaveRequestsResponse> {
  const q = new URLSearchParams();
  if (params.residentId) q.append('residentId', params.residentId);
  if (params.status) q.append('status', params.status);
  q.append('limit', String(params.limit ?? 50));
  q.append('offset', String(params.offset ?? 0));

  const res = await fetch(`/api/resident-leave/requests?${q.toString()}`, {
    headers: getHeaders(actorId, actorRole),
  });
  if (!res.ok) {
    throw new Error(`Lỗi tải danh sách tạm vắng: HTTP ${res.status}`);
  }
  return res.json();
}

export async function createLeaveRequest(
  actorId: string,
  actorRole: string,
  payload: {
    residentId: string;
    leaveType: LeaveType;
    startDate: string;
    expectedEndDate: string;
    noticeSubmittedAt?: string;
    reportedBy: string;
    reporterRelationship: string;
    note?: string;
  },
): Promise<ResidentLeaveItem> {
  const res = await fetch('/api/resident-leave/requests', {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi đăng ký tạm vắng: HTTP ${res.status}`);
  }
  return res.json();
}

export async function confirmSubsequentDays(
  actorId: string,
  actorRole: string,
  leaveRequestId: string,
  note?: string,
): Promise<ResidentLeaveItem> {
  const res = await fetch(`/api/resident-leave/requests/${leaveRequestId}/confirm-subsequent`, {
    method: 'PATCH',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi xác nhận ngày tiếp theo: HTTP ${res.status}`);
  }
  return res.json();
}

export async function recordLeaveReturn(
  actorId: string,
  actorRole: string,
  leaveRequestId: string,
  actualEndDate?: string,
  note?: string,
): Promise<ResidentLeaveItem> {
  const res = await fetch(`/api/resident-leave/requests/${leaveRequestId}/return`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify({ actualEndDate, note }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi ghi nhận trở lại: HTTP ${res.status}`);
  }
  return res.json();
}

export async function cancelLeaveRequest(
  actorId: string,
  actorRole: string,
  leaveRequestId: string,
  reason: string,
): Promise<ResidentLeaveItem> {
  const res = await fetch(`/api/resident-leave/requests/${leaveRequestId}/cancel`, {
    method: 'POST',
    headers: getHeaders(actorId, actorRole),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Lỗi hủy tạm vắng: HTTP ${res.status}`);
  }
  return res.json();
}
