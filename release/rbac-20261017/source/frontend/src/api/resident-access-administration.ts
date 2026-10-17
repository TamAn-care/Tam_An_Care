import type {
  HumanActorSession,
  HumanActorRole,
} from '../types/actor';

import {
  apiRequest,
} from './client';

export type AssignmentRole =
  Extract<
    HumanActorRole,
    | 'CAREGIVER'
    | 'NURSE'
    | 'PSYCHOLOGIST'
    | 'SOCIAL_WORKER'
  >;

export type ResidentAccessScope =
  | 'DIRECT_CARE'
  | 'CLINICAL_CARE'
  | 'PSYCHOSOCIAL_CARE';

export interface ResidentAccessAssignment {
  residentAccessAssignmentId: string;
  residentId: string;
  actorId: string;
  actorRole: AssignmentRole;
  accessScope: ResidentAccessScope;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  assignedBy: string;
  assignedByRole: 'SUPERVISOR';
  assignedAt: string;
  revokedBy: string | null;
  revokedByRole: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResidentAccessAssignmentInput {
  residentId: string;
  actorId: string;
  actorRole: AssignmentRole;
  accessScope: ResidentAccessScope;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface RevokeResidentAccessAssignmentInput {
  revocationReason?: string;
}

const BASE =
  '/api/operations/access-assignments';

export async function listResidentAccessAssignments(
  actor: HumanActorSession,
): Promise<ResidentAccessAssignment[]> {
  const res = await apiRequest<
    { data: ResidentAccessAssignment[] }
    | ResidentAccessAssignment[]
  >(
    BASE,
    { actor },
  );

  if (Array.isArray(res)) {
    return res;
  }

  if (
    res &&
    Array.isArray((res as any).data)
  ) {
    return (res as any).data;
  }

  throw new Error(
    'Invalid resident-access assignment response.'
  );
}

export async function createResidentAccessAssignment(
  actor: HumanActorSession,
  input: CreateResidentAccessAssignmentInput,
): Promise<ResidentAccessAssignment> {
  const res = await apiRequest<{ data: ResidentAccessAssignment } | ResidentAccessAssignment>(
    `/api/operations/residents/${
      encodeURIComponent(input.residentId)
    }/access-assignments`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (res && (res as any).data) return (res as any).data;
  return res as ResidentAccessAssignment;
}

export async function revokeResidentAccessAssignment(
  actor: HumanActorSession,
  assignmentId: string,
  input: RevokeResidentAccessAssignmentInput = {},
): Promise<ResidentAccessAssignment> {
  const res = await apiRequest<{ data: ResidentAccessAssignment } | ResidentAccessAssignment>(
    `${BASE}/${
      encodeURIComponent(assignmentId)
    }/revoke`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (res && (res as any).data) return (res as any).data;
  return res as ResidentAccessAssignment;
}
