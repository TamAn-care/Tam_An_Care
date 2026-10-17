import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';

@Injectable()
export class OperationalWorkProjectionService {
  async project(
    client: PoolClient,
    input: {
      residentId: string | null;
      workEventTypeCode: string;
      sourceDomain: string;
      sourceEntityType: string;
      sourceEntityId: string;
      plannedClassification?: 'PLANNED' | 'ADDITIONAL' | 'UNPLANNED';
      occurredAt: Date | string;
      startedAt?: Date | string | null;
      completedAt?: Date | string | null;
      performedBy: string;
      performedByRole: string;
      quantity?: number;
      reasonCode?: string | null;
      note?: string | null;
    },
  ): Promise<void> {
    const allowedRoles = [
      'CAREGIVER',
      'NURSE',
      'CARE_MANAGER',
      'SUPERVISOR',
    ];

    const role =
      String(input.performedByRole ?? '')
        .trim()
        .toUpperCase();

    if (!allowedRoles.includes(role)) {
      throw new Error(
        'Operational Work projection requires canonical human role.',
      );
    }

    const actorResult = await client.query(
      `
        SELECT
          actor_id,
          primary_operational_role,
          status
        FROM staff_actors
        WHERE actor_id = $1
        LIMIT 1
      `,
      [input.performedBy],
    );

    if (actorResult.rowCount !== 1) {
      throw new Error(
        'Operational Work projection performer is not canonical.',
      );
    }

    const actor = actorResult.rows[0];

    if (
      actor.status !== 'ACTIVE' ||
      String(actor.primary_operational_role).toUpperCase() !== role
    ) {
      throw new Error(
        'Operational Work projection performer is not an active canonical human actor.',
      );
    }

    const typeResult = await client.query(
      `
        SELECT
          work_event_type_id,
          default_unit,
          default_work_weight
        FROM operational_work_event_types
        WHERE code = $1
          AND active = TRUE
        LIMIT 1
      `,
      [input.workEventTypeCode],
    );

    if (typeResult.rowCount !== 1) {
      throw new Error(
        `Operational Work Event Type unavailable: ${input.workEventTypeCode}`,
      );
    }

    const type = typeResult.rows[0];

    const workEventId =
      `work-event-${randomUUID()}`;

    const inserted = await client.query(
      `
        INSERT INTO operational_work_events (
          work_event_id,
          resident_id,
          work_event_type_id,
          source_domain,
          source_entity_type,
          source_entity_id,
          planned_classification,
          occurred_at,
          started_at,
          completed_at,
          performed_by,
          performed_by_role,
          quantity,
          unit,
          work_weight,
          reason_code,
          note,
          status
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,'COMPLETED'
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `,
      [
        workEventId,
        input.residentId,
        type.work_event_type_id,
        input.sourceDomain,
        input.sourceEntityType,
        input.sourceEntityId,
        input.plannedClassification ?? 'PLANNED',
        input.occurredAt,
        input.startedAt ?? null,
        input.completedAt ?? input.occurredAt,
        input.performedBy,
        role,
        input.quantity ?? 1,
        type.default_unit,
        type.default_work_weight,
        input.reasonCode ?? null,
        input.note ?? null,
      ],
    );

    if (inserted.rowCount === 0) {
      return;
    }

    const row = inserted.rows[0];

    const snapshot = {
      workEventId: row.work_event_id,
      residentId: row.resident_id,
      workEventTypeId: row.work_event_type_id,
      sourceDomain: row.source_domain,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      plannedClassification: row.planned_classification,
      occurredAt: row.occurred_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      performedBy: row.performed_by,
      performedByRole: row.performed_by_role,
      quantity: row.quantity,
      unit: row.unit,
      workWeight: row.work_weight,
      reasonCode: row.reason_code,
      note: row.note,
      status: row.status,
    };

    await client.query(
      `
        INSERT INTO operational_work_event_audit (
          event_type,
          target_work_event_id,
          performed_by,
          performed_by_role,
          previous_value,
          new_value
        )
        VALUES (
          'WORK_EVENT_CREATED',
          $1,$2,$3,NULL,$4::jsonb
        )
      `,
      [
        row.work_event_id,
        input.performedBy,
        role,
        JSON.stringify(snapshot),
      ],
    );
  }
}
