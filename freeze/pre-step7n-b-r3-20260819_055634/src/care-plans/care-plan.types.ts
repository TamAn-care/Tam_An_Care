export const CARE_PLAN_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type CarePlanStatus =
  typeof CARE_PLAN_STATUSES[number];

export interface CarePlan {
  carePlanId: string;
  residentId: string;
  planCode: string;
  title: string;
  description: string | null;
  status: CarePlanStatus;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  createdBy: string;
  createdByRole: string;
  approvedBy: string | null;
  approvedByRole: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCarePlanInput {
  carePlanId: string;
  residentId: string;
  planCode: string;
  title: string;
  description?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  createdBy: string;
  createdByRole: string;
}

export interface CarePlanAuditEvent {
  auditId: string;
  eventSequence: number;
  carePlanId: string;
  residentId: string;
  eventType:
    | 'PLAN_CREATED'
    | 'PLAN_ACTIVATED'
    | 'PLAN_SUSPENDED'
    | 'PLAN_REACTIVATED'
    | 'PLAN_COMPLETED'
    | 'PLAN_CANCELLED'
    | 'PLAN_UPDATED';
  actorId: string | null;
  actorRole: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  createdAt: Date;
}
