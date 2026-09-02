import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { InventoryAuthorityService } from '../inventory/inventory-authority.service';

@Injectable()
export class ResidentCostService {
  private readonly defaultLimit = 50;
  private readonly maxLimit = 100;

  constructor(
    private readonly db: DatabaseService,
    private readonly authority: InventoryAuthorityService,
  ) {}

  private limit(value?: any): number {
    if (value === undefined || value === null || String(value).trim() === '') {
      return this.defaultLimit;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException('limit không hợp lệ.');
    }
    return Math.min(n, this.maxLimit);
  }

  private offset(value?: any): number {
    if (value === undefined || value === null || String(value).trim() === '') {
      return 0;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new BadRequestException('offset không hợp lệ.');
    }
    return n;
  }

  private async management(actorId?: string, actorRole?: string) {
    const actor = await this.authority.requireActor(actorId, actorRole);
    this.authority.requireAuthority(actor);
    return actor;
  }

  async createUsageCost(
    body: any,
    actorId?: string,
    actorRole?: string,
  ) {
    const actor = await this.management(actorId, actorRole);

    const consumptionId =
      typeof body?.residentConsumptionEventId === 'string'
        ? body.residentConsumptionEventId.trim()
        : '';

    const unitCost = Number(body?.unitCostVnd);

    if (!consumptionId) {
      throw new BadRequestException(
        'residentConsumptionEventId là bắt buộc.',
      );
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new BadRequestException(
        'unitCostVnd phải là số không âm.',
      );
    }

    const c = await this.db.query(
      `
      SELECT
        resident_consumption_event_id,
        resident_id,
        inventory_item_id,
        quantity,
        unit,
        occurred_at
      FROM resident_consumption_events
      WHERE resident_consumption_event_id=$1
      `,
      [consumptionId],
    );

    if (!c.rows[0]) {
      throw new NotFoundException(
        'Không tìm thấy sự kiện sử dụng của cư dân.',
      );
    }

    const source = c.rows[0];
    const total =
      Math.round(
        Number(source.quantity) * unitCost * 100,
      ) / 100;

    try {
      const r = await this.db.query(
        `
        INSERT INTO resident_cost_events (
          resident_cost_event_id,
          resident_id,
          resident_consumption_event_id,
          inventory_item_id,
          quantity,
          unit,
          unit_cost_vnd,
          total_cost_vnd,
          cost_source,
          occurred_at,
          recorded_by,
          recorded_by_role,
          note
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          'RESIDENT_CONSUMPTION_SNAPSHOT',
          $9,$10,$11,$12
        )
        RETURNING *
        `,
        [
          `resident-cost-${randomUUID()}`,
          source.resident_id,
          source.resident_consumption_event_id,
          source.inventory_item_id,
          source.quantity,
          source.unit,
          unitCost,
          total,
          source.occurred_at,
          actor.actorId,
          actor.actorRole,
          body?.note ?? null,
        ],
      );

      return r.rows[0];
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException(
          'Sự kiện sử dụng này đã được ghi nhận chi phí.',
        );
      }
      throw error;
    }
  }

  async listUsageCosts(
    query: any,
    actorId?: string,
    actorRole?: string,
  ) {
    await this.management(actorId, actorRole);

    const limit = this.limit(query?.limit);
    const offset = this.offset(query?.offset);

    const values: any[] = [];
    const where: string[] = [];

    if (query?.residentId) {
      values.push(String(query.residentId).trim());
      where.push(`resident_id=$${values.length}`);
    }

    values.push(limit);
    const lp = values.length;

    values.push(offset);
    const op = values.length;

    const r = await this.db.query(
      `
      SELECT *
      FROM resident_cost_events
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY occurred_at DESC, resident_cost_event_id DESC
      LIMIT $${lp}
      OFFSET $${op}
      `,
      values,
    );

    return {
      items: r.rows,
      limit,
      offset,
      currency: 'VND',
    };
  }

  async createPeriod(
    body: any,
    actorId?: string,
    actorRole?: string,
  ) {
    const actor = await this.management(actorId, actorRole);

    const residentId =
      typeof body?.residentId === 'string'
        ? body.residentId.trim()
        : '';

    if (!residentId || !body?.periodStart || !body?.periodEnd) {
      throw new BadRequestException(
        'residentId, periodStart và periodEnd là bắt buộc.',
      );
    }

    const start = new Date(body.periodStart);
    const end = new Date(body.periodEnd);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      throw new BadRequestException(
        'Khoảng thời gian kỳ chi phí không hợp lệ.',
      );
    }

    const resident = await this.db.query(
      `SELECT resident_id FROM residents WHERE resident_id=$1`,
      [residentId],
    );

    if (!resident.rows[0]) {
      throw new NotFoundException('Không tìm thấy cư dân.');
    }

    const total = await this.db.query(
      `
      SELECT COALESCE(SUM(total_cost_vnd),0)::numeric(18,2) AS total
      FROM resident_cost_events
      WHERE resident_id=$1
        AND occurred_at >= $2::timestamptz
        AND occurred_at < $3::timestamptz
      `,
      [
        residentId,
        start.toISOString(),
        end.toISOString(),
      ],
    );

    const r = await this.db.query(
      `
      INSERT INTO resident_cost_periods (
        resident_cost_period_id,
        resident_id,
        period_start,
        period_end,
        status,
        calculated_total_vnd,
        note
      )
      VALUES ($1,$2,$3,$4,'OPEN',$5,$6)
      RETURNING *
      `,
      [
        `resident-cost-period-${randomUUID()}`,
        residentId,
        start.toISOString(),
        end.toISOString(),
        total.rows[0].total,
        body?.note ?? null,
      ],
    );

    return {
      ...r.rows[0],
      createdBy: actor.actorId,
      createdByRole: actor.actorRole,
      currency: 'VND',
    };
  }

  async listPeriods(
    query: any,
    actorId?: string,
    actorRole?: string,
  ) {
    await this.management(actorId, actorRole);

    const limit = this.limit(query?.limit);
    const offset = this.offset(query?.offset);

    const values: any[] = [];
    const where: string[] = [];

    if (query?.residentId) {
      values.push(String(query.residentId).trim());
      where.push(`resident_id=$${values.length}`);
    }

    values.push(limit);
    const lp = values.length;

    values.push(offset);
    const op = values.length;

    const r = await this.db.query(
      `
      SELECT *
      FROM resident_cost_periods
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY period_start DESC, resident_cost_period_id DESC
      LIMIT $${lp}
      OFFSET $${op}
      `,
      values,
    );

    return {
      items: r.rows,
      limit,
      offset,
      currency: 'VND',
    };
  }

  async reconcilePeriod(
    id: string,
    body: any,
    actorId?: string,
    actorRole?: string,
  ) {
    const actor = await this.management(actorId, actorRole);

    const existing = await this.db.query(
      `
      SELECT
        resident_cost_period_id,
        status
      FROM resident_cost_periods
      WHERE resident_cost_period_id=$1
      `,
      [id],
    );

    if (!existing.rows[0]) {
      throw new NotFoundException(
        'Không tìm thấy kỳ chi phí.',
      );
    }

    if (existing.rows[0].status !== 'OPEN') {
      throw new ConflictException(
        'Chỉ kỳ OPEN mới được đối soát.',
      );
    }

    const r = await this.db.query(
      `
      WITH target AS (
        SELECT
          resident_cost_period_id,
          resident_id,
          period_start,
          period_end
        FROM resident_cost_periods
        WHERE resident_cost_period_id=$1
          AND status='OPEN'
        FOR UPDATE
      ),
      cost_total AS (
        SELECT
          t.resident_cost_period_id,
          COALESCE(
            SUM(e.total_cost_vnd),
            0
          )::numeric(18,2) AS total
        FROM target t
        LEFT JOIN resident_cost_events e
          ON e.resident_id=t.resident_id
         AND e.occurred_at >= t.period_start
         AND e.occurred_at < t.period_end
        GROUP BY t.resident_cost_period_id
      )
      UPDATE resident_cost_periods p
      SET
        calculated_total_vnd=c.total,
        reconciled_total_vnd=c.total,
        status='RECONCILED',
        reconciled_at=now(),
        reconciled_by=$2,
        reconciled_by_role=$3,
        note=COALESCE($4,p.note),
        updated_at=now()
      FROM cost_total c
      WHERE p.resident_cost_period_id=
            c.resident_cost_period_id
        AND p.status='OPEN'
      RETURNING p.*
      `,
      [
        id,
        actor.actorId,
        actor.actorRole,
        body?.note ?? null,
      ],
    );

    if (!r.rows[0]) {
      throw new ConflictException(
        'Kỳ chi phí không còn ở trạng thái OPEN.',
      );
    }

    return {
      ...r.rows[0],
      currency: 'VND',
    };
  }

  async lockPeriod(
    id: string,
    actorId?: string,
    actorRole?: string,
  ) {
    const actor = await this.management(actorId, actorRole);

    const r = await this.db.query(
      `
      UPDATE resident_cost_periods
      SET
        status='LOCKED',
        locked_at=now(),
        locked_by=$2,
        locked_by_role=$3,
        updated_at=now()
      WHERE resident_cost_period_id=$1
        AND status='RECONCILED'
      RETURNING *
      `,
      [id, actor.actorId, actor.actorRole],
    );

    if (!r.rows[0]) {
      throw new ConflictException(
        'Chỉ kỳ RECONCILED mới được khóa.',
      );
    }

    return {
      ...r.rows[0],
      immutable: true,
      currency: 'VND',
    };
  }
}
