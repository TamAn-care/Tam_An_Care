import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';

import { DatabaseService } from '../database/database.service';

type HumanRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'CARE_MANAGER'
  | 'SUPERVISOR';

type EventStatus =
  | 'RECORDED'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'AMENDED'
  | 'VOIDED';

interface ActorContext {
  actorId: string;
  actorRole: HumanRole;
}

@Injectable()
export class OperationalWorkEventService {
  private readonly pool: Pool;

  private readonly humanRoles: HumanRole[] = [
    'CAREGIVER',
    'NURSE',
    'CARE_MANAGER',
    'SUPERVISOR',
  ];

  private readonly authorityRoles: HumanRole[] = [
    'CARE_MANAGER',
    'SUPERVISOR',
  ];

  constructor(private readonly database: DatabaseService) {
    this.pool = this.database.getPool();
  }

  private async withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async requireActor(
    actorId?: string,
    actorRole?: string,
  ): Promise<ActorContext> {
    if (!actorId || !actorRole) {
      throw new UnauthorizedException('Actor context is required');
    }

    if (
      !this.humanRoles.includes(actorRole as HumanRole)
    ) {
      throw new ForbiddenException(
        'Human actor role is required',
      );
    }

    const result = await this.pool.query(
      `
      SELECT
        actor_id,
        primary_operational_role,
        status
      FROM staff_actors
      WHERE actor_id = $1
      LIMIT 1
      `,
      [actorId],
    );

    if (!result.rowCount) {
      throw new UnauthorizedException(
        'Canonical actor not found',
      );
    }

    const actor = result.rows[0];

    if (actor.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Canonical actor is not active',
      );
    }

    if (actor.primary_operational_role !== actorRole) {
      throw new ForbiddenException(
        'Actor role does not match canonical role',
      );
    }

