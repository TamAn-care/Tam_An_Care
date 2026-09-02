import type {
  HumanActorSession,
  HumanActorRole,
} from '../types/actor';

import {
  apiRequest,
} from './client';

export type AssignmentRole =
  Extract<HumanActorRole, 'CAREGIVER' | 'NURSE'>;

export interface ResidentAccessAssignment {
  residentAccessAssignmentId: string;
  residentId: string;
  actorId: string;
  actorRole: AssignmentRole;
  accessScope: string;
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
  accessScope?: string;
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
  return apiRequest<ResidentAccessAssignment[]>(
    BASE,
    { actor },
  );
}

export async function createResidentAccessAssignment(
  actor: HumanActorSession,
  input: CreateResidentAccessAssignmentInput,
): Promise<ResidentAccessAssignment> {
  return apiRequest<ResidentAccessAssignment>(
    `/api/operations/residents/${
      encodeURIComponent(input.residentId)
    }/access-assignments`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function revokeResidentAccessAssignment(
  actor: HumanActorSession,
  assignmentId: string,
  input: RevokeResidentAccessAssignmentInput = {},
): Promise<ResidentAccessAssignment> {
  return apiRequest<ResidentAccessAssignment>(
    `${BASE}/${
      encodeURIComponent(assignmentId)
    }/revoke`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
