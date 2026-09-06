import {
  apiRequest,
} from './client';
import type {
  HumanActorSession,
} from '../types/actor';

export type WorkEventStatus =
  | 'RECORDED'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'AMENDED'
  | 'VOIDED';

export type PlannedClassification =
  | 'PLANNED'
  | 'ADDITIONAL'
  | 'UNPLANNED';

export interface WorkEventType {
  work_event_type_id: string;
  code: string;
  display_name_vi: string;
  category: string;
  default_unit: string;
  default_work_weight: string | number;
  resident_related: boolean;
  inventory_link_allowed: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkEvent {
  work_event_id: string;
  resident_id: string | null;
  work_event_type_id: string;
  source_domain: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  planned_classification: PlannedClassification;
  occurred_at: string;
  started_at: string | null;
  completed_at: string | null;
  performed_by: string;
  performed_by_role: string;
  quantity: string | number;
  unit: string;
  work_weight: string | number;
  reason_code: string | null;
  note: string | null;
  status: WorkEventStatus;
  metrics?: Record<string, any>;
}

export interface BoundedList<T> {
  items: T[];
  count: number;
  limit: number;
}

export interface WorkEventFilters {
  residentId?: string;
  workEventTypeId?: string;
  performedBy?: string;
  status?: WorkEventStatus | '';
  sourceDomain?: string;
  limit?: number;
}

export interface CreateWorkEventInput {
  residentId?: string;
  workEventTypeId: string;
  sourceDomain: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  plannedClassification: PlannedClassification;
  occurredAt?: string;
  startedAt?: string;
  completedAt?: string;
  quantity?: number;
  reasonCode?: string;
  note?: string;
  status?: 'COMPLETED' | 'RECORDED';
  metrics?: Record<string, any>;
}

export interface AmendWorkEventInput {
  quantity?: number;
  reasonCode?: string;
  note?: string;
  startedAt?: string;
  completedAt?: string;
}

const EVENT_BASE =
  '/api/operations/work-events';

const TYPE_BASE =
  '/api/operations/work-event-types';

export const MOCK_WORK_EVENT_TYPES: WorkEventType[] = [
  {
    work_event_type_id: 'ops-wet-hygiene-bathing',
    code: 'HYGIENE_BATHING',
    display_name_vi: 'Tắm rửa & Vệ sinh thân thể',
    category: 'PERSONAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-meal-assistance',
    code: 'MEAL_ASSISTANCE',
    display_name_vi: 'Hỗ trợ ăn uống & Bón cháo/cơm',
    category: 'NUTRITION',
    default_unit: 'bữa',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-tube-feeding-assist',
    code: 'TUBE_FEEDING_ASSIST',
    display_name_vi: 'Hỗ trợ ăn qua ống thông Sonde',
    category: 'NUTRITION',
    default_unit: 'cữ',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-vital-signs-check',
    code: 'VITAL_SIGNS_CHECK',
    display_name_vi: 'Đo dấu hiệu sinh tồn & Huyết áp',
    category: 'CLINICAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-medication-admin',
    code: 'MEDICATION_ADMINISTRATION',
    display_name_vi: 'Cấp phát & Cho uống thuốc theo y lệnh',
    category: 'CLINICAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-wound-care',
    code: 'WOUND_CARE',
    display_name_vi: 'Thay băng & Chăm sóc vết thương/loét',
    category: 'CLINICAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-mobility-assistance',
    code: 'MOBILITY_ASSISTANCE',
    display_name_vi: 'Hỗ trợ di chuyển & Đổi tư thế chống loét',
    category: 'MOBILITY',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-rehab-exercise',
    code: 'REHAB_EXERCISE',
    display_name_vi: 'Hướng dẫn tập VLTL & Phục hồi chức năng',
    category: 'MOBILITY',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-psychological-support',
    code: 'PSYCHOLOGICAL_SUPPORT',
    display_name_vi: 'Trò chuyện & Tham vấn tâm lý tinh thần',
    category: 'PSYCHOSOCIAL',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-diaper-toileting',
    code: 'DIAPER_TOILETING',
    display_name_vi: 'Thay tã bỉm & Vệ sinh bài tiết',
    category: 'PERSONAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-room-cleaning',
    code: 'ROOM_CLEANING_INCIDENTAL',
    display_name_vi: 'Dọn dẹp phòng & Thay drap giường đột xuất',
    category: 'HOUSEKEEPING',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-emergency-care',
    code: 'EMERGENCY_INCIDENT_CARE',
    display_name_vi: 'Xử lý sự cố / Sơ cứu khẩn cấp',
    category: 'EMERGENCY',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-family-visit',
    code: 'FAMILY_VISIT_ASSIST',
    display_name_vi: 'Đón tiếp thân nhân & Hỗ trợ thăm gặp',
    category: 'PSYCHOSOCIAL',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-other-incidental',
    code: 'OTHER_INCIDENTAL',
    display_name_vi: 'Khác (Diễn giải chi tiết tại phần Ghi chú)',
    category: 'OTHER',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const MOCK_INITIAL_WORK_EVENTS: WorkEvent[] = [
  {
    work_event_id: 'we-2026-001',
    resident_id: 'res-demo-001',
    work_event_type_id: 'ops-wet-vital-signs-check',
    source_domain: 'CARE_EXECUTION',
    source_entity_type: 'CARE_PLAN',
    source_entity_id: 'CP-2026-001',
    planned_classification: 'PLANNED',
    occurred_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    started_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    performed_by: 'NURSE-01',
    performed_by_role: 'NURSE',
    quantity: 1,
    unit: 'lần',
    work_weight: 1,
    reason_code: null,
    note: 'Huyết áp 125/80 mmHg, mạch 75 lần/phút, thể trạng ổn định.',
    status: 'VERIFIED',
  },
  {
    work_event_id: 'we-2026-002',
    resident_id: 'res-demo-001',
    work_event_type_id: 'ops-wet-medication-admin',
    source_domain: 'MEDICATION',
    source_entity_type: 'EMAR_SCHEDULE',
    source_entity_id: 'EMAR-001',
    planned_classification: 'PLANNED',
    occurred_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    started_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 3.9).toISOString(),
    performed_by: 'NURSE-01',
    performed_by_role: 'NURSE',
    quantity: 1,
    unit: 'lần',
    work_weight: 1,
    reason_code: null,
    note: 'Đã phát 2 viên Amlodipine 5mg sau ăn sáng đúng quy tắc 5 Đúng.',
    status: 'COMPLETED',
  },
  {
    work_event_id: 'we-2026-003',
    resident_id: 'res-demo-001',
    work_event_type_id: 'ops-wet-meal-assistance',
    source_domain: 'NUTRITION',
    source_entity_type: 'MEAL_PLAN',
    source_entity_id: 'MP-001',
    planned_classification: 'PLANNED',
    occurred_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    started_at: new Date(Date.now() - 3600000 * 5.5).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    performed_by: 'CAREGIVER-02',
    performed_by_role: 'CAREGIVER',
    quantity: 1,
    unit: 'bữa',
    work_weight: 1,
    reason_code: null,
    note: 'Ăn hết 1 bát cháo thịt băm, uống 200ml nước ấm.',
    status: 'COMPLETED',
  },
  {
    work_event_id: 'we-2026-004',
    resident_id: 'res-demo-002',
    work_event_type_id: 'ops-wet-hygiene-bathing',
    source_domain: 'PERSONAL_CARE',
    source_entity_type: 'DAILY_ROUTINE',
    source_entity_id: 'DR-002',
    planned_classification: 'PLANNED',
    occurred_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    started_at: new Date(Date.now() - 3600000 * 6.5).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    performed_by: 'CAREGIVER-01',
    performed_by_role: 'CAREGIVER',
    quantity: 1,
    unit: 'lần',
    work_weight: 1,
    reason_code: null,
    note: 'Hỗ trợ tắm nước ấm sinh hoạt buổi sáng, sấy tóc khô.',
    status: 'RECORDED',
  },
  {
    work_event_id: 'we-2026-005',
    resident_id: 'res-demo-003',
    work_event_type_id: 'ops-wet-mobility-assistance',
    source_domain: 'MOBILITY',
    source_entity_type: 'REHAB_SCHEDULE',
    source_entity_id: 'RS-003',
    planned_classification: 'ADDITIONAL',
    occurred_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    started_at: new Date(Date.now() - 3600000 * 8.5).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    performed_by: 'PHYSIO-01',
    performed_by_role: 'PHYSIOTHERAPIST',
    quantity: 1,
    unit: 'lần',
    work_weight: 1,
    reason_code: null,
    note: 'Hỗ trợ tập đi nạng 15 phút tại sảnh hành lang tầng 1.',
    status: 'VERIFIED',
  },
];

const MOCK_STORAGE_KEY = 'taman_care_mock_work_events';

function getStoredMockEvents(): WorkEvent[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      const parsed: WorkEvent[] = JSON.parse(raw);
      let updated = false;
      for (const e of parsed) {
        if (e.resident_id === 'RES-2026-001') { e.resident_id = 'res-demo-001'; updated = true; }
        if (e.resident_id === 'RES-2026-002') { e.resident_id = 'res-demo-002'; updated = true; }
        if (e.resident_id === 'RES-2026-003') { e.resident_id = 'res-demo-003'; updated = true; }
        if (e.resident_id === 'RES-2026-004') { e.resident_id = 'res-demo-004'; updated = true; }
        if (e.resident_id === 'RES-2026-005') { e.resident_id = 'res-demo-005'; updated = true; }
      }
      if (updated) {
        saveStoredMockEvents(parsed);
      }
      return parsed;
    }
  } catch {}
  return MOCK_INITIAL_WORK_EVENTS;
}

