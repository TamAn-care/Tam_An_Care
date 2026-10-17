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
  CareTask,
  CareTaskAuditEvent,
  CreateCareTaskInput,
} from './care-task.types';


function optionalDate(
  value: unknown,
): Date | null {

  if (!value) {
    return null;
  }

  return new Date(
    value as any,
  );
}


function mapCareTask(
  row: Record<string, any>,
): CareTask {

  return {
    careTaskId:
      row.care_task_id,

    carePlanId:
      row.care_plan_id,

    residentId:
      row.resident_id,

    taskCode:
      row.task_code,

    title:
      row.title,

    description:
      row.description,

    taskCategory:
      row.task_category,

    status:
      row.status,

    priority:
      row.priority,

    scheduledAt:
      optionalDate(
        row.scheduled_at,
      ),

    dueAt:
      optionalDate(
        row.due_at,
      ),

    recurrenceRule:
      row.recurrence_rule,

    assignedTo:
      row.assigned_to,

    assignedRole:
      row.assigned_role,

    assignedAt:
      optionalDate(
        row.assigned_at,
      ),

    acceptedAt:
      optionalDate(
        row.accepted_at,
      ),

    startedAt:
      optionalDate(
        row.started_at,
      ),

    completedAt:
      optionalDate(
        row.completed_at,
      ),

    missedAt:
      optionalDate(
        row.missed_at,
      ),

    skippedAt:
      optionalDate(
        row.skipped_at,
      ),

    cancelledAt:
      optionalDate(
        row.cancelled_at,
      ),

    completionNote:
      row.completion_note,

    exceptionReason:
      row.exception_reason,

    createdAt:
      new Date(
        row.created_at,
      ),

    updatedAt:
      new Date(
        row.updated_at,
      ),
  };
}


@Injectable()
export class CareTaskRepository {

  constructor(
    private readonly db:
      DatabaseService,
  ) {}


  async create(
    input: CreateCareTaskInput,
  ): Promise<CareTask> {

    return this.db.withTransaction(
      async client => {

        /*
         * Domain-integrity guard:
         *
         * PostgreSQL independently protects:
         *   care_plan_id -> care_plans
         *   resident_id  -> residents
         *
         * But those two FKs alone cannot guarantee
         * that the selected care plan belongs to the
         * same resident.
         *
         * Therefore repository validates the pair
         * atomically inside the same transaction.
         */

        const planResult =
          await client.query(
            `
            SELECT
              care_plan_id,
              resident_id
            FROM care_plans
            WHERE care_plan_id = $1
            FOR SHARE
            `,
            [
              input.carePlanId,
            ],
          );

        const plan =
          planResult.rows[0];

        if (!plan) {
          throw new Error(
            'Care Plan not found.',
          );
        }

        if (
          plan.resident_id !==
          input.residentId
        ) {
          throw new Error(
            'Care Plan does not belong to the supplied resident.',
          );
        }

        const result =
          await client.query(
            `
            INSERT INTO care_tasks (
              care_task_id,
              care_plan_id,
              resident_id,
              task_code,
              title,
              description,
              task_category,
              status,
              priority,
              scheduled_at,
              due_at,
              recurrence_rule,
              assigned_to,
              assigned_role,
              assigned_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,
              'PLANNED',
              $8,$9,$10,$11,
              NULL,NULL,NULL
            )
            RETURNING *
            `,
            [
              input.careTaskId,
              input.carePlanId,
              input.residentId,
              input.taskCode,
              input.title,
              input.description ?? null,
              input.taskCategory,
              input.priority,
              input.scheduledAt ?? null,
              input.dueAt ?? null,
              input.recurrenceRule ?? null,
            ],
          );

        const task =
          mapCareTask(
            result.rows[0],
          );

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
            1,
            $2,
            $3,
            $4,
            'TASK_CREATED',
            $5,
            $6,
            NULL,
            $7::jsonb
          )
          `,
          [
            randomUUID(),
            task.careTaskId,
            task.carePlanId,
            task.residentId,
            input.actorId,
            input.actorRole,
            JSON.stringify({
              careTaskId:
                task.careTaskId,

              carePlanId:
                task.carePlanId,

              residentId:
                task.residentId,

              taskCode:
                task.taskCode,

              status:
                task.status,

              priority:
                task.priority,

              assignedTo:
                task.assignedTo,
            }),
          ],
        );

        return task;
      },
    );
  }


  async findById(
    careTaskId: string,
  ): Promise<CareTask | null> {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM care_tasks
        WHERE care_task_id = $1
        `,
        [
          careTaskId,
        ],
      );

    if (!result.rows[0]) {
      return null;
    }

    return mapCareTask(
      result.rows[0],
    );
  }


  async findByPlan(
    carePlanId: string,
  ): Promise<CareTask[]> {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM care_tasks
        WHERE care_plan_id = $1
        ORDER BY created_at ASC
        `,
        [
          carePlanId,
        ],
      );

    return result.rows.map(
      mapCareTask,
    );
  }


  async findByResident(
    residentId: string,
  ): Promise<CareTask[]> {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM care_tasks
        WHERE resident_id = $1
        ORDER BY created_at ASC
        `,
        [
          residentId,
        ],
      );

    return result.rows.map(
      mapCareTask,
    );
  }


  async getAudit(
    careTaskId: string,
  ): Promise<CareTaskAuditEvent[]> {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM care_task_audit
        WHERE care_task_id = $1
        ORDER BY event_sequence ASC
        `,
        [
          careTaskId,
        ],
      );

    return result.rows.map(
      (row: Record<string, any>) => ({
        auditId:
          row.audit_id,

        eventSequence:
          Number(
            row.event_sequence,
          ),

        careTaskId:
          row.care_task_id,

        carePlanId:
          row.care_plan_id,

        residentId:
          row.resident_id,

        eventType:
          row.event_type,

        actorId:
          row.actor_id,

        actorRole:
          row.actor_role,

        previousState:
          row.previous_state,

        newState:
          row.new_state,

        createdAt:
          new Date(
            row.created_at,
          ),
      }),
    );
  }
}
