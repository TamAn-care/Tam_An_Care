import { API_BASE_URL } from './client';

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

export let mockLeaveRequests: ResidentLeaveItem[] = [
  {
    leaveRequestId: 'rla-demo-001',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    residentCode: 'NCT-001',
    leaveType: 'FAMILY_VISIT',
    startDate: '2026-09-02',
    expectedEndDate: '2026-09-05',
    actualEndDate: '2026-09-05',
    noticeSubmittedAt: '2026-08-30T09:00:00Z',
    noticeHours: 72,
    isAdvanceNotice48h: true,
    firstDayChargeable: false,
    subsequentDaysConfirmed: true,
    mealDeductionEligible: true,
    status: 'RETURNED',
    reportedBy: 'Lê Gia Bảo (SĐT: 0908 123 456)',
    reporterRelationship: 'Con trai',
    recordedBy: 'staff-001',
    recordedByRole: 'CARE_MANAGER',
    note: 'Đón Cụ về mừng thọ cháu ngoại',
    createdAt: '2026-08-30T09:00:00Z',
    updatedAt: '2026-09-05T16:00:00Z',
  },
  {
    leaveRequestId: 'rla-demo-002',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    residentCode: 'NCT-001',
    leaveType: 'VACATION',
    startDate: '2026-09-10',
    expectedEndDate: '2026-09-12',
    noticeSubmittedAt: '2026-09-07T10:00:00Z',
    noticeHours: 72,
    isAdvanceNotice48h: true,
    firstDayChargeable: false,
    subsequentDaysConfirmed: false,
    mealDeductionEligible: true,
    status: 'REGISTERED',
    reportedBy: 'Lê Gia Bảo (SĐT: 0908 123 456)',
    reporterRelationship: 'Con trai',
    recordedBy: 'staff-001',
    recordedByRole: 'GUARDIAN',
    note: 'Nghỉ dưỡng gia đình tại Vũng Tàu',
    createdAt: '2026-09-07T10:00:00Z',
    updatedAt: '2026-09-07T10:00:00Z',
  },
];

export async function fetchLeaveRequests(
  actorId: string,
  actorRole: string,
  params: { residentId?: string; status?: string; limit?: number; offset?: number } = {},
): Promise<ListLeaveRequestsResponse> {
  try {
    const q = new URLSearchParams();
    if (params.residentId) q.append('residentId', params.residentId);
    if (params.status) q.append('status', params.status);
    q.append('limit', String(params.limit ?? 50));
    q.append('offset', String(params.offset ?? 0));

    const res = await fetch(`${API_BASE_URL}/api/resident-leave/requests?${q.toString()}`, {
      headers: getHeaders(actorId, actorRole),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items)) return data;
    }
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for fetchLeaveRequests:', error);
  }

  // Fallback to in-memory mock requests
  let filtered = [...mockLeaveRequests];
  if (params.residentId && params.residentId !== 'ALL') {
    filtered = filtered.filter((i) => i.residentId === params.residentId);
  }
  if (params.status && params.status !== 'ALL') {
    filtered = filtered.filter((i) => i.status === params.status);
  }

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
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
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/requests`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for createLeaveRequest:', error);
  }

  // Fallback local creation
  const startMs = new Date(payload.startDate).getTime();
  const nowMs = Date.now();
  const noticeHours = Math.max(0, Math.round((startMs - nowMs) / (1000 * 60 * 60)));
  const isAdvanceNotice48h = noticeHours >= 48;

  const newItem: ResidentLeaveItem = {
    leaveRequestId: `rla-${Date.now()}`,
    residentId: payload.residentId,
    leaveType: payload.leaveType,
    startDate: payload.startDate,
    expectedEndDate: payload.expectedEndDate,
    noticeSubmittedAt: payload.noticeSubmittedAt || new Date().toISOString(),
    noticeHours,
    isAdvanceNotice48h,
    firstDayChargeable: !isAdvanceNotice48h,
    subsequentDaysConfirmed: false,
    mealDeductionEligible: true,
    status: 'REGISTERED',
    reportedBy: payload.reportedBy,
    reporterRelationship: payload.reporterRelationship,
    recordedBy: actorId,
    recordedByRole: actorRole,
    note: payload.note,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockLeaveRequests.unshift(newItem);
  return newItem;
}

export async function confirmSubsequentDays(
  actorId: string,
  actorRole: string,
  leaveRequestId: string,
  note?: string,
): Promise<ResidentLeaveItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/requests/${leaveRequestId}/confirm-subsequent`, {
      method: 'PATCH',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({ note }),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode confirmSubsequentDays:', error);
  }

  const target = mockLeaveRequests.find((r) => r.leaveRequestId === leaveRequestId);
  if (target) {
    target.subsequentDaysConfirmed = true;
    target.updatedAt = new Date().toISOString();
    return target;
  }
  throw new Error('Không tìm thấy đơn tạm vắng.');
}

export async function recordLeaveReturn(
  actorId: string,
  actorRole: string,
  leaveRequestId: string,
  actualEndDate?: string,
  note?: string,
): Promise<ResidentLeaveItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/requests/${leaveRequestId}/return`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({ actualEndDate, note }),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode recordLeaveReturn:', error);
  }

  const target = mockLeaveRequests.find((r) => r.leaveRequestId === leaveRequestId);
  if (target) {
    target.status = 'RETURNED';
    target.actualEndDate = actualEndDate || new Date().toISOString().slice(0, 10);
    target.updatedAt = new Date().toISOString();
    return target;
  }
  throw new Error('Không tìm thấy đơn tạm vắng.');
}

export async function cancelLeaveRequest(
  actorId: string,
  actorRole: string,
  leaveRequestId: string,
  reason: string,
): Promise<ResidentLeaveItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/requests/${leaveRequestId}/cancel`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({ reason }),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode cancelLeaveRequest:', error);
  }

  const target = mockLeaveRequests.find((r) => r.leaveRequestId === leaveRequestId);
  if (target) {
    target.status = 'CANCELLED';
    target.note = `[Đã hủy: ${reason}] ${target.note || ''}`;
    target.updatedAt = new Date().toISOString();
    return target;
  }
  throw new Error('Không tìm thấy đơn tạm vắng.');
}
