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
  CarePlan,
  CarePlanAuditEvent,
  CreateCarePlanInput,
} from './care-plan.types';

function mapCarePlan(
  row: Record<string, any>,
): CarePlan {
  return {
    carePlanId:
      row.care_plan_id,
    residentId:
      row.resident_id,
    planCode:
      row.plan_code,
    title:
      row.title,
    description:
      row.description,
    status:
      row.status,
    effectiveFrom:
      row.effective_from
        ? new Date(row.effective_from)
        : null,
    effectiveTo:
      row.effective_to
        ? new Date(row.effective_to)
        : null,
    createdBy:
      row.created_by,
    createdByRole:
      row.created_by_role,
    approvedBy:
      row.approved_by,
    approvedByRole:
      row.approved_by_role,
    approvedAt:
      row.approved_at
        ? new Date(row.approved_at)
        : null,
    createdAt:
      new Date(row.created_at),
    updatedAt:
      new Date(row.updated_at),
  };
}

@Injectable()
export class CarePlanRepository {

  constructor(
    private readonly db: DatabaseService,
  ) {}

  async create(
    input: CreateCarePlanInput,
  ): Promise<CarePlan> {

    return this.db.withTransaction(
      async client => {

        const result =
          await client.query(
            `
            INSERT INTO care_plans (
              care_plan_id,
              resident_id,
              plan_code,
              title,
              description,
              status,
              effective_from,
              effective_to,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,
              'DRAFT',
              $6,$7,$8,$9
            )
            RETURNING *
            `,
            [
              input.carePlanId,
              input.residentId,
              input.planCode,
              input.title,
              input.description ?? null,
              input.effectiveFrom ?? null,
              input.effectiveTo ?? null,
              input.createdBy,
              input.createdByRole,
            ],
          );

        const plan =
          mapCarePlan(
            result.rows[0],
          );

        await client.query(
          `
          INSERT INTO care_plan_audit (
            audit_id,
            event_sequence,
            care_plan_id,
            resident_id,
            event_type,
            actor_id,
            actor_role,
            previous_state,
            new_state
          )
          VALUES (
            $1,1,$2,$3,
            'PLAN_CREATED',
            $4,$5,
            NULL,
            $6::jsonb
          )
          `,
          [
            randomUUID(),
            plan.carePlanId,
            plan.residentId,
            input.createdBy,
            input.createdByRole,
            JSON.stringify({
              carePlanId:
                plan.carePlanId,
              residentId:
                plan.residentId,
              status:
                plan.status,
              planCode:
                plan.planCode,
            }),
          ],
        );

        return plan;
      },
    );
  }


  async findById(
    carePlanId: string,
  ): Promise<CarePlan | null> {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM care_plans
        WHERE care_plan_id = $1
        `,
        [
          carePlanId,
        ],
      );

    if (!result.rows[0]) {
      return null;
    }

    return mapCarePlan(
      result.rows[0],
    );
  }


  async findByResident(
    residentId: string,
  ): Promise<CarePlan[]> {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM care_plans
        WHERE resident_id = $1
        ORDER BY created_at ASC
        `,
        [
          residentId,
        ],
      );

    return result.rows.map(
      mapCarePlan,
    );
  }


  async getAudit(
    carePlanId: string,
  ): Promise<CarePlanAuditEvent[]> {

    const result =
      await this.db.query(
        `
        SELECT *
        FROM care_plan_audit
        WHERE care_plan_id = $1
        ORDER BY event_sequence ASC
        `,
        [
          carePlanId,
        ],
      );

    return result.rows.map(
      (row: Record<string, any>) => ({
        auditId:
          row.audit_id,
        eventSequence:
          Number(row.event_sequence),
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
          new Date(row.created_at),
      }),
    );
  }
}
