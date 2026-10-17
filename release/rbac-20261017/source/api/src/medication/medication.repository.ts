import {
  Injectable,
} from '@nestjs/common';

import {
  randomUUID,
} from 'crypto';

import type {
  PoolClient,
} from 'pg';

@Injectable()
export class MedicationRepository {

  async findAdministrationForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<any | null> {

    const result =
      await client.query(
        `
        SELECT
          ma.*,
          mo.high_risk,
          mo.double_check_required,
          mo.status AS order_status
        FROM medication_administrations ma
        JOIN medication_orders mo
          ON mo.medication_order_id =
             ma.medication_order_id
        WHERE
          ma.medication_administration_id = $1
        FOR UPDATE OF ma
        `,
        [id],
      );

    return result.rows[0] ?? null;
  }


  async countPassedDoubleChecks(
    client: PoolClient,
    administrationId: string,
  ): Promise<number> {

    const result =
      await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM medication_double_checks
        WHERE
          medication_administration_id = $1
          AND result = 'PASSED'
        `,
        [administrationId],
      );

    return Number(
      result.rows[0]?.count ?? 0,
    );
  }


  async nextAuditSequence(
    client: PoolClient,
    administrationId: string,
  ): Promise<number> {

    const result =
      await client.query(
        `
        SELECT
          COALESCE(
            MAX(event_sequence),
            0
          ) + 1 AS next_sequence
        FROM medication_audit
        WHERE
          medication_administration_id = $1
        `,
        [administrationId],
      );

    return Number(
      result.rows[0]
        ?.next_sequence ?? 1,
    );
  }


  async insertAudit(
    client: PoolClient,
    input: {
      residentId: string;
      medicationOrderId: string;
      medicationScheduleId: string;
      medicationAdministrationId: string;
      eventType: string;
      actorId: string;
      actorRole: string;
      previousState: unknown;
      newState: unknown;
    },
  ): Promise<void> {

    const sequence =
      await this.nextAuditSequence(
        client,
        input.medicationAdministrationId,
      );

    await client.query(
      `
      INSERT INTO medication_audit (
        audit_id,
        event_sequence,
        resident_id,
        medication_order_id,
        medication_schedule_id,
        medication_administration_id,
        event_type,
        actor_id,
        actor_role,
        previous_state,
        new_state
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10::jsonb,$11::jsonb
      )
      `,
      [
        randomUUID(),
        sequence,
        input.residentId,
        input.medicationOrderId,
        input.medicationScheduleId,
        input.medicationAdministrationId,
        input.eventType,
        input.actorId,
        input.actorRole,
        JSON.stringify(
          input.previousState,
        ),
        JSON.stringify(
          input.newState,
        ),
      ],
    );
  }
}
