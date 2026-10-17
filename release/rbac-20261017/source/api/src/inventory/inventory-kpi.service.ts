import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ResidentAccessScopeService,
} from '../resident-access-scope/resident-access-scope.service';

type KpiRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'CARE_MANAGER'
  | 'SUPERVISOR';

type Actor = {
  actorId: string;
  actorRole: KpiRole;
};

@Injectable()
export class InventoryKpiService {
  private readonly defaultTopLimit = 10;
  private readonly maxTopLimit = 100;
  private readonly maxWindowDays = 366;

  constructor(
    private readonly db: DatabaseService,
    private readonly residentAccessScope:
      ResidentAccessScopeService,
  ) {}

  private actor(
    actorIdInput?: string,
    actorRoleInput?: string,
  ): Actor {
    const actorId =
      String(actorIdInput ?? '').trim();

    const actorRole =
      String(actorRoleInput ?? '')
        .trim()
        .toUpperCase() as KpiRole;

    if (!actorId || !actorRole) {
      throw new ForbiddenException(
        'Authenticated human actor is required',
      );
    }

    if (
      ![
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ].includes(actorRole)
    ) {
      throw new ForbiddenException(
        'Role is not authorized for KPI visibility',
      );
    }

    return {
      actorId,
      actorRole,
    };
  }

  private managementActor(
    actorIdInput?: string,
    actorRoleInput?: string,
  ): Actor {
    const actor =
      this.actor(
        actorIdInput,
        actorRoleInput,
      );

    if (
      ![
        'CARE_MANAGER',
        'SUPERVISOR',
      ].includes(actor.actorRole)
    ) {
      throw new ForbiddenException(
        'Global inventory KPI requires CARE_MANAGER or SUPERVISOR',
      );
    }

    return actor;
  }

  private date(
    input: unknown,
    name: string,
  ): Date {
    const value =
      String(input ?? '').trim();

    if (!value) {
      throw new BadRequestException(
        `${name} is required`,
      );
    }

    const parsed =
      new Date(value);

    if (
      Number.isNaN(
        parsed.getTime(),
      )
    ) {
      throw new BadRequestException(
        `${name} must be a valid date/time`,
      );
    }

    return parsed;
  }

  private window(
    query: any,
  ): {
    from: Date;
    to: Date;
  } {
    const from =
      this.date(
        query?.from,
        'from',
      );

    const to =
      this.date(
        query?.to,
        'to',
      );

    if (
      from.getTime() >=
      to.getTime()
    ) {
      throw new BadRequestException(
        'from must be earlier than to',
      );
    }

    const days =
      (
        to.getTime() -
        from.getTime()
      ) /
      86400000;

    if (
      days >
      this.maxWindowDays
    ) {
      throw new BadRequestException(
        `time window cannot exceed ${this.maxWindowDays} days`,
      );
    }

    return {
      from,
      to,
    };
  }

  private topLimit(
    input: unknown,
  ): number {
    if (
      input === undefined ||
      input === null ||
      String(input).trim() === ''
    ) {
      return this.defaultTopLimit;
    }

    const parsed =
      Number(input);

    if (
      !Number.isInteger(parsed) ||
      parsed < 1
    ) {
      throw new BadRequestException(
        'limit must be a positive integer',
      );
    }

    return Math.min(
      parsed,
      this.maxTopLimit,
    );
  }

