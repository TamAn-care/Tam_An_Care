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
  IncidentAuthorizationService,
} from './incident-authorization.service';

import {
  IncidentAction,
  IncidentMutationInput,
  ReportIncidentInput,
} from './incident.types';


@Injectable()
export class IncidentService {

  constructor(
    private readonly db:
      DatabaseService,

    private readonly authorization:
      IncidentAuthorizationService,
  ) {}


  private requireText(
    value: unknown,
    name: string,
  ): string {

    const normalized =
      String(
        value ?? '',
      ).trim();

    if (!normalized) {
      throw new Error(
        `${name} is required.`,
      );
    }

    return normalized;
  }


  private async insertAudit(
    client: any,
    incidentId: string,
    residentId: string | null,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    actorId: string | null,
    actorRole: string | null,
    previousState: unknown,
    newState: unknown,
  ): Promise<void> {

    const sequenceResult =
      await client.query(
        `
        SELECT
          COALESCE(
            MAX(event_sequence),
            0
          ) + 1 AS next_sequence
        FROM incident_audit
        WHERE incident_id=$1
          AND aggregate_type=$2
          AND aggregate_id=$3
        `,
        [
          incidentId,
          aggregateType,
          aggregateId,
        ],
      );

    const nextSequence =
      Number(
        sequenceResult.rows[0]
          .next_sequence,
      );

    await client.query(
      `
      INSERT INTO incident_audit (
        audit_id,
        event_sequence,
        incident_id,
        resident_id,
        aggregate_type,
        aggregate_id,
        event_type,
        actor_id,
        actor_role,
        previous_state,
        new_state
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      `,
      [
        randomUUID(),
        nextSequence,
        incidentId,
        residentId,
        aggregateType,
        aggregateId,
        eventType,
        actorId,
        actorRole,
        previousState === null
          ? null
          : JSON.stringify(
              previousState,
            ),
        newState === null
          ? null
          : JSON.stringify(
              newState,
            ),
      ],
    );
  }


  async report(
    input: ReportIncidentInput,
  ): Promise<any> {

    const actor =
      this.authorization
        .requireHuman(
          input.actorId,
          input.actorRole,
        );

    const incidentCode =
      this.requireText(
        input.incidentCode,
        'incidentCode',
      );

    const incidentType =
      this.requireText(
        input.incidentType,
        'incidentType',
      ).toUpperCase();

    const title =
      this.requireText(
        input.title,
        'title',
      );

    const description =
      this.requireText(
        input.description,
        'description',
      );

    const residentId =
      input.residentId
        ? String(
            input.residentId,
          ).trim()
        : null;

    return this.db.withTransaction(
      async client => {

        if (residentId) {

          const resident =
            await client.query(
              `
              SELECT resident_id
              FROM residents
              WHERE resident_id=$1
              `,
              [
                residentId,
              ],
            );

          if (
            resident.rowCount !== 1
          ) {
            throw new Error(
              'Resident not found for Incident.',
            );
          }
        }

        const incidentId =
          randomUUID();

        const created =
          await client.query(
            `
            INSERT INTO incidents (
              incident_id,
              resident_id,
              incident_code,
              incident_type,
              title,
              description,
              occurred_at,
              discovered_at,
              location,
              status,
              reported_by,
              reported_by_role,
              reported_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,now(),$8,
              'REPORTED',$9,$10,now()
            )
            RETURNING *
            `,
            [
              incidentId,
              residentId,
              incidentCode,
              incidentType,
              title,
              description,
              input.occurredAt
                ? new Date(
                    input.occurredAt,
                  )
                : null,
              input.location
                ? String(
                    input.location,
                  ).trim()
                : null,
              actor.actorId,
              actor.actorRole,
            ],
          );

        const row =
          created.rows[0];

        await this.insertAudit(
          client,
          incidentId,
          residentId,
          'INCIDENT',
          incidentId,
          'INCIDENT_REPORTED',
          actor.actorId,
          actor.actorRole,
          null,
          {
            status:
              row.status,
            incidentType:
              row.incident_type,
          },
        );

        return {
          incidentId:
            row.incident_id,

          incidentCode:
            row.incident_code,

          residentId:
            row.resident_id,

          incidentType:
            row.incident_type,

          status:
            row.status,

          autonomousClinicalAction:
            false,
        };
      },
    );
  }


