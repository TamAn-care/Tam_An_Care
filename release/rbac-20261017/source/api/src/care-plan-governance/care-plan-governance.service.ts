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
  CarePlanAuthorizationService,
} from '../care-plan-authorization/care-plan-authorization.service';

import {
  CarePlanGovernanceAction,
} from '../care-plan-authorization/care-plan-authorization.types';


@Injectable()
export class CarePlanGovernanceService {

  constructor(
    private readonly db:
      DatabaseService,

    private readonly authorization:
      CarePlanAuthorizationService,
  ) {}


  async execute(
    carePlanId: string,
    action:
      CarePlanGovernanceAction,
    actorId: string,
    actorRole: string,
  ) {

    const normalizedPlanId =
      String(
        carePlanId ?? '',
      ).trim();

    const normalizedActorId =
      String(
        actorId ?? '',
      ).trim();

    const normalizedActorRole =
      String(
        actorRole ?? '',
      ).trim();

    if (!normalizedPlanId) {
      throw new Error(
        'carePlanId is required.',
      );
    }

    if (!normalizedActorId) {
      throw new Error(
        'actorId is required.',
      );
    }

    if (!normalizedActorRole) {
      throw new Error(
        'actorRole is required.',
      );
    }


    return this.db.withTransaction(
      async (client: any) => {

        const found =
          await client.query(
            `
            SELECT
              care_plan_id,
              resident_id,
              plan_code,
              title,
              description,
              status,
              effective_from,
              effective_to,
              created_by,
              created_by_role,
              approved_by,
              approved_by_role,
              approved_at,
              created_at,
              updated_at
            FROM care_plans
            WHERE care_plan_id = $1
            FOR UPDATE
            `,
            [
              normalizedPlanId,
            ],
          );


        if (
          !found.rows ||
          found.rows.length !== 1
        ) {
          throw new Error(
            'Care Plan not found.',
          );
        }


        const plan =
          found.rows[0];


        const decision =
          this.authorization
            .authorize({
              currentStatus:
                plan.status,

              action,

              actorId:
                normalizedActorId,

              actorRole:
                normalizedActorRole,
            });


        const previousState = {
          status:
            plan.status,

          approvedBy:
            plan.approved_by,

          approvedByRole:
            plan.approved_by_role,

          approvedAt:
            plan.approved_at,
        };


        let approvedBy =
          plan.approved_by;

        let approvedByRole =
          plan.approved_by_role;

        let approvedAt =
          plan.approved_at;


        if (
          decision.targetStatus ===
          'ACTIVE'
        ) {
          approvedBy =
            decision.actorId;

          approvedByRole =
            decision.actorRole;

          approvedAt =
            new Date();
        }


        const updatedResult =
          await client.query(
            `
            UPDATE care_plans
            SET
              status = $2,
              approved_by = $3,
              approved_by_role = $4,
              approved_at = $5,
              updated_at = NOW()
            WHERE care_plan_id = $1
            RETURNING
              care_plan_id,
              resident_id,
              plan_code,
              title,
              status,
              approved_by,
              approved_by_role,
              approved_at,
              created_at,
              updated_at
            `,
            [
              normalizedPlanId,
              decision.targetStatus,
              approvedBy,
              approvedByRole,
              approvedAt,
            ],
          );


        const updated =
          updatedResult.rows[0];


        const seqResult =
          await client.query(
            `
            SELECT
              COALESCE(
                MAX(event_sequence),
                0
              ) + 1
                AS next_sequence
            FROM care_plan_audit
            WHERE care_plan_id = $1
            `,
            [
              normalizedPlanId,
            ],
          );


        const nextSequence =
          Number(
            seqResult
              .rows[0]
              .next_sequence,
          );


        const newState = {
          status:
            updated.status,

          approvedBy:
            updated.approved_by,

          approvedByRole:
            updated.approved_by_role,

          approvedAt:
            updated.approved_at,
        };


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
            new_state,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::jsonb,
            $9::jsonb,
            NOW()
          )
          `,
          [
            randomUUID(),
            nextSequence,
            updated.care_plan_id,
            updated.resident_id,
            decision.auditEvent,
            decision.actorId,
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
          carePlanId:
            updated.care_plan_id,

          residentId:
            updated.resident_id,

          planCode:
            updated.plan_code,

          status:
            updated.status,

          actorId:
            decision.actorId,

          actorRole:
            decision.actorRole,

          action:
            decision.action,

          auditEvent:
            decision.auditEvent,

          approvedBy:
            updated.approved_by,

          approvedByRole:
            updated.approved_by_role,

          approvedAt:
            updated.approved_at,

          autonomousClinicalAction:
            false,
        };
      },
    );
  }
}
