import type {
  HumanActorSession,
  HumanActorRole,
} from '../types/actor';

import {
  apiRequest,
} from './client';

export type StaffActorStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface StaffActor {
  actorId: string;
  staffCode: string;
  displayName: string;
  primaryOperationalRole: HumanActorRole;
  status: StaffActorStatus;
  employmentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffActorListOptions {
  limit?: number;
  role?: HumanActorRole;
  status?: StaffActorStatus;
}

export async function listStaffActors(
  actor: HumanActorSession | null,
  options: StaffActorListOptions = {},
): Promise<StaffActor[]> {
  const params = new URLSearchParams();

  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }

  if (options.role) {
    params.set('role', options.role);
  }

  if (options.status) {
    params.set('status', options.status);
  }

  const query = params.toString();

  return apiRequest<StaffActor[]>(
    `/api/operations/staff-actors${
      query ? `?${query}` : ''
    }`,
    { actor },
  );
}

export async function getStaffActor(
  actorId: string,
  actor: HumanActorSession | null,
): Promise<StaffActor> {
  return apiRequest<StaffActor>(
    `/api/operations/staff-actors/${
      encodeURIComponent(actorId)
    }`,
    { actor },
  );
}