  async inventorySummary(
    actorIdInput?: string,
    actorRoleInput?: string,
  ) {
    const actor =
      this.managementActor(
        actorIdInput,
        actorRoleInput,
      );

    const result =
      await this.db.query(
        `
        WITH item_balance AS (
          SELECT
            i.inventory_item_id,
            i.code,
            i.display_name_vi,
            i.base_unit,
            i.active,
            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type IN (
                    'RECEIPT',
                    'ADJUSTMENT_IN',
                    'RETURN_IN'
                  )
                    THEN t.quantity
                  WHEN t.transaction_type IN (
                    'ISSUE',
                    'ADJUSTMENT_OUT',
                    'RETURN_OUT'
                  )
                    THEN -t.quantity
                  ELSE 0
                END
              ),
              0
            ) AS balance
          FROM inventory_items i
          LEFT JOIN inventory_transactions t
            ON t.inventory_item_id =
               i.inventory_item_id
          GROUP BY
            i.inventory_item_id,
            i.code,
            i.display_name_vi,
            i.base_unit,
            i.active
        )
        SELECT
          (
            SELECT COUNT(*)::text
            FROM inventory_items
            WHERE active = true
          ) AS active_inventory_items,

          (
            SELECT COUNT(*)::text
            FROM item_balance
            WHERE active = true
              AND balance <= 0
          ) AS low_or_zero_stock_items,

          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'unit',
                  grouped.base_unit,
                  'quantity',
                  grouped.quantity
                )
                ORDER BY grouped.base_unit
              )
              FROM (
                SELECT
                  base_unit,
                  SUM(balance) AS quantity
                FROM item_balance
                WHERE active = true
                GROUP BY base_unit
              ) grouped
            ),
            '[]'::json
          ) AS stock_on_hand_by_unit
        `,
      );

    const row =
      result.rows[0] ?? {};

    return {
      actor: {
        actorId:
          actor.actorId,
        actorRole:
          actor.actorRole,
      },

      activeInventoryItems:
        Number(
          row.active_inventory_items ??
          0,
        ),

      lowOrZeroStockItems:
        Number(
          row.low_or_zero_stock_items ??
          0,
        ),

      stockOnHandByUnit:
        row.stock_on_hand_by_unit ??
        [],
    };
  }

  async lotVisibility(
    actorIdInput?: string,
    actorRoleInput?: string,
    query?: any,
  ) {
    this.managementActor(
      actorIdInput,
      actorRoleInput,
    );

    const from =
      this.date(
        query?.from,
        'from',
      );

    const to =
      this.date(
        query?.to,
        'to',
      );

    if (
      from.getTime() >=
      to.getTime()
    ) {
      throw new BadRequestException(
        'from must be earlier than to',
      );
    }

    const result =
      await this.db.query(
        `
        WITH lot_balance AS (
          SELECT
            l.inventory_lot_id,
            l.inventory_item_id,
            l.lot_code,
            l.expiry_date,
            l.status,
            i.code AS item_code,
            i.display_name_vi,
            i.base_unit,
            COALESCE(
              SUM(
                CASE
                  WHEN t.transaction_type IN (
                    'RECEIPT',
                    'ADJUSTMENT_IN',
                    'RETURN_IN'
                  )
                    THEN t.quantity
                  WHEN t.transaction_type IN (
                    'ISSUE',
                    'ADJUSTMENT_OUT',
                    'RETURN_OUT'
                  )
                    THEN -t.quantity
                  ELSE 0
                END
              ),
              0
            ) AS balance
          FROM inventory_lots l
          JOIN inventory_items i
            ON i.inventory_item_id =
               l.inventory_item_id
          LEFT JOIN inventory_transactions t
            ON t.inventory_lot_id =
               l.inventory_lot_id
          GROUP BY
            l.inventory_lot_id,
            l.inventory_item_id,
            l.lot_code,
            l.expiry_date,
            l.status,
            i.code,
            i.display_name_vi,
            i.base_unit
        )
        SELECT
          COALESCE(
            json_agg(
              json_build_object(
                'inventoryLotId',
                inventory_lot_id,
                'inventoryItemId',
                inventory_item_id,
                'itemCode',
                item_code,
                'displayName',
                display_name_vi,
                'lotCode',
                lot_code,
                'expiryDate',
                expiry_date,
                'balance',
                balance,
                'unit',
                base_unit
              )
              ORDER BY
                expiry_date ASC,
                inventory_lot_id ASC
            )
            FILTER (
              WHERE
                status = 'ACTIVE'
                AND balance > 0
                AND expiry_date >= $1::date
                AND expiry_date < $2::date
            ),
            '[]'::json
          ) AS expiring_lots,

          COALESCE(
            json_agg(
              json_build_object(
                'inventoryLotId',
                inventory_lot_id,
                'inventoryItemId',
                inventory_item_id,
                'itemCode',
                item_code,
                'displayName',
                display_name_vi,
                'lotCode',
                lot_code,
                'expiryDate',
                expiry_date,
                'balance',
                balance,
                'unit',
                base_unit
              )
              ORDER BY
                expiry_date ASC,
                inventory_lot_id ASC
            )
            FILTER (
              WHERE
                status = 'ACTIVE'
                AND balance > 0
                AND expiry_date <
                    CURRENT_DATE
            ),
            '[]'::json
          ) AS expired_lots_with_stock
        FROM lot_balance
        `,
        [
          from,
          to,
        ],
      );

    return {
      from:
        from.toISOString(),
      to:
        to.toISOString(),

      expiringLots:
        result.rows[0]
          ?.expiring_lots ??
        [],

      expiredLotsWithStock:
        result.rows[0]
          ?.expired_lots_with_stock ??
        [],
    };
  }