  async mutate(
    incidentIdRaw: string,
    actionRaw: string,
    input: IncidentMutationInput,
  ): Promise<any> {

    const incidentId =
      this.requireText(
        incidentIdRaw,
        'incidentId',
      );

    const action =
      this.requireText(
        actionRaw,
        'action',
      ).toUpperCase() as IncidentAction;

    const actor =
      this.authorization
        .authorize(
          action,
          input.actorId,
          input.actorRole,
        );

    return this.db.withTransaction(
      async client => {

        /*
         * Canonical safety order:
         *
         * SELECT FOR UPDATE
         * -> NOT FOUND
         * -> AUTHORIZATION already resolved above
         * -> TRANSITION VALIDATION
         * -> MUTATION
         * -> AUDIT
         * -> COMMIT
         */

        const found =
          await client.query(
            `
            SELECT *
            FROM incidents
            WHERE incident_id=$1
            FOR UPDATE
            `,
            [
              incidentId,
            ],
          );

        if (
          found.rowCount !== 1
        ) {
          throw new Error(
            'Incident not found.',
          );
        }

        const incident =
          found.rows[0];

        const previousState = {
          status:
            incident.status,

          severity:
            incident.current_severity,

          assignedTo:
            incident.assigned_to,

          assignedRole:
            incident.assigned_role,

          acknowledgedAt:
            incident.acknowledged_at,

          responseStartedAt:
            incident.response_started_at,

          resolvedAt:
            incident.resolved_at,

          closedAt:
            incident.closed_at,
        };


        if (
          action === 'TRIAGE'
        ) {

          if (
            incident.status !==
            'REPORTED'
          ) {
            throw new Error(
              'Only a REPORTED Incident can receive initial triage.',
            );
          }

          const severity =
            this.requireText(
              input.severity,
              'severity',
            ).toUpperCase();

          const summary =
            this.requireText(
              input.summary,
              'summary',
            );

          const seq =
            await client.query(
              `
              SELECT
                COALESCE(
                  MAX(triage_sequence),
                  0
                ) + 1 AS n
              FROM incident_triage
              WHERE incident_id=$1
              `,
              [
                incidentId,
              ],
            );

          await client.query(
            `
            INSERT INTO incident_triage (
              incident_triage_id,
              incident_id,
              resident_id,
              triage_sequence,
              severity,
              triage_summary,
              triaged_by,
              triaged_by_role,
              triaged_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,now()
            )
            `,
            [
              randomUUID(),
              incidentId,
              incident.resident_id,
              Number(
                seq.rows[0].n,
              ),
              severity,
              summary,
              actor.actorId,
              actor.actorRole,
            ],
          );

          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                status='TRIAGED',
                current_severity=$2,
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
                severity,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            'INCIDENT_TRIAGED',
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              status:
                'TRIAGED',
              severity,
            },
          );

          return this.response(
            updated.rows[0],
            action,
            actor,
          );
        }


        if (
          action === 'ASSIGN'
        ) {

          if (
            incident.status !==
            'TRIAGED'
          ) {
            throw new Error(
              'Only a TRIAGED Incident can be assigned.',
            );
          }

          const assignedTo =
            this.requireText(
              input.assignedTo,
              'assignedTo',
            );

          const assignedRole =
            this.requireText(
              input.assignedRole,
              'assignedRole',
            ).toUpperCase();

          if (
            assignedRole === 'AI' ||
            assignedRole === 'SYSTEM'
          ) {
            throw new Error(
              'Incident assignee must be a human actor.',
            );
          }

          if (
            ![
              'CAREGIVER',
              'NURSE',
              'SUPERVISOR',
              'CARE_MANAGER',
            ].includes(
              assignedRole,
            )
          ) {
            throw new Error(
              'Incident assignee role must be an authorized human role.',
            );
          }

          const seq =
            await client.query(
              `
              SELECT
                COALESCE(
                  MAX(assignment_sequence),
                  0
                ) + 1 AS n
              FROM incident_assignments
              WHERE incident_id=$1
              `,
              [
                incidentId,
              ],
            );

          await client.query(
            `
            INSERT INTO incident_assignments (
              incident_assignment_id,
              incident_id,
              assignment_sequence,
              assigned_to,
              assigned_role,
              assigned_by,
              assigned_by_role,
              assigned_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,now()
            )
            `,
            [
              randomUUID(),
              incidentId,
              Number(
                seq.rows[0].n,
              ),
              assignedTo,
              assignedRole,
              actor.actorId,
              actor.actorRole,
            ],
          );

          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                status='ASSIGNED',
                assigned_to=$2,
                assigned_role=$3,
                assigned_at=now(),
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
                assignedTo,
                assignedRole,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            'INCIDENT_ASSIGNED',
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              status:
                'ASSIGNED',
              assignedTo,
              assignedRole,
            },
          );

