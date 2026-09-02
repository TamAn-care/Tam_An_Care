import {
  Injectable,
} from '@nestjs/common';

import {
  randomUUID,
} from 'crypto';

import {
  DatabaseService,
} from '../database/database.service';

import {
  ClinicalAuthorizationService,
} from './clinical-authorization.service';

import {
  ClinicalRepository,
} from './clinical.repository';

import {
  ClinicalAction,
  ClinicalMutationInput,
  ClinicalMutationResult,
} from './clinical.types';

@Injectable()
export class ClinicalService {

  constructor(
    private readonly db:
      DatabaseService,

    private readonly repository:
      ClinicalRepository,

    private readonly authorization:
      ClinicalAuthorizationService,
  ) {}


  async mutate(
    aggregateType: string,
    aggregateId: string,
    action: ClinicalAction,
    input: ClinicalMutationInput,
  ): Promise<ClinicalMutationResult> {

    const id =
      String(
        aggregateId ?? '',
      ).trim();

    const actorId =
      String(
        input.actorId ?? '',
      ).trim();

    const actorRole =
      String(
        input.actorRole ?? '',
      )
        .trim()
        .toUpperCase();

    if (!id) {
      throw new Error(
        'aggregateId is required.',
      );
    }

    return this.db.withTransaction(
      async client => {

        let current: any;
        let aggregateColumn = '';
        let normalizedType = '';
        let eventType = '';

        if (
          aggregateType ===
          'observation'
        ) {
          current =
            await this.repository
              .findObservationForUpdate(
                client,
                id,
              );

          aggregateColumn =
            'clinical_observation_id';

          normalizedType =
            'CLINICAL_OBSERVATION';
        }

        if (
          aggregateType ===
          'nursing-note'
        ) {
          current =
            await this.repository
              .findNursingNoteForUpdate(
                client,
                id,
              );

          aggregateColumn =
            'nursing_note_id';

          normalizedType =
            'NURSING_NOTE';
        }

        if (
          aggregateType ===
          'finding'
        ) {
          current =
            await this.repository
              .findFindingForUpdate(
                client,
                id,
              );

          aggregateColumn =
            'abnormal_finding_id';

          normalizedType =
            'ABNORMAL_FINDING';
        }

        if (
          aggregateType ===
          'escalation'
        ) {
          current =
            await this.repository
              .findEscalationForUpdate(
                client,
                id,
              );

          aggregateColumn =
            'clinical_escalation_id';

          normalizedType =
            'CLINICAL_ESCALATION';
        }

        if (!current) {
          throw new Error(
            'Clinical aggregate not found.',
          );
        }

        this.authorization.authorize(
          action,
          current,
          input,
        );

        const previousState = {
          ...current,
        };

        let updated: any =
          current;


        if (
          action ===
          'VERIFY_OBSERVATION'
        ) {
          const result =
            await client.query(
              `
              UPDATE clinical_observations
              SET
                status='VERIFIED',
                verified_by=$2,
                verified_by_role=$3,
                verified_at=now(),
                updated_at=now()
              WHERE clinical_observation_id=$1
              RETURNING *
              `,
              [
                id,
                actorId,
                actorRole,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'OBSERVATION_VERIFIED';
        }


        if (
          action ===
          'AMEND_OBSERVATION'
        ) {

          await client.query(
            `
            INSERT INTO clinical_observation_amendments (
              amendment_id,
              clinical_observation_id,
              resident_id,
              amendment_reason,
              previous_value,
              corrected_value,
              amended_by,
              amended_by_role
            )
            VALUES (
              $1,$2,$3,$4,
              $5::jsonb,$6::jsonb,
              $7,$8
            )
            `,
            [
              randomUUID(),
              id,
              current.resident_id,
              String(
                input.reason,
              ).trim(),
              JSON.stringify({
                numericValue:
                  current.numeric_value,
                textValue:
                  current.text_value,
                unit:
                  current.unit,
              }),
              JSON.stringify(
                input.correctedValue,
              ),
              actorId,
              actorRole,
            ],
          );

          const result =
            await client.query(
              `
              UPDATE clinical_observations
              SET
                status='AMENDED',
                updated_at=now()
              WHERE clinical_observation_id=$1
              RETURNING *
              `,
              [id],
            );

          updated =
            result.rows[0];

          eventType =
            'OBSERVATION_AMENDED';
        }


        if (
          action ===
          'VOID_OBSERVATION'
        ) {

          const result =
            await client.query(
              `
              UPDATE clinical_observations
              SET
                status='VOIDED',
                updated_at=now()
              WHERE clinical_observation_id=$1
              RETURNING *
              `,
              [id],
            );

          updated =
            result.rows[0];

          eventType =
            'OBSERVATION_VOIDED';
        }


        if (
          action ===
          'SIGN_NURSING_NOTE'
        ) {

          const result =
            await client.query(
              `
              UPDATE nursing_notes
              SET
                status='SIGNED',
                signed_by=$2,
                signed_by_role=$3,
                signed_at=now(),
                updated_at=now()
              WHERE nursing_note_id=$1
              RETURNING *
              `,
              [
                id,
                actorId,
                actorRole,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'NURSING_NOTE_SIGNED';
        }


        if (
          action ===
          'ACKNOWLEDGE_FINDING'
        ) {

          const result =
            await client.query(
              `
              UPDATE abnormal_findings
              SET
                status='ACKNOWLEDGED',
                acknowledged_by=$2,
                acknowledged_by_role=$3,
                acknowledged_at=now(),
                updated_at=now()
              WHERE abnormal_finding_id=$1
              RETURNING *
              `,
              [
                id,
                actorId,
                actorRole,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'ABNORMAL_FINDING_ACKNOWLEDGED';
        }


        if (
          action ===
          'START_FINDING_REVIEW'
        ) {

          const result =
            await client.query(
              `
              UPDATE abnormal_findings
              SET
                status='UNDER_REVIEW',
                reviewed_by=$2,
                reviewed_by_role=$3,
                reviewed_at=now(),
                updated_at=now()
              WHERE abnormal_finding_id=$1
              RETURNING *
              `,
              [
                id,
                actorId,
                actorRole,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'ABNORMAL_FINDING_REVIEW_STARTED';
        }


        if (
          action ===
          'ESCALATE_FINDING'
        ) {

          const result =
            await client.query(
              `
              UPDATE abnormal_findings
              SET
                status='ESCALATED',
                review_outcome=$2,
                updated_at=now()
              WHERE abnormal_finding_id=$1
              RETURNING *
              `,
              [
                id,
                String(
                  input.reason,
                ).trim(),
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'ABNORMAL_FINDING_ESCALATED';
        }


        if (
          action ===
          'CLOSE_FINDING'
        ) {

          const result =
            await client.query(
              `
              UPDATE abnormal_findings
              SET
                status='CLOSED',
                review_outcome=$2,
                closed_by=$3,
                closed_by_role=$4,
                closed_at=now(),
                updated_at=now()
              WHERE abnormal_finding_id=$1
              RETURNING *
              `,
              [
                id,
                String(
                  input.reviewOutcome,
                ).trim(),
                actorId,
                actorRole,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'ABNORMAL_FINDING_CLOSED';
        }


        if (
          action ===
          'ASSIGN_ESCALATION'
        ) {

          const result =
            await client.query(
              `
              UPDATE clinical_escalations
              SET
                status='ASSIGNED',
                assigned_reviewer=$2,
                assigned_reviewer_role=$3,
                assigned_at=now(),
                updated_at=now()
              WHERE clinical_escalation_id=$1
              RETURNING *
              `,
              [
                id,
                String(
                  input.assignedReviewer,
                ).trim(),
                String(
                  input.assignedReviewerRole,
                )
                  .trim()
                  .toUpperCase(),
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'CLINICAL_ESCALATION_ASSIGNED';
        }


        if (
          action ===
          'ACCEPT_ESCALATION'
        ) {

          const result =
            await client.query(
              `
              UPDATE clinical_escalations
              SET
                status='ACCEPTED',
                accepted_at=now(),
                updated_at=now()
              WHERE clinical_escalation_id=$1
              RETURNING *
              `,
              [id],
            );

          updated =
            result.rows[0];

          eventType =
            'CLINICAL_ESCALATION_ACCEPTED';
        }


        if (
          action ===
          'RESOLVE_ESCALATION'
        ) {

          const result =
            await client.query(
              `
              UPDATE clinical_escalations
              SET
                status='RESOLVED',
                resolution_summary=$2,
                resolved_by=$3,
                resolved_by_role=$4,
                resolved_at=now(),
                updated_at=now()
              WHERE clinical_escalation_id=$1
              RETURNING *
              `,
              [
                id,
                String(
                  input.resolutionSummary,
                ).trim(),
                actorId,
                actorRole,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'CLINICAL_ESCALATION_RESOLVED';
        }


        if (
          action ===
          'CANCEL_ESCALATION'
        ) {

          const result =
            await client.query(
              `
              UPDATE clinical_escalations
              SET
                status='CANCELLED',
                resolution_summary=$2,
                resolved_by=$3,
                resolved_by_role=$4,
                resolved_at=now(),
                updated_at=now()
              WHERE clinical_escalation_id=$1
              RETURNING *
              `,
              [
                id,
                String(
                  input.reason,
                ).trim(),
                actorId,
                actorRole,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'CLINICAL_ESCALATION_CANCELLED';
        }


        if (
          action ===
          'LINK_CARE_ACTION'
        ) {

          const careActionId =
            String(
              input.linkedCareActionId,
            ).trim();

          const exists =
            await client.query(
              `
              SELECT id
              FROM care_actions
              WHERE id::text=$1
              `,
              [careActionId],
            );

          if (
            exists.rowCount !== 1
          ) {
            throw new Error(
              'Care Action not found for explicit linkage.',
            );
          }

          const result =
            await client.query(
              `
              UPDATE clinical_escalations
              SET
                linked_care_action_id=$2,
                updated_at=now()
              WHERE clinical_escalation_id=$1
              RETURNING *
              `,
              [
                id,
                careActionId,
              ],
            );

          updated =
            result.rows[0];

          eventType =
            'CARE_ACTION_LINKED';
        }


        await this.repository
          .insertAudit(
            client,
            {
              residentId:
                current.resident_id,

              aggregateColumn,
              aggregateId:
                id,

              eventType,

              actorId,
              actorRole,

              previousState,
              newState:
                updated,
            },
          );


        return {
          aggregateId:
            id,

          aggregateType:
            normalizedType,

          status:
            updated.status,

          action,
          auditEvent:
            eventType,

          actorId,
          actorRole,

          autonomousClinicalAction:
            false,
        };
      },
    );
  }
}