  async consumption(
    actorIdInput?: string,
    actorRoleInput?: string,
    query?: any,
  ) {
    const actor =
      this.actor(
        actorIdInput,
        actorRoleInput,
      );

    const {
      from,
      to,
    } =
      this.window(query);

    const limit =
      this.topLimit(
        query?.limit,
      );

    let scopeSql =
      'TRUE';

    let scopeParams:
      unknown[] = [];

    if (
      actor.actorRole ===
        'CAREGIVER' ||
      actor.actorRole ===
        'NURSE'
    ) {
      const scope =
        this.residentAccessScope
          .sqlPredicate(
            'r',
            actor.actorId,
            actor.actorRole,
            3,
          );

      scopeSql =
        scope.sql;

      scopeParams =
        scope.params;
    }

    const params = [
      from,
      to,
      ...scopeParams,
      limit,
    ];

    const limitParameter =
      params.length;

    const result =
      await this.db.query(
        `
        WITH scoped AS (
          SELECT
            rce.inventory_item_id,
            rce.quantity
          FROM resident_consumption_events rce
          JOIN residents r
            ON r.resident_id =
               rce.resident_id
          WHERE
            rce.occurred_at >= $1
            AND rce.occurred_at < $2
            AND ${scopeSql}
        ),
        totals AS (
          SELECT
            COALESCE(
              SUM(quantity),
              0
            ) AS total_quantity,
            COUNT(*) AS event_count
          FROM scoped
        ),
        top_items AS (
          SELECT
            s.inventory_item_id,
            i.code,
            i.display_name_vi,
            i.base_unit,
            SUM(s.quantity) AS quantity,
            COUNT(*) AS event_count
          FROM scoped s
          JOIN inventory_items i
            ON i.inventory_item_id =
               s.inventory_item_id
          GROUP BY
            s.inventory_item_id,
            i.code,
            i.display_name_vi,
            i.base_unit
          ORDER BY
            SUM(s.quantity) DESC,
            s.inventory_item_id ASC
          LIMIT $${limitParameter}
        )
        SELECT
          totals.total_quantity,
          totals.event_count,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'inventoryItemId',
                  inventory_item_id,
                  'code',
                  code,
                  'displayName',
                  display_name_vi,
                  'unit',
                  base_unit,
                  'quantity',
                  quantity,
                  'eventCount',
                  event_count
                )
                ORDER BY
                  quantity DESC,
                  inventory_item_id ASC
              )
              FROM top_items
            ),
            '[]'::json
          ) AS top_consumed_items
        FROM totals
        `,
        params,
      );

    const row =
      result.rows[0] ?? {};

    return {
      from:
        from.toISOString(),
      to:
        to.toISOString(),
      limit,

      residentScopeApplied:
        actor.actorRole ===
          'CAREGIVER' ||
        actor.actorRole ===
          'NURSE',

      consumptionQuantity:
        Number(
          row.total_quantity ??
          0,
        ),

      consumptionEventCount:
        Number(
          row.event_count ??
          0,
        ),

      topConsumedItems:
        row.top_consumed_items ??
        [],
    };
  }
}
