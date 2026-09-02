import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

type QueryClient = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<any>;
};

type PlannedClassification =
  | 'PLANNED'
  | 'ADDITIONAL'
  | 'UNPLANNED';

type ProjectCompletedDomainWorkInput = {
  client: QueryClient;
  workEventTypeCode: string;
  sourceDomain: string;
  sourceEntityType: string;
  sourceEntityId: string;
  residentId: string | null;
  performedBy: string;
  performedByRole: string;
  occurredAt: Date | string;
  plannedClassification: PlannedClassification;
  quantity?: number;
  note?: string | null;
};

@Injectable()
export class OperationalWorkProjectionService {
  async projectCompletedDomainWork(
    input: ProjectCompletedDomainWorkInput,
  ): Promise<any> {
    const {
      client,
      workEventTypeCode,
      sourceDomain,
      sourceEntityType,
      sourceEntityId,
      residentId,
      performedBy,
      performedByRole,
      occurredAt,
      plannedClassification,
      note,
    } = input;

    const quantity =
      input.quantity ?? 1;

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new ConflictException(
        'Operational projection quantity must be greater than 0',
      );
    }

    if (
      !performedBy ||
      !performedByRole ||
      ['AI', 'SYSTEM'].includes(
        String(performedByRole).toUpperCase(),
      )
    ) {
      throw new ConflictException(
        'Operational projection requires authoritative human performer',
      );
    }

    const actorResult =
      await client.query(
        `
        SELECT
          actor_id,
          primary_operational_role,
          status
        FROM staff_actors
        WHERE actor_id = $1
        LIMIT 1
        `,
        [performedBy],
      );

    if (actorResult.rowCount !== 1) {
      throw new ConflictException(
        'Operational projection performer is not canonical',
      );
    }

    const actor = actorResult.rows[0];

    if (
      actor.status !== 'ACTIVE' ||
      actor.primary_operational_role !==
        performedByRole
    ) {
      throw new ConflictException(
        'Operational projection performer is not active canonical human authority',
      );
    }

    const typeResult =
      await client.query(
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
        [workEventTypeCode],
      );

    if (typeResult.rowCount !== 1) {
      throw new ConflictException(
        `Active operational work event type not found: ${workEventTypeCode}`,
      );
    }

    const type = typeResult.rows[0];

    const existing =
      await client.query(
        `
        SELECT *
        FROM operational_work_events
        WHERE source_domain = $1
          AND source_entity_type = $2
          AND source_entity_id = $3
          AND work_event_type_id = $4
        LIMIT 1
        `,
        [
          sourceDomain,
          sourceEntityType,
          sourceEntityId,
          type.work_event_type_id,
        ],
      );

    if (existing.rowCount === 1) {
      return existing.rows[0];
    }

    const workEventId =
      `work-event-${randomUUID()}`;

    let inserted: any;

    try {
      inserted =
        await client.query(
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
            $1,$2,$3,$4,$5,$6,$7,$8,
            NULL,$8,$9,$10,$11,$12,$13,
            NULL,$14,'COMPLETED'
          )
          RETURNING *
          `,
          [
            workEventId,
            residentId,
            type.work_event_type_id,
            sourceDomain,
            sourceEntityType,
            sourceEntityId,
            plannedClassification,
            occurredAt,
            performedBy,
            performedByRole,
            quantity,
            type.default_unit,
            type.default_work_weight,
            note ?? null,
          ],
        );
    } catch (error: any) {
      if (error?.code === '23505') {
        const duplicate =
          await client.query(
            `
            SELECT *
            FROM operational_work_events
            WHERE source_domain = $1
              AND source_entity_type = $2
              AND source_entity_id = $3
              AND work_event_type_id = $4
            LIMIT 1
            `,
            [
              sourceDomain,
              sourceEntityType,
              sourceEntityId,
              type.work_event_type_id,
            ],
          );

        if (duplicate.rowCount === 1) {
          return duplicate.rows[0];
        }
      }

      throw error;
    }

    const row = inserted.rows[0];

    await client.query(
      `
      INSERT INTO operational_work_event_audit (
        audit_id,
        event_type,
        target_work_event_id,
        performed_by,
        performed_by_role,
        previous_value,
        new_value
      )
      VALUES (
        $1,
        'CREATED',
        $2,
        $3,
        $4,
        NULL,
        $5::jsonb
      )
      `,
      [
        randomUUID(),
        row.work_event_id,
        performedBy,
        performedByRole,
        JSON.stringify({
          workEventId:
            row.work_event_id,
          residentId:
            row.resident_id,
          workEventTypeId:
            row.work_event_type_id,
          sourceDomain:
            row.source_domain,
          sourceEntityType:
            row.source_entity_type,
          sourceEntityId:
            row.source_entity_id,
          plannedClassification:
            row.planned_classification,
          occurredAt:
            row.occurred_at,
          performedBy:
            row.performed_by,
          performedByRole:
            row.performed_by_role,
          quantity:
            row.quantity,
          unit:
            row.unit,
          workWeight:
            row.work_weight,
          status:
            row.status,
        }),
      ],
    );

    return row;
  }
}
