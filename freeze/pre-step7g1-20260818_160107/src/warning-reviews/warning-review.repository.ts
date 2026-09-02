import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import {
  CreateWarningReviewInput,
  WarningReview,
  WarningReviewDecision,
} from './warning-review.types';

interface WarningReviewRow {
  review_id: string;
  warning_id: string;
  resident_id: string;
  decision: WarningReviewDecision;
  reviewer_id: string;
  reviewer_role: string;
  care_note: string | null;
  reviewed_at: string | Date;
}

@Injectable()
export class WarningReviewRepository {

  constructor(
    private readonly db:
      DatabaseService,
  ) {}


  async findByWarningId(
    warningId: string,
  ): Promise<WarningReview | null> {

    return this.db.withTransaction(
      async (client) => {

        const result =
          await client.query<WarningReviewRow>(
            `
            SELECT
              review_id,
              warning_id,
              resident_id,
              decision,
              reviewer_id,
              reviewer_role,
              care_note,
              reviewed_at
            FROM warning_reviews
            WHERE warning_id = $1
            LIMIT 1
            `,
            [warningId],
          );

        if (!result.rows.length) {
          return null;
        }

        return this.map(
          result.rows[0],
        );
      },
    );
  }


  async insert(
    input: CreateWarningReviewInput,
  ): Promise<WarningReview> {

    return this.db.withTransaction(
      async (client) => {

        const result =
          await client.query<WarningReviewRow>(
            `
            INSERT INTO warning_reviews (
              warning_id,
              resident_id,
              decision,
              reviewer_id,
              reviewer_role,
              care_note
            )
            VALUES (
              $1,$2,$3,$4,$5,$6
            )
            RETURNING
              review_id,
              warning_id,
              resident_id,
              decision,
              reviewer_id,
              reviewer_role,
              care_note,
              reviewed_at
            `,
            [
              input.warningId,
              input.residentId,
              input.decision,
              input.reviewerId,
              input.reviewerRole,
              input.careNote ?? null,
            ],
          );

        return this.map(
          result.rows[0],
        );
      },
    );
  }


  private map(
    row: WarningReviewRow,
  ): WarningReview {

    return {
      reviewId:
        row.review_id,

      warningId:
        row.warning_id,

      residentId:
        row.resident_id,

      decision:
        row.decision,

      reviewerId:
        row.reviewer_id,

      reviewerRole:
        row.reviewer_role,

      careNote:
        row.care_note,

      reviewedAt:
        new Date(row.reviewed_at),
    };
  }
}