    return {
      actorId: actor.actor_id,
      actorRole: actor.primary_operational_role as HumanRole,
    };
  }

  private requireAuthority(actor: ActorContext): void {
    if (!this.authorityRoles.includes(actor.actorRole)) {
      throw new ForbiddenException(
        'Care manager or supervisor authority is required',
      );
    }
  }

  private normalizeLimit(value: any): number {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return 50;
    }

    const parsed = Number(value);

    if (
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > 100
    ) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 100',
      );
    }

    return parsed;
  }

  private requireText(
    value: any,
    field: string,
  ): string {
    if (
      typeof value !== 'string' ||
      value.trim().length === 0
    ) {
      throw new BadRequestException(
        `${field} is required`,
      );
    }

    return value.trim();
  }

  private eventSnapshot(row: any): Record<string, any> {
    return {
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
  }

  private async insertAudit(
    client: PoolClient,
    eventType:
      | 'WORK_EVENT_CREATED'
      | 'WORK_EVENT_VERIFIED'
      | 'WORK_EVENT_AMENDED'
      | 'WORK_EVENT_VOIDED',
    targetWorkEventId: string,
    actor: ActorContext,
    previousValue: Record<string, any> | null,
    newValue: Record<string, any>,
  ): Promise<void> {
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
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
      `,
      [
        eventType,
        targetWorkEventId,
        actor.actorId,
        actor.actorRole,
        previousValue === null
          ? null
          : JSON.stringify(previousValue),
        JSON.stringify(newValue),
      ],
    );
  }

  async list(
    actorId: string | undefined,
    actorRole: string | undefined,
    query: any,
  ): Promise<any> {
    await this.requireActor(actorId, actorRole);

    const limit = this.normalizeLimit(query?.limit);

    const values: any[] = [];
    const conditions: string[] = [];

    const addFilter = (
      column: string,
      value: any,
    ) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        values.push(String(value).trim());
        conditions.push(
          `${column} = $${values.length}`,
        );
      }
    };

    addFilter('resident_id', query?.residentId);
    addFilter(
      'work_event_type_id',
      query?.workEventTypeId,
    );
    addFilter('performed_by', query?.performedBy);
    addFilter('status', query?.status);
    addFilter('source_domain', query?.sourceDomain);

    values.push(limit);

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const result = await this.pool.query(
      `
      SELECT *
      FROM operational_work_events
      ${where}
      ORDER BY occurred_at DESC, work_event_id DESC
      LIMIT $${values.length}
      `,
      values,
    );

    return {
      items: result.rows,
      count: result.rows.length,
      limit,
    };
  }

  async detail(
    actorId: string | undefined,
    actorRole: string | undefined,
    id: string,
  ): Promise<any> {
    await this.requireActor(actorId, actorRole);

    const result = await this.pool.query(
      `
      SELECT *
      FROM operational_work_events
      WHERE work_event_id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        'Work event not found',
      );
    }

    return result.rows[0];
  }

  async create(
    actorId: string | undefined,
    actorRole: string | undefined,
    body: any,
  ): Promise<any> {
    const actor = await this.requireActor(
      actorId,
      actorRole,
    );

    if (
      body?.performedBy !== undefined ||
      body?.performed_by !== undefined ||
      body?.performedByRole !== undefined ||
      body?.performed_by_role !== undefined ||
      body?.workWeight !== undefined ||
      body?.work_weight !== undefined ||
      body?.unit !== undefined
    ) {
      throw new BadRequestException(
        'performedBy, performedByRole, workWeight and unit are server-controlled',
      );
    }

    const workEventTypeId = this.requireText(
      body?.workEventTypeId,
      'workEventTypeId',
    );

    const sourceDomain = this.requireText(
      body?.sourceDomain,
      'sourceDomain',
    );

    const plannedClassification =
      this.requireText(
        body?.plannedClassification,
        'plannedClassification',
      );

    if (
      ![
        'PLANNED',
        'ADDITIONAL',
        'UNPLANNED',
      ].includes(plannedClassification)
    ) {
      throw new BadRequestException(
        'Invalid plannedClassification',
      );
    }

    const requestedStatus =
      body?.status === undefined
        ? 'COMPLETED'
        : this.requireText(
            body.status,
            'status',
          );

    if (
      !['COMPLETED', 'RECORDED'].includes(
        requestedStatus,
      )
    ) {
      throw new BadRequestException(
        'Initial status must be COMPLETED or RECORDED',
      );
    }

    const sourceEntityType =
      body?.sourceEntityType === undefined ||
      body?.sourceEntityType === null ||
      body?.sourceEntityType === ''
        ? null
        : String(body.sourceEntityType).trim();

    const sourceEntityId =
      body?.sourceEntityId === undefined ||
      body?.sourceEntityId === null ||
      body?.sourceEntityId === ''
        ? null
        : String(body.sourceEntityId).trim();

    if (
      (sourceEntityType === null) !==
      (sourceEntityId === null)
    ) {
      throw new BadRequestException(
        'sourceEntityType and sourceEntityId must both be supplied or both be null',
      );
    }

    const quantity =
      body?.quantity === undefined
        ? 1
        : Number(body.quantity);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new BadRequestException(
        'quantity must be greater than 0',
      );
    }

    const occurredAt =
      body?.occurredAt === undefined
        ? new Date().toISOString()
        : body.occurredAt;

    const workEventId =
      `work-event-${randomUUID()}`;

    try {
      return await this.withTransaction(
        async (client) => {
          const typeResult = await client.query(
            `
            SELECT *
            FROM operational_work_event_types
            WHERE work_event_type_id = $1
              AND active = true
            LIMIT 1
            FOR SHARE
            `,
            [workEventTypeId],
          );

          if (!typeResult.rowCount) {
            throw new BadRequestException(
              'Active work event type not found',
            );
          }

          const type = typeResult.rows[0];

          const residentId =
            body?.residentId === undefined ||
            body?.residentId === null ||
            body?.residentId === ''
              ? null
              : String(body.residentId).trim();

          if (
            type.resident_related === true &&
            residentId === null
          ) {
            throw new BadRequestException(
              'residentId is required for resident-related work',
            );
          }

          if (residentId !== null) {
            const residentResult =
              await client.query(
                `
                SELECT resident_id
                FROM residents
                WHERE resident_id = $1
                LIMIT 1
                `,
                [residentId],
              );

            if (!residentResult.rowCount) {
              throw new BadRequestException(
                'Resident not found',
              );
            }
          }

          const insertResult =
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
                $9,$10,$11,$12,$13,$14,$15,
                $16,$17,$18
              )
              RETURNING *
              `,
              [
                workEventId,
                residentId,
                workEventTypeId,
                sourceDomain,
                sourceEntityType,
                sourceEntityId,
                plannedClassification,
                occurredAt,
                body?.startedAt ?? null,
                body?.completedAt ??
                  (
                    requestedStatus ===
                    'COMPLETED'
                      ? occurredAt
                      : null
                  ),
                actor.actorId,
                actor.actorRole,
                quantity,
                type.default_unit,
                type.default_work_weight,
                body?.reasonCode ?? null,
                body?.note ?? null,
                requestedStatus,
              ],
            );

          const row = insertResult.rows[0];

          await this.insertAudit(
            client,
            'WORK_EVENT_CREATED',
            row.work_event_id,
            actor,
            null,
            this.eventSnapshot(row),
          );

          return row;
        },
      );
    } catch (error: any) {
      if (
        String(error?.code || '') === '23505'
      ) {
        throw new ConflictException(
          'Work event source/type already exists',
        );
      }

      throw error;
    }
  }

  async verify(
    actorId: string | undefined,
    actorRole: string | undefined,
    id: string,
    body: any,
  ): Promise<any> {
    const actor = await this.requireActor(
      actorId,
      actorRole,
    );
    this.requireAuthority(actor);

    return this.lifecycleUpdate(
      actor,
      id,
      ['RECORDED'],
      'VERIFIED',
      'WORK_EVENT_VERIFIED',
      body,
    );
  }

  async amend(
    actorId: string | undefined,
    actorRole: string | undefined,
    id: string,
    body: any,
  ): Promise<any> {
    const actor = await this.requireActor(
      actorId,
      actorRole,
    );
    this.requireAuthority(actor);

    return this.lifecycleUpdate(
      actor,
      id,
      ['VERIFIED', 'COMPLETED', 'AMENDED'],
      'AMENDED',
      'WORK_EVENT_AMENDED',
      body,
    );
  }

  async voidEvent(
    actorId: string | undefined,
    actorRole: string | undefined,
    id: string,
    body: any,
  ): Promise<any> {
    const actor = await this.requireActor(
      actorId,
      actorRole,
    );
    this.requireAuthority(actor);

    if (
      typeof body?.reasonCode !== 'string' ||
      body.reasonCode.trim().length === 0
    ) {
      throw new BadRequestException(
        'reasonCode is required for void',
      );
    }

    return this.lifecycleUpdate(
      actor,
      id,
      [
        'RECORDED',
        'VERIFIED',
        'COMPLETED',
        'AMENDED',
      ],
      'VOIDED',
      'WORK_EVENT_VOIDED',
      body,
    );
  }

  private async lifecycleUpdate(
    actor: ActorContext,
    id: string,
    allowedStatuses: EventStatus[],
    nextStatus: EventStatus,
    auditType:
      | 'WORK_EVENT_VERIFIED'
      | 'WORK_EVENT_AMENDED'
      | 'WORK_EVENT_VOIDED',
    body: any,
  ): Promise<any> {
    return this.withTransaction(
      async (client) => {
        const currentResult =
          await client.query(
            `
            SELECT *
            FROM operational_work_events
            WHERE work_event_id = $1
            LIMIT 1
            FOR UPDATE
            `,
            [id],
          );

        if (!currentResult.rowCount) {
          throw new NotFoundException(
            'Work event not found',
          );
        }

        const previous =
          currentResult.rows[0];

        if (
          !allowedStatuses.includes(
            previous.status,
          )
        ) {
          throw new ConflictException(
            `Invalid work event transition from ${previous.status} to ${nextStatus}`,
          );
        }

        const quantity = Number(
          body?.quantity === undefined
            ? previous.quantity
            : body.quantity,
        );

        if (
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          throw new BadRequestException(
            'quantity must be greater than 0',
          );
        }

        if (
          body?.workWeight !== undefined ||
          body?.work_weight !== undefined ||
          body?.unit !== undefined ||
          body?.performedBy !== undefined ||
          body?.performed_by !== undefined ||
          body?.performedByRole !== undefined ||
          body?.performed_by_role !== undefined ||
          body?.workEventTypeId !== undefined ||
          body?.work_event_type_id !== undefined
        ) {
          throw new BadRequestException(
            'Canonical evidence fields are immutable',
          );
        }

        const updateResult =
          await client.query(
            `
            UPDATE operational_work_events
            SET
              quantity = $2,
              reason_code = $3,
              note = $4,
              started_at = $5,
              completed_at = $6,
              status = $7
            WHERE work_event_id = $1
            RETURNING *
            `,
            [
              id,
              quantity,
              body?.reasonCode ??
                previous.reason_code,
              body?.note ??
                previous.note,
              body?.startedAt ??
                previous.started_at,
              body?.completedAt ??
                previous.completed_at,
              nextStatus,
            ],
          );

        const row = updateResult.rows[0];

        await this.insertAudit(
          client,
          auditType,
          row.work_event_id,
          actor,
          this.eventSnapshot(previous),
          this.eventSnapshot(row),
        );

        return row;
      },
    );
  }
}
