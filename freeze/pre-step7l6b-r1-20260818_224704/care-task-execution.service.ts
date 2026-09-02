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
  CareTaskAuthorizationService,
} from '../care-task-authorization/care-task-authorization.service';

import {
  CareTaskAction,
} from '../care-task-authorization/care-task-authorization.types';

import {
  CareTaskExecutionInput,
} from './care-task-execution.types';


function required(
  value:
    string | null | undefined,

  field:
    string,
):
  string {

  const normalized =
    String(
      value ?? '',
    ).trim();

  if (!normalized) {
    throw new Error(
      `${field} is required.`,
    );
  }

  return normalized;
}


@Injectable()
export class CareTaskExecutionService {

  constructor(
    private readonly db:
      DatabaseService,

    private readonly authorization:
      CareTaskAuthorizationService,
  ) {}


  async execute(
    careTaskId:
      string,

    action:
      string,

    input:
      CareTaskExecutionInput,
  ) {

    const normalizedTaskId =
      required(
        careTaskId,
        'careTaskId',
      );

    const normalizedAction =
      required(
        action,
        'action',
      )
        .toUpperCase()
        as CareTaskAction;

    const actorId =
      required(
        input.actorId,
        'actorId',
      );

    const actorRole =
      required(
        input.actorRole,
        'actorRole',
      )
        .toUpperCase();


    return this.db.withTransaction(
      async client => {

        /*
         * Canonical mutation order:
         *
         * SELECT FOR UPDATE
         * -> NOT FOUND
         * -> AUTHORIZATION
         * -> UPDATE
         * -> AUDIT
         */

        const selected =
          await client.query(
            `
            SELECT
              care_task_id,
              care_plan_id,
              resident_id,
              task_code,
              title,
              status,
              priority,
              scheduled_at,
              due_at,
              assigned_to,
              assigned_role,
              assigned_at,
              accepted_at,
              started_at,
              completed_at,
              missed_at,
              skipped_at,
              cancelled_at,
              completion_note,
              exception_reason,
              created_at,
              updated_at
            FROM care_tasks
            WHERE care_task_id = $1
            FOR UPDATE
            `,
            [
              normalizedTaskId,
            ],
          );


        if (
          selected.rowCount !== 1
        ) {
          throw new Error(
            'Care Task not found.',
          );
        }


        const task =
          selected.rows[0];


        /*
         * Human assignee boundary.
         *
         * AI/SYSTEM may never become the
         * accountable task owner.
         */

        let assigneeId =
          input.assigneeId
            ? String(
                input.assigneeId,
              ).trim()
            : null;

        let assigneeRole =
          input.assigneeRole
            ? String(
                input.assigneeRole,
              )
                .trim()
                .toUpperCase()
            : null;


        if (
          normalizedAction ===
          'ASSIGN'
        ) {

          if (
            assigneeRole === 'AI' ||
            assigneeRole === 'SYSTEM'
          ) {
            throw new Error(
              'Care Task must be assigned to a human owner.',
            );
          }
        }


        const decision =
          this.authorization
            .authorize({
              action:
                normalizedAction,

              status:
                task.status,

              assignedTo:
                task.assigned_to,

              assignedRole:
                task.assigned_role,

              acceptedAt:
                task.accepted_at,

              actorId,

              actorRole,

              assigneeId,

              assigneeRole,

              completionNote:
                input.completionNote,

              exceptionReason:
                input.exceptionReason,
            });


        const previousState = {
          status:
            task.status,

          assignedTo:
            task.assigned_to,

          assignedRole:
            task.assigned_role,

          assignedAt:
            task.assigned_at,

          acceptedAt:
            task.accepted_at,

          startedAt:
            task.started_at,

          completedAt:
            task.completed_at,

          missedAt:
            task.missed_at,

          skippedAt:
            task.skipped_at,

          cancelledAt:
            task.cancelled_at,

          completionNote:
            task.completion_note,

          exceptionReason:
            task.exception_reason,
        };


        const now =
          new Date();


        let updateSql:
          string;

        let updateParams:
          unknown[];


        switch (
          normalizedAction
        ) {

          case 'ASSIGN':

            updateSql = `
              UPDATE care_tasks
              SET
                status = 'ASSIGNED',
                assigned_to = $2,
                assigned_role = $3,
                assigned_at = $4,
                accepted_at = NULL,
                updated_at = $4
              WHERE care_task_id = $1
              RETURNING *
            `;

            updateParams = [
              normalizedTaskId,
              assigneeId,
              assigneeRole,
              now,
            ];

            break;


          case 'ACCEPT':

            updateSql = `
              UPDATE care_tasks
              SET
                accepted_at = $2,
                updated_at = $2
              WHERE care_task_id = $1
              RETURNING *
            `;

            updateParams = [
              normalizedTaskId,
              now,
            ];

            break;


          case 'START':

            updateSql = `
              UPDATE care_tasks
              SET
                status = 'IN_PROGRESS',
                started_at = $2,
                updated_at = $2
              WHERE care_task_id = $1
              RETURNING *
            `;

            updateParams = [
              normalizedTaskId,
              now,
            ];

            break;


          case 'COMPLETE': {

            const completionNote =
              required(
                input.completionNote,
                'completionNote',
              );

            updateSql = `
              UPDATE care_tasks
              SET
                status = 'COMPLETED',
                completed_at = $2,
                completion_note = $3,
                updated_at = $2
              WHERE care_task_id = $1
              RETURNING *
            `;

            updateParams = [
              normalizedTaskId,
              now,
              completionNote,
            ];

            break;
          }


          case 'MARK_MISSED': {

            const reason =
              required(
                input.exceptionReason,
                'exceptionReason',
              );

            updateSql = `
              UPDATE care_tasks
              SET
                status = 'MISSED',
                missed_at = $2,
                exception_reason = $3,
                updated_at = $2
              WHERE care_task_id = $1
              RETURNING *
            `;

            updateParams = [
              normalizedTaskId,
              now,
              reason,
            ];

            break;
          }


          case 'SKIP': {

            const reason =
              required(
                input.exceptionReason,
                'exceptionReason',
              );

            updateSql = `
              UPDATE care_tasks
              SET
                status = 'SKIPPED',
                skipped_at = $2,
                exception_reason = $3,
                updated_at = $2
              WHERE care_task_id = $1
              RETURNING *
            `;

            updateParams = [
              normalizedTaskId,
              now,
              reason,
            ];

            break;
          }


          case 'CANCEL': {

            const reason =
              required(
                input.exceptionReason,
                'exceptionReason',
              );

            updateSql = `
              UPDATE care_tasks
              SET
                status = 'CANCELLED',
                cancelled_at = $2,
                exception_reason = $3,
                updated_at = $2
              WHERE care_task_id = $1
              RETURNING *
            `;

            updateParams = [
              normalizedTaskId,
              now,
              reason,
            ];

            break;
          }


          default:
            throw new Error(
              'Unsupported Care Task action.',
            );
        }


        const changed =
          await client.query(
            updateSql,
            updateParams,
          );


        if (
          changed.rowCount !== 1
        ) {
          throw new Error(
            'Care Task mutation failed.',
          );
        }


        const updated =
          changed.rows[0];


        const sequenceResult =
          await client.query(
            `
            SELECT
              COALESCE(
                MAX(event_sequence),
                0
              ) + 1 AS next_sequence
            FROM care_task_audit
            WHERE care_task_id = $1
            `,
            [
              normalizedTaskId,
            ],
          );


        const nextSequence =
          Number(
            sequenceResult
              .rows[0]
              .next_sequence,
          );


        const newState = {
          status:
            updated.status,

          assignedTo:
            updated.assigned_to,

          assignedRole:
            updated.assigned_role,

          assignedAt:
            updated.assigned_at,

          acceptedAt:
            updated.accepted_at,

          startedAt:
            updated.started_at,

          completedAt:
            updated.completed_at,

          missedAt:
            updated.missed_at,

          skippedAt:
            updated.skipped_at,

          cancelledAt:
            updated.cancelled_at,

          completionNote:
            updated.completion_note,

          exceptionReason:
            updated.exception_reason,
        };


        await client.query(
          `
          INSERT INTO care_task_audit (
            audit_id,
            event_sequence,
            care_task_id,
            care_plan_id,
            resident_id,
            event_type,
            actor_id,
            actor_role,
            previous_state,
            new_state
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9::jsonb,
            $10::jsonb
          )
          `,
          [
            randomUUID(),

            nextSequence,

            updated.care_task_id,
            updated.care_plan_id,
            updated.resident_id,

            decision.auditEvent,

            actorId,
            decision.actorRole,

            JSON.stringify(
              previousState,
            ),

            JSON.stringify(
              newState,
            ),
          ],
        );


        return {
          careTaskId:
            updated.care_task_id,

          carePlanId:
            updated.care_plan_id,

          residentId:
            updated.resident_id,

          status:
            updated.status,

          assignedTo:
            updated.assigned_to,

          assignedRole:
            updated.assigned_role,

          assignedAt:
            updated.assigned_at,

          acceptedAt:
            updated.accepted_at,

          startedAt:
            updated.started_at,

          completedAt:
            updated.completed_at,

          missedAt:
            updated.missed_at,

          skippedAt:
            updated.skipped_at,

          cancelledAt:
            updated.cancelled_at,

          completionNote:
            updated.completion_note,

          exceptionReason:
            updated.exception_reason,

          action:
            decision.action,

          auditEvent:
            decision.auditEvent,

          actorId:
            decision.actorId,

          actorRole:
            decision.actorRole,

          autonomousClinicalAction:
            false,
        };
      },
    );
  }
}
