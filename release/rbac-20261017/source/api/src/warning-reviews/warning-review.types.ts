export type WarningReviewDecision =
  | 'NO_ACTION_REQUIRED'
  | 'MONITOR'
  | 'CREATE_CARE_ACTION'
  | 'ESCALATE';

export interface WarningReview {
  reviewId: string;
  warningId: string;
  residentId: string;
  patternId: string;

  decision:
    WarningReviewDecision;

  reviewerId: string;
  reviewerRole: string;

  careNote: string | null;

  reviewedAt: Date;
}

export interface CreateWarningReviewInput {
  warningId: string;
  residentId: string;
  patternId: string;

  decision:
    WarningReviewDecision;

  reviewerId: string;
  reviewerRole: string;

  careNote?: string | null;
}