function saveStoredMockEvents(events: WorkEvent[]) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

function queryString(
  values: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        String(value).trim() !== ''
      ) {
        params.set(key, String(value));
      }
    },
  );

  const result = params.toString();
  return result ? `?${result}` : '';
}

export async function listWorkEventTypes(
  actor: HumanActorSession,
  limit = 100,
): Promise<BoundedList<WorkEventType>> {
  try {
    return await apiRequest<BoundedList<WorkEventType>>(
      `${TYPE_BASE}${queryString({
        limit,
        active: 'true',
      })}`,
      { actor },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listWorkEventTypes:', error);
    return {
      items: MOCK_WORK_EVENT_TYPES,
      count: MOCK_WORK_EVENT_TYPES.length,
      limit,
    };
  }
}

export async function listWorkEvents(
  actor: HumanActorSession,
  filters: WorkEventFilters = {},
): Promise<BoundedList<WorkEvent>> {
  try {
    return await apiRequest<BoundedList<WorkEvent>>(
      `${EVENT_BASE}${queryString({
        residentId: filters.residentId,
        workEventTypeId: filters.workEventTypeId,
        performedBy: filters.performedBy,
        status: filters.status,
        sourceDomain: filters.sourceDomain,
        limit: filters.limit ?? 50,
      })}`,
      { actor },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listWorkEvents:', error);
    let items = getStoredMockEvents();

    if (filters.residentId) {
      items = items.filter((e) => e.resident_id === filters.residentId);
    }
    if (filters.workEventTypeId) {
      items = items.filter((e) => e.work_event_type_id === filters.workEventTypeId);
    }
    if (filters.performedBy) {
      const kw = filters.performedBy.toLowerCase();
      items = items.filter((e) => e.performed_by.toLowerCase().includes(kw));
    }
    if (filters.status) {
      items = items.filter((e) => e.status === filters.status);
    }
    if (filters.sourceDomain) {
      items = items.filter((e) => e.source_domain === filters.sourceDomain);
    }

    const limitVal = filters.limit ?? 50;
    return {
      items: items.slice(0, limitVal),
      count: items.length,
      limit: limitVal,
    };
  }
}

export async function getWorkEvent(
  actor: HumanActorSession,
  id: string,
): Promise<WorkEvent> {
  try {
    return await apiRequest<WorkEvent>(
      `${EVENT_BASE}/${encodeURIComponent(id)}`,
      { actor },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for getWorkEvent:', error);
    const items = getStoredMockEvents();
    const found = items.find((e) => e.work_event_id === id);
    if (found) return found;
    return items[0];
  }
}

export async function createWorkEvent(
  actor: HumanActorSession,
  input: CreateWorkEventInput,
): Promise<WorkEvent> {
  try {
    return await apiRequest<WorkEvent>(
      EVENT_BASE,
      {
        actor,
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for createWorkEvent:', error);
    const items = getStoredMockEvents();
    const typeObj = MOCK_WORK_EVENT_TYPES.find((t) => t.work_event_type_id === input.workEventTypeId);
    const newEvent: WorkEvent = {
      work_event_id: `we-${Date.now()}`,
      resident_id: input.residentId || null,
      work_event_type_id: input.workEventTypeId,
      source_domain: input.sourceDomain || 'OPERATIONS',
      source_entity_type: input.sourceEntityType || null,
      source_entity_id: input.sourceEntityId || null,
      planned_classification: input.plannedClassification || 'UNPLANNED',
      occurred_at: input.occurredAt || new Date().toISOString(),
      started_at: input.startedAt || new Date().toISOString(),
      completed_at: input.completedAt || new Date().toISOString(),
      performed_by: actor.displayName || actor.actorId,
      performed_by_role: actor.actorRole,
      quantity: input.quantity ?? 1,
      unit: typeObj?.default_unit || 'lần',
      work_weight: typeObj?.default_work_weight || 1,
      reason_code: input.reasonCode || null,
      note: input.note || null,
      status: input.status || 'COMPLETED',
      metrics: input.metrics,
    };
    const updated = [newEvent, ...items];
    saveStoredMockEvents(updated);

    if (input.residentId && input.metrics) {
      try {
        localStorage.setItem(`taman_care_mock_vitals_${input.residentId}`, JSON.stringify({
          ...input.metrics,
          updatedAt: new Date().toISOString(),
        }));
      } catch {}
    }

    return newEvent;
  }
}

export async function verifyWorkEvent(
  actor: HumanActorSession,
  id: string,
): Promise<WorkEvent> {
  try {
    return await apiRequest<WorkEvent>(
      `${EVENT_BASE}/${encodeURIComponent(id)}/verify`,
      {
        actor,
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for verifyWorkEvent:', error);
    const items = getStoredMockEvents();
    const idx = items.findIndex((e) => e.work_event_id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], status: 'VERIFIED' };
      saveStoredMockEvents(items);
      return items[idx];
    }
    throw error;
  }
}

export async function amendWorkEvent(
  actor: HumanActorSession,
  id: string,
  input: AmendWorkEventInput,
): Promise<WorkEvent> {
  try {
    return await apiRequest<WorkEvent>(
      `${EVENT_BASE}/${encodeURIComponent(id)}/amend`,
      {
        actor,
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for amendWorkEvent:', error);
    const items = getStoredMockEvents();
    const idx = items.findIndex((e) => e.work_event_id === id);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        status: 'AMENDED',
        quantity: input.quantity ?? items[idx].quantity,
        note: input.note ? `${items[idx].note ? items[idx].note + ' | ' : ''}Điều chỉnh: ${input.note}` : items[idx].note,
        reason_code: input.reasonCode || items[idx].reason_code,
      };
      saveStoredMockEvents(items);
      return items[idx];
    }
    throw error;
  }
}

export async function voidWorkEvent(
  actor: HumanActorSession,
  id: string,
  reasonCode: string,
): Promise<WorkEvent> {
  try {
    return await apiRequest<WorkEvent>(
      `${EVENT_BASE}/${encodeURIComponent(id)}/void`,
      {
        actor,
        method: 'POST',
        body: JSON.stringify({ reasonCode }),
      },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for voidWorkEvent:', error);
    const items = getStoredMockEvents();
    const idx = items.findIndex((e) => e.work_event_id === id);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        status: 'VOIDED',
        reason_code: reasonCode,
      };
      saveStoredMockEvents(items);
      return items[idx];
    }
    throw error;
  }
}

