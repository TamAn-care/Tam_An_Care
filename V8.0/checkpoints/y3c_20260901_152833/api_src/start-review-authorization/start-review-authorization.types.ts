import {
  CareAction,
} from '../care-actions/care-action.types';

export interface StartReviewActor {
  actorId: string;
  actorRole: string;
}

export type StartReviewAuthorizationMode =
  | 'OWNER'
  | 'SUPERVISOR_OVERRIDE';

export interface StartReviewAuthorizationResult {
  authorized: true;

  mode:
    StartReviewAuthorizationMode;

  careActionId: string;

  residentId: string;

  patternId: string;

  ownerId: string;

  ownerRole: string;

  actorId: string;

  actorRole: string;

  ownershipChanged: false;

  transferRequired: false;

  auditEvent: 'REVIEW_STARTED';

  autonomousClinicalAction: false;
}

export interface StartReviewAuthorizationInput {
  action: CareAction;

  actorId: string;

  actorRole: string;
}
