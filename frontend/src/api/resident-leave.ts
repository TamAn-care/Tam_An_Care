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

// --- STAFF LEAVE APIS & TYPES ---

export type StaffLeaveType = 'ANNUAL' | 'PERSONAL' | 'SICK' | 'UNPAID' | 'OTHER';
export type StaffLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface StaffLeaveItem {
  leaveId: string;
  staffActorId: string;
  staffRole: string;
  staffName?: string;
  staffCode?: string;
  leaveType: StaffLeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  isSpecialCase: boolean;
  specialReason?: string;
  noticeHours: number;
  isAdvanceNotice48h: boolean;
  status: StaffLeaveStatus;
  reviewedBy?: string;
  reviewedByRole?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListStaffLeaveRequestsResponse {
  items: StaffLeaveItem[];
  total: number;
  limit: number;
  offset: number;
}

export let mockStaffLeaveRequests: StaffLeaveItem[] = [
  {
    leaveId: 'slr-demo-001',
    staffActorId: 'staff-001',
    staffRole: 'CARE_MANAGER',
    staffName: 'Lê Văn Tùng',
    staffCode: 'NV-001',
    leaveType: 'ANNUAL',
    startDate: '2026-09-25T08:00:00.000Z',
    endDate: '2026-09-27T17:00:00.000Z',
    reason: 'Nghỉ phép năm đưa gia đình đi du lịch',
    isSpecialCase: false,
    noticeHours: 190,
    isAdvanceNotice48h: true,
    status: 'APPROVED',
    reviewedBy: 'staff-000',
    reviewedByRole: 'SUPERVISOR',
    reviewerName: 'Trần Thị Mai (Giám đốc)',
    reviewedAt: '2026-09-17T09:00:00.000Z',
    reviewNote: 'Đồng ý duyệt phép. Đã bàn giao ca cho đ/c Y sĩ.',
    createdAt: '2026-09-15T08:00:00.000Z',
    updatedAt: '2026-09-17T09:00:00.000Z',
  },
  {
    leaveId: 'slr-demo-002',
    staffActorId: 'staff-002',
    staffRole: 'NURSE',
    staffName: 'Nguyễn Thị Hoa',
    staffCode: 'NV-002',
    leaveType: 'SICK',
    startDate: '2026-09-17T14:00:00.000Z',
    endDate: '2026-09-18T17:00:00.000Z',
    reason: 'Sốt cao đột xuất',
    isSpecialCase: true,
    specialReason: 'Sốt vi rút cấp tính 39 độ C, có giấy xác nhận phòng khám',
    noticeHours: 3.5,
    isAdvanceNotice48h: false,
    status: 'PENDING',
    createdAt: '2026-09-17T10:30:00.000Z',
    updatedAt: '2026-09-17T10:30:00.000Z',
  },
];

export async function fetchStaffLeaveRequests(
  actorId: string,
  actorRole: string,
  params: { status?: string; staffActorId?: string; limit?: number; offset?: number } = {},
): Promise<ListStaffLeaveRequestsResponse> {
  try {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.staffActorId) q.append('staffActorId', params.staffActorId);
    q.append('limit', String(params.limit ?? 50));
    q.append('offset', String(params.offset ?? 0));

    const res = await fetch(`${API_BASE_URL}/api/resident-leave/staff-requests?${q.toString()}`, {
      headers: getHeaders(actorId, actorRole),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items)) return data;
    }
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode fetchStaffLeaveRequests:', error);
  }

  let filtered = [...mockStaffLeaveRequests];
  const isApprover = actorRole === 'CARE_MANAGER' || actorRole === 'SUPERVISOR' || actorRole === 'ADMIN';
  if (!isApprover) {
    filtered = filtered.filter((i) => i.staffActorId === actorId);
  } else if (params.staffActorId) {
    filtered = filtered.filter((i) => i.staffActorId === params.staffActorId);
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

export async function createStaffLeaveRequest(
  actorId: string,
  actorRole: string,
  payload: {
    leaveType: StaffLeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    isSpecialCase?: boolean;
    specialReason?: string;
  },
): Promise<StaffLeaveItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/staff-requests`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
    const errData = await res.json().catch(() => ({}));
    if (errData?.message) throw new Error(errData.message);
  } catch (error: any) {
    if (error.message && !error.message.includes('fetch')) {
      throw error;
    }
    console.warn('[TamAnCare API] Offline mode createStaffLeaveRequest:', error);
  }

  const startMs = new Date(payload.startDate).getTime();
  const nowMs = Date.now();
  const noticeHours = Math.round(((startMs - nowMs) / (1000 * 60 * 60)) * 100) / 100;
  const isAdvanceNotice48h = noticeHours >= 48;

  if (!isAdvanceNotice48h && !payload.isSpecialCase) {
    throw new Error('Yêu cầu xin nghỉ phép phải được báo trước ít nhất 2 ngày (48 giờ) trừ trường hợp đặc biệt.');
  }

  if (payload.isSpecialCase && !payload.specialReason?.trim()) {
    throw new Error('Vui lòng nhập lý do giải trình cho trường hợp đặc biệt.');
  }

  const newItem: StaffLeaveItem = {
    leaveId: `slr-${Date.now()}`,
    staffActorId: actorId,
    staffRole: actorRole,
    staffName: 'Nhân viên hiện tại',
    staffCode: 'NV-CURRENT',
    leaveType: payload.leaveType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    reason: payload.reason,
    isSpecialCase: Boolean(payload.isSpecialCase),
    specialReason: payload.specialReason,
    noticeHours,
    isAdvanceNotice48h,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockStaffLeaveRequests.unshift(newItem);
  return newItem;
}

export async function approveStaffLeaveRequest(
  actorId: string,
  actorRole: string,
  leaveId: string,
  reviewNote?: string,
): Promise<StaffLeaveItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/staff-requests/${leaveId}/approve`, {
      method: 'PATCH',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({ reviewNote }),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode approveStaffLeaveRequest:', error);
  }

  const target = mockStaffLeaveRequests.find((r) => r.leaveId === leaveId);
  if (target) {
    target.status = 'APPROVED';
    target.reviewedBy = actorId;
    target.reviewedByRole = actorRole;
    target.reviewerName = actorRole === 'SUPERVISOR' ? 'Ban Giám đốc' : 'Quản lý';
    target.reviewedAt = new Date().toISOString();
    target.reviewNote = reviewNote;
    target.updatedAt = new Date().toISOString();
    return target;
  }
  throw new Error('Không tìm thấy đơn xin nghỉ phép.');
}

