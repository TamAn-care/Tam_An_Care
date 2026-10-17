export const CARE_ACTION_STATUSES = [
  'PENDING',
  'IN_REVIEW',
  'RESOLVED',
] as const;

export type CareActionStatus =
  typeof CARE_ACTION_STATUSES[number];


export const CARE_ACTION_PRIORITIES = [
  'HIGH',
  'MODERATE',
  'LOW',
] as const;

export type CareActionPriority =
  typeof CARE_ACTION_PRIORITIES[number];


export const CARE_ACTION_EVENT_TYPES = [
  'CREATED',
  'ASSIGNED',
  'TRANSFERRED',
  'REVIEW_STARTED',
  'RESOLVED',
  'REOPENED',
] as const;

export type CareActionEventType =
  typeof CARE_ACTION_EVENT_TYPES[number];


export interface CareAction {
  id: string;

  residentId: string;
  patternId: string;

  status: CareActionStatus;

  assignedTo: string | null;
  assignedRole: string | null;
  assignedAt: Date | null;

  priority: CareActionPriority | null;
  dueAt: Date | null;

  startedAt: Date | null;

  careNote: string | null;
  resolutionReason: string | null;
  resolvedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}


export interface CareActionTransfer {
  id: string;

  eventSequence: number;

  careActionId: string;

  eventType:
    'ASSIGNMENT' |
    'TRANSFER';

  fromAssignedTo: string | null;
  fromAssignedRole: string | null;

  toAssignedTo: string;
  toAssignedRole: string;

  priority: CareActionPriority | null;
  dueAt: Date | null;

  actorId: string | null;
  actorRole: string | null;

  transferredAt: Date;
}


export interface CareActionAuditEvent {
  id: string;

  eventSequence: number;

  careActionId: string;
  residentId: string;
  patternId: string;

  eventType: CareActionEventType;

  actorId: string | null;
  actorRole: string | null;

  previousState:
    Record<string, unknown> | null;

  newState:
    Record<string, unknown> | null;

  createdAt: Date;
}


export interface CreateCareActionInput {
  residentId: string;
  patternId: string;
}


export interface AssignCareActionInput {
  assignedTo: string;
  assignedRole: string;

  priority: CareActionPriority;
  dueAt: Date | null;

  actorId: string | null;
  actorRole: string | null;
}


export interface TransferCareActionInput {
  assignedTo: string;
  assignedRole: string;

  priority: CareActionPriority;
  dueAt: Date | null;

  actorId: string | null;
  actorRole: string | null;
}


export interface StartCareActionReviewInput {
  actorId: string | null;
  actorRole: string | null;
}


export interface ResolveCareActionInput {
  careNote: string;
  resolutionReason: string;

  actorId: string | null;
  actorRole: string | null;
}


export interface ReopenCareActionInput {
  actorId: string | null;
  actorRole: string | null;

  reopenReason: string | null;
}

export interface CareActionDetails {
  action: CareAction;

  transferHistory:
    CareActionTransfer[];

  auditTrail:
    CareActionAuditEvent[];
}

