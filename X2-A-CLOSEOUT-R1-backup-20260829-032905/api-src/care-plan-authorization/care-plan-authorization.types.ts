export const CARE_PLAN_GOVERNANCE_ACTIONS = [
  'ACTIVATE',
  'REACTIVATE',
  'SUSPEND',
  'COMPLETE',
  'CANCEL',
] as const;

export type CarePlanGovernanceAction =
  typeof CARE_PLAN_GOVERNANCE_ACTIONS[number];


export interface CarePlanAuthorizationInput {
  currentStatus: string;
  action: CarePlanGovernanceAction;
  actorId: string;
  actorRole: string;
}


export interface CarePlanAuthorizationDecision {
  authorized: true;
  actorId: string;
  actorRole:
    | 'SUPERVISOR'
    | 'CARE_MANAGER';
  action: CarePlanGovernanceAction;
  targetStatus:
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'COMPLETED'
    | 'CANCELLED';
  auditEvent:
    | 'PLAN_ACTIVATED'
    | 'PLAN_REACTIVATED'
    | 'PLAN_SUSPENDED'
    | 'PLAN_COMPLETED'
    | 'PLAN_CANCELLED';
  autonomousClinicalAction: false;
}
