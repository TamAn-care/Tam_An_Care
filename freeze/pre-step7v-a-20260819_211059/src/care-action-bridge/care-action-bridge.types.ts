export interface CareActionBridgeInput {
  warningId: string;

  actorId: string;
  actorRole: string;
}

export interface CareActionBridgeDecision {
  eligible: boolean;

  warningId: string;
  residentId: string;
  patternId: string;

  decision:
    | 'CREATE_CARE_ACTION';

  actorId: string;
  actorRole: string;

  reviewId: string;

  reason:
    | 'HUMAN_REVIEW_APPROVED';
}

export interface CareActionBridgeExecutionResult {
  reviewId: string;
  warningId: string;

  residentId: string;
  patternId: string;

  actorId: string;
  actorRole: string;

  careActionId: string;
  careActionStatus: string;

  assignedTo: string | null;
  assignedRole: string | null;

  bridgeStatus:
    | 'CARE_ACTION_CREATED';

  autonomousClinicalAction: false;
}
