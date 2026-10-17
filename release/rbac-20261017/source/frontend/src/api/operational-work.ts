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
    work_event_type_id: 'ops-wet-mmse-cognitive-assess',
    code: 'COGNITIVE_ASSESSMENT_MMSE',
    display_name_vi: 'Đánh giá nhận thức MMSE / MoCA & Trầm cảm GDS',
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
    work_event_type_id: 'ops-wet-reminiscence-therapy',
    code: 'REMINISCENCE_THERAPY',
    display_name_vi: 'Liệu pháp Ký ức (Reminiscence Therapy) & Trị liệu nhóm',
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
    work_event_type_id: 'ops-wet-relocation-adaptation',
    code: 'RELOCATION_ADAPTATION_SUPPORT',
    display_name_vi: 'Hỗ trợ tâm lý thích ứng khi mới vào viện / Giải tỏa khủng hoảng',
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
    work_event_type_id: 'ops-wet-social-group-activity',
    code: 'SOCIAL_GROUP_ACTIVITY',
    display_name_vi: 'Tổ chức sinh hoạt nhóm, CLB & Sự kiện giao lưu cộng đồng',
    category: 'PSYCHOSOCIAL',
    default_unit: 'buổi',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    work_event_type_id: 'ops-wet-family-connect',
    code: 'FAMILY_RELATIONSHIP_CONNECT',
    display_name_vi: 'Tham vấn & Hỗ trợ gắn kết tình cảm Thân nhân - Người cao tuổi',
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
    work_event_type_id: 'ops-wet-social-work-admission',
    code: 'SOCIAL_WORK_ADMISSION',
    display_name_vi: 'Đánh giá nhu cầu trợ giúp xã hội & Bảo vệ quyền lợi cụ',
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
  return apiRequest<BoundedList<WorkEventType>>(
    `${TYPE_BASE}${queryString({
      limit,
      active: 'true',
    })}`,
    { actor },
  );
}

export async function listWorkEvents(
  actor: HumanActorSession,
  filters: WorkEventFilters = {},
): Promise<BoundedList<WorkEvent>> {
  return apiRequest<BoundedList<WorkEvent>>(
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
}

export async function getWorkEvent(
  actor: HumanActorSession,
  id: string,
): Promise<WorkEvent> {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}`,
    { actor },
  );
}

export async function createWorkEvent(
  actor: HumanActorSession,
  input: CreateWorkEventInput,
): Promise<WorkEvent> {
  return apiRequest<WorkEvent>(
    EVENT_BASE,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function verifyWorkEvent(
  actor: HumanActorSession,
  id: string,
): Promise<WorkEvent> {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}/verify`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function amendWorkEvent(
  actor: HumanActorSession,
  id: string,
  input: AmendWorkEventInput,
): Promise<WorkEvent> {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}/amend`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function voidWorkEvent(
  actor: HumanActorSession,
  id: string,
  reasonCode: string,
): Promise<WorkEvent> {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}/void`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify({ reasonCode }),
    },
  );
}
