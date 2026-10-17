export type RehabActorRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR'
  | 'CARE_MANAGER'
  | 'AI'
  | 'SYSTEM';

export interface RehabCommand {
  action: string;

  actorId: string;
  actorRole: RehabActorRole;

  activityProgramId?: string;
  rehabilitationPlanId?: string;
  activitySessionId?: string;
  participationId?: string;
  functionalAssessmentId?: string;
  functionalSupportActionId?: string;
  rehabilitationEscalationId?: string;

  title?: string;
  description?: string;
  activityCategory?: string;
  defaultSupportLevel?: string;
  defaultLocation?: string;

  goalSummary?: string;
  mobilityPrecautions?: string;
  transferPrecautions?: string;
  weightBearingRestriction?: string;
  assistiveDeviceRequirement?: string;
  otherSafetyRestrictions?: string;

  sessionType?: string;
  scheduledAt?: string;
  location?: string;
  plannedDurationMinutes?: number;
  supportLevel?: string;

  assignedTo?: string;
  assignedRole?: RehabActorRole;

  safetyConfirmed?: boolean;

  completionNote?: string;
  exceptionReason?: string;

  attendanceStatus?: string;
  participationLevel?: string;
  assistanceLevel?: string;
  durationMinutes?: number;
  residentResponse?: string;
  observationNote?: string;

  assessmentType?: string;
  assessmentContext?: string;
  mobilityObservation?: string;
  transferObservation?: string;
  balanceObservation?: string;
  enduranceObservation?: string;
  functionalSupportNote?: string;

  amendmentReason?: string;

  supportType?: string;
  supportDescription?: string;

  reason?: string;
  severity?: string;

  assignedReviewer?: string;
  assignedReviewerRole?: RehabActorRole;

  resolutionSummary?: string;
}
