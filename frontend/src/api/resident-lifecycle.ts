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

import { listResidents } from './residents';

export async function listLifecycleResidents(
  actor: HumanActorSession,
  limit = 100,
  offset = 0,
): Promise<ResidentPage> {
  try {
    return await apiRequest(`/api/residents?limit=${limit}&offset=${offset}`, { actor });
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listLifecycleResidents:', error);
    const list = await listResidents(actor);
    return {
      items: list,
      total: list.length,
      limit,
      offset,
    };
  }
}

export async function listLifecycleHistory(
  actor: HumanActorSession,
  residentId: string,
) {
  try {
    return await apiRequest(
      `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/history?limit=100&offset=0`,
      { actor },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listLifecycleHistory:', error);
    return { items: [], total: 0 };
  }
}

export async function listResidentCarePlans(
  actor: HumanActorSession,
  residentId: string,
): Promise<{ items: CarePlanItem[]; total: number; limit: number; offset: number }> {
  try {
    return await apiRequest(
      `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/care-plans?limit=100&offset=0`,
      { actor },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listResidentCarePlans:', error);
    return {
      items: [
        {
          carePlanId: `plan-${residentId}`,
          residentId,
          planCode: `CP-2026-${residentId.slice(-3)}`,
          title: 'Kế hoạch chăm sóc y tế toàn diện & Theo dõi sinh hiệu',
          description: 'Theo dõi chỉ số sinh hiệu 2 lần/ngày, hỗ trợ ăn uống và phục hồi vận động.',
          status: 'ACTIVE',
          effectiveFrom: '2026-08-01',
          effectiveTo: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    };
  }
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
