import {
  Injectable,
} from '@nestjs/common';

import { ResidentService } from '../residents/resident.service';

import { WarningReviewRepository } from './warning-review.repository';

import {
  CreateWarningReviewInput,
  WarningReview,
} from './warning-review.types';

import {
  requireDecision,
  requireText,
} from './warning-review.validation';

@Injectable()
export class WarningReviewService {

  constructor(
    private readonly repository:
      WarningReviewRepository,

    private readonly residents:
      ResidentService,
  ) {}


  async review(
    input:
      CreateWarningReviewInput,
  ): Promise<WarningReview> {

    const warningId =
      requireText(
        input.warningId,
        'warningId',
      );

    const residentId =
      requireText(
        input.residentId,
        'residentId',
      );

    const patternId =
      requireText(
        input.patternId,
        'patternId',
      );


    const reviewerId =
      requireText(
        input.reviewerId,
        'reviewerId',
      );

    const reviewerRole =
      requireText(
        input.reviewerRole,
        'reviewerRole',
      );

    const decision =
      requireDecision(
        input.decision,
      );

    await this.residents
      .getById(residentId);

    const existing =
      await this.repository
        .findByWarningId(
          warningId,
        );

    if (existing) {
      throw new Error(
        'Warning has already been reviewed.',
      );
    }

    return this.repository.insert({
      warningId,
      residentId,
      patternId,
      decision,
      reviewerId,
      reviewerRole,
      careNote:
        input.careNote
          ? String(input.careNote).trim()
          : null,
    });
  }


  async get(
    warningId: string,
  ): Promise<WarningReview | null> {

    return this.repository
      .findByWarningId(
        requireText(
          warningId,
          'warningId',
        ),
      );
  }
}
