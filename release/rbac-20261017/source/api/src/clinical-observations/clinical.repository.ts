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
export class ClinicalRepository {

  async findObservationForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<any | null> {

    const result =
      await client.query(
        `
        SELECT *
        FROM clinical_observations
        WHERE clinical_observation_id = $1
        FOR UPDATE
        `,
        [id],
      );

    return result.rows[0] ?? null;
  }


  async findNursingNoteForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<any | null> {

    const result =
      await client.query(
        `
        SELECT *
        FROM nursing_notes
        WHERE nursing_note_id = $1
        FOR UPDATE
        `,
        [id],
      );

    return result.rows[0] ?? null;
  }


  async findFindingForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<any | null> {

    const result =
      await client.query(
        `
        SELECT *
        FROM abnormal_findings
        WHERE abnormal_finding_id = $1
        FOR UPDATE
        `,
        [id],
      );

    return result.rows[0] ?? null;
  }


  async findEscalationForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<any | null> {

    const result =
      await client.query(
        `
        SELECT *
        FROM clinical_escalations
        WHERE clinical_escalation_id = $1
        FOR UPDATE
        `,
        [id],
      );

    return result.rows[0] ?? null;
  }


  async nextAuditSequence(
    client: PoolClient,
    aggregateColumn: string,
    aggregateId: string,
  ): Promise<number> {

    const allowed = [
      'clinical_observation_id',
      'nursing_note_id',
      'abnormal_finding_id',
      'clinical_escalation_id',
    ];

    if (
      !allowed.includes(
        aggregateColumn,
      )
    ) {
      throw new Error(
        'Unsupported clinical audit aggregate.',
      );
    }

    const result =
      await client.query(
        `
        SELECT
          COALESCE(
            MAX(event_sequence),
            0
          ) + 1 AS next_sequence
        FROM clinical_audit
        WHERE ${aggregateColumn} = $1
        `,
        [aggregateId],
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
      aggregateColumn: string;
      aggregateId: string;
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
        input.aggregateColumn,
        input.aggregateId,
      );

    const allowed = [
      'clinical_observation_id',
      'nursing_note_id',
      'abnormal_finding_id',
      'clinical_escalation_id',
    ];

    if (
      !allowed.includes(
        input.aggregateColumn,
      )
    ) {
      throw new Error(
        'Unsupported clinical audit aggregate.',
      );
    }

    await client.query(
      `
      INSERT INTO clinical_audit (
        audit_id,
        event_sequence,
        resident_id,
        ${input.aggregateColumn},
        event_type,
        actor_id,
        actor_role,
        previous_state,
        new_state
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8::jsonb,$9::jsonb
      )
      `,
      [
        randomUUID(),
        sequence,
        input.residentId,
        input.aggregateId,
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
