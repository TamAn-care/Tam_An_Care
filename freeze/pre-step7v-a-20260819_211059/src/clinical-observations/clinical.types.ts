export type ClinicalAction =
  | 'VERIFY_OBSERVATION'
  | 'AMEND_OBSERVATION'
  | 'VOID_OBSERVATION'
  | 'SIGN_NURSING_NOTE'
  | 'ACKNOWLEDGE_FINDING'
  | 'START_FINDING_REVIEW'
  | 'ESCALATE_FINDING'
  | 'CLOSE_FINDING'
  | 'ASSIGN_ESCALATION'
  | 'ACCEPT_ESCALATION'
  | 'RESOLVE_ESCALATION'
  | 'CANCEL_ESCALATION'
  | 'LINK_CARE_ACTION';

export interface ClinicalMutationInput {
  actorId: string | null;
  actorRole: string | null;

  reason?: string | null;
  correctedValue?: unknown;

  reviewOutcome?: string | null;

  assignedReviewer?: string | null;
  assignedReviewerRole?: string | null;

  resolutionSummary?: string | null;

  linkedCareActionId?: string | null;
}

export interface ClinicalMutationResult {
  aggregateId: string;
  aggregateType: string;
  status: string;

  action: ClinicalAction;
  auditEvent: string;

  actorId: string;
  actorRole: string;

  autonomousClinicalAction: false;
}