          return this.response(
            updated.rows[0],
            action,
            actor,
          );
        }


        if (
          action === 'ACKNOWLEDGE'
        ) {

          if (
            incident.status !==
            'ASSIGNED'
          ) {
            throw new Error(
              'Only an ASSIGNED Incident can be acknowledged.',
            );
          }

          if (
            incident.assigned_to !==
              actor.actorId ||
            String(
              incident.assigned_role ?? '',
            ).toUpperCase() !==
              actor.actorRole
          ) {
            throw new Error(
              'Only the assigned human owner can acknowledge this Incident.',
            );
          }

          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                status='ACKNOWLEDGED',
                acknowledged_at=now(),
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            'INCIDENT_ACKNOWLEDGED',
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              status:
                'ACKNOWLEDGED',
            },
          );

          return this.response(
            updated.rows[0],
            action,
            actor,
          );
        }


        if (
          action === 'START_RESPONSE'
        ) {

          if (
            incident.status !==
            'ACKNOWLEDGED'
          ) {
            throw new Error(
              'Only an ACKNOWLEDGED Incident can start response.',
            );
          }

          if (
            incident.assigned_to !==
              actor.actorId ||
            String(
              incident.assigned_role ?? '',
            ).toUpperCase() !==
              actor.actorRole
          ) {
            throw new Error(
              'Only the assigned human owner can start Incident response.',
            );
          }

          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                status='RESPONDING',
                response_started_at=now(),
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            'INCIDENT_RESPONSE_STARTED',
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              status:
                'RESPONDING',
            },
          );

          return this.response(
            updated.rows[0],
            action,
            actor,
          );
        }


        if (
          action === 'ADD_RESPONSE'
        ) {

          if (
            ![
              'RESPONDING',
              'ESCALATED',
            ].includes(
              incident.status,
            )
          ) {
            throw new Error(
              'Response documentation requires a RESPONDING or ESCALATED Incident.',
            );
          }

          const responseType =
            this.requireText(
              input.responseType,
              'responseType',
            );

          const responseNote =
            this.requireText(
              input.responseNote,
              'responseNote',
            );

          const seq =
            await client.query(
              `
              SELECT
                COALESCE(
                  MAX(response_sequence),
                  0
                ) + 1 AS n
              FROM incident_responses
              WHERE incident_id=$1
              `,
              [
                incidentId,
              ],
            );

          const responseId =
            randomUUID();

          await client.query(
            `
            INSERT INTO incident_responses (
              incident_response_id,
              incident_id,
              resident_id,
              response_sequence,
              response_type,
              response_note,
              performed_by,
              performed_by_role,
              performed_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,now()
            )
            `,
            [
              responseId,
              incidentId,
              incident.resident_id,
              Number(
                seq.rows[0].n,
              ),
              responseType,
              responseNote,
              actor.actorId,
              actor.actorRole,
            ],
          );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT_RESPONSE',
            responseId,
            'INCIDENT_RESPONSE_RECORDED',
            actor.actorId,
            actor.actorRole,
            null,
            {
              responseType,
              responseNote,
            },
          );

          return {
            incidentId,
            responseId,
            status:
              incident.status,
            action,
            actorId:
              actor.actorId,
            actorRole:
              actor.actorRole,
            autonomousClinicalAction:
              false,
          };
        }


        if (
          action === 'ESCALATE'
        ) {

          if (
            incident.status !==
            'RESPONDING'
          ) {
            throw new Error(
              'Only a RESPONDING Incident can be escalated.',
            );
          }

          const escalationType =
            this.requireText(
              input.escalationType,
              'escalationType',
            );

          const reason =
            this.requireText(
              input.reason,
              'reason',
            );

          const seq =
            await client.query(
              `
              SELECT
                COALESCE(
                  MAX(escalation_sequence),
                  0
                ) + 1 AS n
              FROM incident_escalations
              WHERE incident_id=$1
              `,
              [
                incidentId,
              ],
            );

          const escalationId =
            randomUUID();

          await client.query(
            `
            INSERT INTO incident_escalations (
              incident_escalation_id,
              incident_id,
              escalation_sequence,
              escalation_type,
              reason,
              status,
              escalated_by,
              escalated_by_role,
              escalated_at
            )
            VALUES (
              $1,$2,$3,$4,$5,
              'OPEN',$6,$7,now()
            )
            `,
            [
              escalationId,
              incidentId,
              Number(
                seq.rows[0].n,
              ),
              escalationType,
              reason,
              actor.actorId,
              actor.actorRole,
            ],
          );

          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                status='ESCALATED',
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            'INCIDENT_ESCALATED',
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              status:
                'ESCALATED',
              escalationId,
            },
          );

          return {
            ...this.response(
              updated.rows[0],
              action,
              actor,
            ),
            escalationId,
          };
        }


        if (
          action === 'ASSIGN_ESCALATION' ||
          action === 'ACCEPT_ESCALATION' ||
          action === 'RESOLVE_ESCALATION'
        ) {

          const escalationId =
            this.requireText(
              input.escalationId,
              'escalationId',
            );

          const escalationResult =
            await client.query(
              `
              SELECT *
              FROM incident_escalations
              WHERE incident_escalation_id=$1
                AND incident_id=$2
              FOR UPDATE
              `,
              [
                escalationId,
                incidentId,
              ],
            );

          if (
            escalationResult.rowCount !== 1
          ) {
            throw new Error(
              'Incident escalation not found.',
            );
          }

          const escalation =
            escalationResult.rows[0];


          if (
            action === 'ASSIGN_ESCALATION'
          ) {

            if (
              escalation.status !==
              'OPEN'
            ) {
              throw new Error(
                'Only an OPEN Incident escalation can be assigned.',
              );
            }

            const reviewer =
              this.requireText(
                input.assignedReviewer,
                'assignedReviewer',
              );

            const reviewerRole =
              this.requireText(
                input.assignedReviewerRole,
                'assignedReviewerRole',
              ).toUpperCase();

            if (
              ![
                'NURSE',
                'SUPERVISOR',
                'CARE_MANAGER',
              ].includes(
                reviewerRole,
              )
            ) {
              throw new Error(
                'Escalation reviewer must be an authorized human role.',
              );
            }

            await client.query(
              `
              UPDATE incident_escalations
              SET
                status='ASSIGNED',
                assigned_reviewer=$2,
                assigned_reviewer_role=$3,
                assigned_at=now(),
                updated_at=now()
              WHERE incident_escalation_id=$1
              `,
              [
                escalationId,
                reviewer,
                reviewerRole,
              ],
            );

            await this.insertAudit(
              client,
              incidentId,
              incident.resident_id,
              'INCIDENT_ESCALATION',
              escalationId,
              'INCIDENT_ESCALATION_ASSIGNED',
              actor.actorId,
              actor.actorRole,
              {
                status:
                  escalation.status,
              },
              {
                status:
                  'ASSIGNED',
                assignedReviewer:
                  reviewer,
                assignedReviewerRole:
                  reviewerRole,
              },
            );

            return {
              incidentId,
              escalationId,
              escalationStatus:
                'ASSIGNED',
              autonomousClinicalAction:
                false,
            };
          }


          if (
            action === 'ACCEPT_ESCALATION'
          ) {

            if (
              escalation.status !==
              'ASSIGNED'
            ) {
              throw new Error(
                'Only an ASSIGNED Incident escalation can be accepted.',
              );
            }

            if (
              escalation.assigned_reviewer !==
                actor.actorId ||
              String(
                escalation.assigned_reviewer_role ?? '',
              ).toUpperCase() !==
                actor.actorRole
            ) {
              throw new Error(
                'Only the assigned human reviewer can accept this escalation.',
              );
            }

            await client.query(
              `
              UPDATE incident_escalations
              SET
                status='ACCEPTED',
                accepted_at=now(),
                updated_at=now()
              WHERE incident_escalation_id=$1
              `,
              [
                escalationId,
              ],
            );

            await this.insertAudit(
              client,
              incidentId,
              incident.resident_id,
              'INCIDENT_ESCALATION',
              escalationId,
              'INCIDENT_ESCALATION_ACCEPTED',
              actor.actorId,
              actor.actorRole,
              {
                status:
                  escalation.status,
              },
              {
                status:
                  'ACCEPTED',
              },
            );

            return {
              incidentId,
              escalationId,
              escalationStatus:
                'ACCEPTED',
              autonomousClinicalAction:
                false,
            };
          }


          if (
            escalation.status !==
            'ACCEPTED'
          ) {
            throw new Error(
              'Only an ACCEPTED Incident escalation can be resolved.',
            );
          }

          const reviewerRole =
            String(
              escalation.assigned_reviewer_role ?? '',
            ).toUpperCase();

          const isAssignedReviewer =
            escalation.assigned_reviewer ===
              actor.actorId &&
            reviewerRole ===
              actor.actorRole;

          const isGovernanceOverride =
            [
              'SUPERVISOR',
              'CARE_MANAGER',
            ].includes(
              actor.actorRole,
            );

          if (
            !isAssignedReviewer &&
            !isGovernanceOverride
          ) {
            throw new Error(
              'Actor is not authorized to resolve this Incident escalation.',
            );
          }

          const summary =
            this.requireText(
              input.resolutionSummary,
              'resolutionSummary',
            );

          await client.query(
            `
            UPDATE incident_escalations
            SET
              status='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolved_at=now(),
              resolution_summary=$4,
              updated_at=now()
            WHERE incident_escalation_id=$1
            `,
            [
              escalationId,
              actor.actorId,
              actor.actorRole,
              summary,
            ],
          );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT_ESCALATION',
            escalationId,
            'INCIDENT_ESCALATION_RESOLVED',
            actor.actorId,
            actor.actorRole,
            {
              status:
                escalation.status,
            },
            {
              status:
                'RESOLVED',
            },
          );

          return {
            incidentId,
            escalationId,
            escalationStatus:
              'RESOLVED',
            autonomousClinicalAction:
              false,
          };
        }


        if (
          action === 'RESOLVE'
        ) {

          if (
            ![
              'RESPONDING',
              'ESCALATED',
            ].includes(
              incident.status,
            )
          ) {
            throw new Error(
              'Only a RESPONDING or ESCALATED Incident can be resolved.',
            );
          }

          const summary =
            this.requireText(
              input.resolutionSummary,
              'resolutionSummary',
            );

          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                status='RESOLVED',
                resolved_at=now(),
                resolution_summary=$2,
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
                summary,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            'INCIDENT_RESOLVED',
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              status:
                'RESOLVED',
            },
          );

          return this.response(
            updated.rows[0],
            action,
            actor,
          );
        }


        if (
          action === 'POST_REVIEW'
        ) {

          if (
            incident.status !==
            'RESOLVED'
          ) {
            throw new Error(
              'Post-incident review requires a RESOLVED Incident.',
            );
          }

          const reviewSummary =
            this.requireText(
              input.reviewSummary,
              'reviewSummary',
            );

          const seq =
            await client.query(
              `
              SELECT
                COALESCE(
                  MAX(review_sequence),
                  0
                ) + 1 AS n
              FROM incident_post_reviews
              WHERE incident_id=$1
              `,
              [
                incidentId,
              ],
            );

          const reviewId =
            randomUUID();

          await client.query(
            `
            INSERT INTO incident_post_reviews (
              incident_post_review_id,
              incident_id,
              review_sequence,
              review_summary,
              contributing_factors,
              preventive_actions,
              follow_up_required,
              reviewed_by,
              reviewed_by_role,
              reviewed_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,now()
            )
            `,
            [
              reviewId,
              incidentId,
              Number(
                seq.rows[0].n,
              ),
              reviewSummary,
              input.contributingFactors
                ? String(
                    input.contributingFactors,
                  )
                : null,
              input.preventiveActions
                ? String(
                    input.preventiveActions,
                  )
                : null,
              Boolean(
                input.followUpRequired,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT_POST_REVIEW',
            reviewId,
            'INCIDENT_POST_REVIEWED',
            actor.actorId,
            actor.actorRole,
            null,
            {
              reviewSummary,
            },
          );

          return {
            incidentId,
            postReviewId:
              reviewId,
            status:
              incident.status,
            autonomousClinicalAction:
              false,
          };
        }


        if (
          action === 'CLOSE'
        ) {

          if (
            incident.status !==
            'RESOLVED'
          ) {
            throw new Error(
              'Only a RESOLVED Incident can be closed.',
            );
          }

          if (
            [
              'HIGH',
              'CRITICAL',
            ].includes(
              String(
                incident.current_severity ?? '',
              ).toUpperCase(),
            )
          ) {

            const reviews =
              await client.query(
                `
                SELECT COUNT(*)::int AS count
                FROM incident_post_reviews
                WHERE incident_id=$1
                `,
                [
                  incidentId,
                ],
              );

            if (
              Number(
                reviews.rows[0].count,
              ) < 1
            ) {
              throw new Error(
                'Post-incident human review is required before closure.',
              );
            }
          }

          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                status='CLOSED',
                closed_at=now(),
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            'INCIDENT_CLOSED',
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              status:
                'CLOSED',
            },
          );

          return this.response(
            updated.rows[0],
            action,
            actor,
          );
        }


        if (
          [
            'LINK_CARE_ACTION',
            'LINK_CARE_TASK',
            'LINK_CLINICAL_OBSERVATION',
            'LINK_MEDICATION_RECORD',
          ].includes(
            action,
          )
        ) {

          const linkedId =
            this.requireText(
              input.linkedId,
              'linkedId',
            );

          let column = '';
          let eventType = '';


          if (
            action === 'LINK_CARE_ACTION'
          ) {

            const result =
              await client.query(
                `
                SELECT id
                FROM care_actions
                WHERE id::text=$1
                `,
                [
                  linkedId,
                ],
              );

            if (
              result.rowCount !== 1
            ) {
              throw new Error(
                'Care Action not found for explicit Incident linkage.',
              );
            }

            column =
              'linked_care_action_id';

            eventType =
              'INCIDENT_CARE_ACTION_LINKED';
          }


          if (
            action === 'LINK_CARE_TASK'
          ) {

            const result =
              await client.query(
                `
                SELECT care_task_id
                FROM care_tasks
                WHERE care_task_id=$1
                `,
                [
                  linkedId,
                ],
              );

            if (
              result.rowCount !== 1
            ) {
              throw new Error(
                'Care Task not found for explicit Incident linkage.',
              );
            }

            column =
              'linked_care_task_id';

            eventType =
              'INCIDENT_CARE_TASK_LINKED';
          }


          if (
            action === 'LINK_CLINICAL_OBSERVATION'
          ) {

            const result =
              await client.query(
                `
                SELECT clinical_observation_id
                FROM clinical_observations
                WHERE clinical_observation_id=$1
                `,
                [
                  linkedId,
                ],
              );

            if (
              result.rowCount !== 1
            ) {
              throw new Error(
                'Clinical Observation not found for explicit Incident linkage.',
              );
            }

            column =
              'linked_clinical_observation_id';

            eventType =
              'INCIDENT_CLINICAL_OBSERVATION_LINKED';
          }


          if (
            action === 'LINK_MEDICATION_RECORD'
          ) {

            const result =
              await client.query(
                `
                SELECT medication_administration_id
                FROM medication_administrations
                WHERE medication_administration_id=$1
                `,
                [
                  linkedId,
                ],
              );

            if (
              result.rowCount !== 1
            ) {
              throw new Error(
                'Medication Administration not found for explicit Incident linkage.',
              );
            }

            column =
              'linked_medication_administration_id';

            eventType =
              'INCIDENT_MEDICATION_RECORD_LINKED';
          }


          const updated =
            await client.query(
              `
              UPDATE incidents
              SET
                ${column}=$2,
                updated_at=now()
              WHERE incident_id=$1
              RETURNING *
              `,
              [
                incidentId,
                linkedId,
              ],
            );

          await this.insertAudit(
            client,
            incidentId,
            incident.resident_id,
            'INCIDENT',
            incidentId,
            eventType,
            actor.actorId,
            actor.actorRole,
            previousState,
            {
              action,
              linkedId,
            },
          );

          return this.response(
            updated.rows[0],
            action,
            actor,
          );
        }


        throw new Error(
          'Unsupported Incident action.',
        );
      },
    );
  }


  private response(
    row: any,
    action: IncidentAction,
    actor: {
      actorId: string;
      actorRole: string;
    },
  ): any {

    return {
      incidentId:
        row.incident_id,

      residentId:
        row.resident_id,

      status:
        row.status,

      currentSeverity:
        row.current_severity,

      assignedTo:
        row.assigned_to,

      assignedRole:
        row.assigned_role,

      acknowledgedAt:
        row.acknowledged_at,

      responseStartedAt:
        row.response_started_at,

      resolvedAt:
        row.resolved_at,

      closedAt:
        row.closed_at,

      action,

      actorId:
        actor.actorId,

      actorRole:
        actor.actorRole,

      autonomousClinicalAction:
        false,
    };
  }
}
