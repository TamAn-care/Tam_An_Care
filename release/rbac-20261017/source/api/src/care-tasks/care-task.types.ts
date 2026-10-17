export const CARE_TASK_STATUSES = [
  'PLANNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'SKIPPED',
  'CANCELLED',
] as const;

export type CareTaskStatus =
  typeof CARE_TASK_STATUSES[number];


export const CARE_TASK_PRIORITIES = [
  'LOW',
  'MODERATE',
  'HIGH',
] as const;

export type CareTaskPriority =
  typeof CARE_TASK_PRIORITIES[number];


export const CARE_TASK_AUDIT_EVENTS = [
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'TASK_REASSIGNED',
  'TASK_STARTED',
  'TASK_COMPLETED',
  'TASK_MISSED',
  'TASK_SKIPPED',
  'TASK_CANCELLED',
] as const;

export type CareTaskAuditEventType =
  typeof CARE_TASK_AUDIT_EVENTS[number];


export interface CareTask {
  careTaskId: string;
  carePlanId: string;
  residentId: string;
  taskCode: string;
  title: string;
  description: string | null;
  taskCategory: string;
  status: CareTaskStatus;
  priority: CareTaskPriority;
  scheduledAt: Date | null;
  dueAt: Date | null;
  recurrenceRule: string | null;
  assignedTo: string | null;
  assignedRole: string | null;
  assignedAt: Date | null;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  missedAt: Date | null;
  skippedAt: Date | null;
  cancelledAt: Date | null;
  completionNote: string | null;
  exceptionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}


export interface CreateCareTaskInput {
  careTaskId: string;
  carePlanId: string;
  residentId: string;
  taskCode: string;
  title: string;
  description?: string | null;
  taskCategory: string;
  priority: CareTaskPriority;
  scheduledAt?: Date | string | null;
  dueAt?: Date | string | null;
  recurrenceRule?: string | null;
  actorId: string;
  actorRole: string;
}


export interface CareTaskAuditEvent {
  auditId: string;
  eventSequence: number;
  careTaskId: string;
  carePlanId: string;
  residentId: string;
  eventType: CareTaskAuditEventType;
  actorId: string | null;
  actorRole: string | null;
  previousState:
    Record<string, unknown> | null;
  newState:
    Record<string, unknown> | null;
  createdAt: Date;
}
