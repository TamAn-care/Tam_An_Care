export interface CareActionBridgeInput {
  warningId: string;

  actorId: string;
  actorRole: string;
}

export interface CareActionBridgeDecision {
  eligible: boolean;

  warningId: string;
  residentId: string;

  decision:
    | 'CREATE_CARE_ACTION';

  actorId: string;
  actorRole: string;

  reviewId: string;

  reason:
    | 'HUMAN_REVIEW_APPROVED';
}
