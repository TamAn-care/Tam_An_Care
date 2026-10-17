import {
  Injectable,
} from '@nestjs/common';

import { WarningReviewService } from '../warning-reviews/warning-review.service';

import { CareActionService } from '../care-actions/care-action.service';

import {
  CareActionBridgeDecision,
  CareActionBridgeExecutionResult,
  CareActionBridgeInput,
} from './care-action-bridge.types';

@Injectable()
export class CareActionBridgeService {

  constructor(
    private readonly warningReviews:
      WarningReviewService,

    private readonly careActions:
      CareActionService,
  ) {}


  async evaluate(
    input:
      CareActionBridgeInput,
  ): Promise<CareActionBridgeDecision> {

    const warningId =
      String(
        input.warningId ?? '',
      ).trim();

    const actorId =
      String(
        input.actorId ?? '',
      ).trim();

    const actorRole =
      String(
        input.actorRole ?? '',
      ).trim();

    if (!warningId) {
      throw new Error(
        'warningId is required.',
      );
    }

    if (!actorId) {
      throw new Error(
        'actorId is required.',
      );
    }

    if (!actorRole) {
      throw new Error(
        'actorRole is required.',
      );
    }

    const review =
      await this.warningReviews
        .get(warningId);

    if (!review) {
      throw new Error(
        'Warning review not found.',
      );
    }

    if (
      review.decision !==
        'CREATE_CARE_ACTION'
    ) {
      throw new Error(
        'Warning review is not approved for Care Action creation.',
      );
    }

    return {
      eligible:
        true,

      warningId:
        review.warningId,

      residentId:
        review.residentId,

      patternId:
        review.patternId,

      decision:
        'CREATE_CARE_ACTION',

      actorId,
      actorRole,

      reviewId:
        review.reviewId,

      reason:
        'HUMAN_REVIEW_APPROVED',
    };
  }


  async execute(
    input:
      CareActionBridgeInput,
  ): Promise<CareActionBridgeExecutionResult> {

    const approval =
      await this.evaluate(input);

    const existing =
      await this.careActions.get(
        approval.residentId,
        approval.patternId,
      );

    if (existing) {
      throw new Error(
        'Care Action already exists for this reviewed warning pattern.',
      );
    }

    const action =
      await this.careActions
        .getOrCreate(
          approval.residentId,
          approval.patternId,
        );

    if (
      action.assignedTo !== null ||
      action.assignedRole !== null
    ) {
      throw new Error(
        'Bridge-created Care Action must remain unassigned.',
      );
    }

    return {
      reviewId:
        approval.reviewId,

      warningId:
        approval.warningId,

      residentId:
        approval.residentId,

      patternId:
        approval.patternId,

      actorId:
        approval.actorId,

      actorRole:
        approval.actorRole,

      careActionId:
        action.id,

      careActionStatus:
        action.status,

      assignedTo:
        action.assignedTo,

      assignedRole:
        action.assignedRole,

      bridgeStatus:
        'CARE_ACTION_CREATED',

      autonomousClinicalAction:
        false,
    };
  }
}
