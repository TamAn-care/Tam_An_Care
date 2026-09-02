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

export interface CreateStaffActorInput {
  actorId: string;
  staffCode: string;
  displayName: string;
  primaryOperationalRole: HumanActorRole;
  employmentReference?: string | null;
}

export interface UpdateStaffActorInput {
  displayName?: string;
  employmentReference?: string | null;
  primaryOperationalRole?: HumanActorRole;
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

  const response = await apiRequest<{
    items: StaffActor[];
    count: number;
    limit: number;
  }>(
    `/api/operations/staff-actors${
      query ? `?${query}` : ''
    }`,
    { actor },
  );

  return response.items;
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

export async function createStaffActor(
  actor: HumanActorSession | null,
  input: CreateStaffActorInput,
): Promise<StaffActor> {
  return apiRequest<StaffActor>(
    '/api/operations/staff-actors',
    {
      actor,
      method: 'POST',
      body: input,
    },
  );
}

export async function updateStaffActor(
  actor: HumanActorSession | null,
  actorId: string,
  input: UpdateStaffActorInput,
): Promise<StaffActor> {
  return apiRequest<StaffActor>(
    `/api/operations/staff-actors/${
      encodeURIComponent(actorId)
    }`,
    {
      actor,
      method: 'PATCH',
      body: input,
    },
  );
}
