export type IncidentAction =
  | 'TRIAGE'
  | 'ASSIGN'
  | 'ACKNOWLEDGE'
  | 'START_RESPONSE'
  | 'ADD_RESPONSE'
  | 'ESCALATE'
  | 'ASSIGN_ESCALATION'
  | 'ACCEPT_ESCALATION'
  | 'RESOLVE_ESCALATION'
  | 'RESOLVE'
  | 'POST_REVIEW'
  | 'CLOSE'
  | 'LINK_CARE_ACTION'
  | 'LINK_CARE_TASK'
  | 'LINK_CLINICAL_OBSERVATION'
  | 'LINK_MEDICATION_RECORD';

export interface ReportIncidentInput {
  residentId?: string | null;
  incidentCode?: string | null;
  incidentType?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  occurredAt?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
}

export interface IncidentMutationInput {
  actorId?: string | null;
  actorRole?: string | null;

  severity?: string | null;
  summary?: string | null;

  assignedTo?: string | null;
  assignedRole?: string | null;

  responseType?: string | null;
  responseNote?: string | null;

  escalationType?: string | null;
  reason?: string | null;

  escalationId?: string | null;

  assignedReviewer?: string | null;
  assignedReviewerRole?: string | null;

  resolutionSummary?: string | null;

  reviewSummary?: string | null;
  contributingFactors?: string | null;
  preventiveActions?: string | null;
  followUpRequired?: boolean | null;

  linkedId?: string | null;
}
