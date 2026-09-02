import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';
import type { ResidentContextResponse } from './residents';

export type ResidentPage = {
  items: ResidentContextResponse[];
  total: number;
  limit: number;
  offset: number;
};

export type CarePlanItem = {
  carePlanId: string;
  residentId: string;
  planCode: string;
  title: string;
  description: string | null;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updatedAt: string;
};

export function listLifecycleResidents(
  actor: HumanActorSession,
  limit = 100,
  offset = 0,
): Promise<ResidentPage> {
  return apiRequest(`/api/residents?limit=${limit}&offset=${offset}`, { actor });
}

export function listLifecycleHistory(
  actor: HumanActorSession,
  residentId: string,
) {
  return apiRequest(
    `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/history?limit=100&offset=0`,
    { actor },
  );
}

export function listResidentCarePlans(
  actor: HumanActorSession,
  residentId: string,
): Promise<{ items: CarePlanItem[]; total: number; limit: number; offset: number }> {
  return apiRequest(
    `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/care-plans?limit=100&offset=0`,
    { actor },
  );
}

export function updateResidentCarePlan(
  actor: HumanActorSession,
  carePlanId: string,
  input: {
    expectedUpdatedAt: string;
    title: string;
    description?: string | null;
  },
) {
  return apiRequest(
    `/api/resident-lifecycle/care-plans/${encodeURIComponent(carePlanId)}`,
    {
      method: 'PATCH',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function dischargeResident(
  actor: HumanActorSession,
  residentId: string,
  input: { reason: string; note?: string; destination?: string },
) {
  return apiRequest(
    `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/discharge`,
    {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}
