import {
  Injectable,
} from '@nestjs/common';

import { WarningReviewService } from '../warning-reviews/warning-review.service';

import {
  CareActionBridgeDecision,
  CareActionBridgeInput,
} from './care-action-bridge.types';

@Injectable()
export class CareActionBridgeService {

  constructor(
    private readonly warningReviews:
      WarningReviewService,
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
}