export async function rejectStaffLeaveRequest(
  actorId: string,
  actorRole: string,
  leaveId: string,
  reviewNote?: string,
): Promise<StaffLeaveItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/staff-requests/${leaveId}/reject`, {
      method: 'PATCH',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({ reviewNote }),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode rejectStaffLeaveRequest:', error);
  }

  const target = mockStaffLeaveRequests.find((r) => r.leaveId === leaveId);
  if (target) {
    target.status = 'REJECTED';
    target.reviewedBy = actorId;
    target.reviewedByRole = actorRole;
    target.reviewerName = actorRole === 'SUPERVISOR' ? 'Ban Giám đốc' : 'Quản lý';
    target.reviewedAt = new Date().toISOString();
    target.reviewNote = reviewNote;
    target.updatedAt = new Date().toISOString();
    return target;
  }
  throw new Error('Không tìm thấy đơn xin nghỉ phép.');
}

export async function cancelStaffLeaveRequest(
  actorId: string,
  actorRole: string,
  leaveId: string,
): Promise<StaffLeaveItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/resident-leave/staff-requests/${leaveId}/cancel`, {
      method: 'POST',
      headers: getHeaders(actorId, actorRole),
      body: JSON.stringify({}),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode cancelStaffLeaveRequest:', error);
  }

  const target = mockStaffLeaveRequests.find((r) => r.leaveId === leaveId);
  if (target) {
    target.status = 'CANCELLED';
    target.updatedAt = new Date().toISOString();
    return target;
  }
  throw new Error('Không tìm thấy đơn xin nghỉ phép.');
}

