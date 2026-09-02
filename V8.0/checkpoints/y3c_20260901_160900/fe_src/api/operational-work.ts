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

export function listWorkEventTypes(
  actor: HumanActorSession,
  limit = 100,
) {
  return apiRequest<BoundedList<WorkEventType>>(
    `${TYPE_BASE}${queryString({
      limit,
      active: 'true',
    })}`,
    { actor },
  );
}

export function listWorkEvents(
  actor: HumanActorSession,
  filters: WorkEventFilters = {},
) {
  return apiRequest<BoundedList<WorkEvent>>(
    `${EVENT_BASE}${queryString({
      residentId: filters.residentId,
      workEventTypeId:
        filters.workEventTypeId,
      performedBy: filters.performedBy,
      status: filters.status,
      sourceDomain: filters.sourceDomain,
      limit: filters.limit ?? 50,
    })}`,
    { actor },
  );
}

export function getWorkEvent(
  actor: HumanActorSession,
  id: string,
) {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}`,
    { actor },
  );
}

export function createWorkEvent(
  actor: HumanActorSession,
  input: CreateWorkEventInput,
) {
  return apiRequest<WorkEvent>(
    EVENT_BASE,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function verifyWorkEvent(
  actor: HumanActorSession,
  id: string,
) {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}/verify`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function amendWorkEvent(
  actor: HumanActorSession,
  id: string,
  input: AmendWorkEventInput,
) {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}/amend`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function voidWorkEvent(
  actor: HumanActorSession,
  id: string,
  reasonCode: string,
) {
  return apiRequest<WorkEvent>(
    `${EVENT_BASE}/${encodeURIComponent(id)}/void`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify({ reasonCode }),
    },
  );
}
