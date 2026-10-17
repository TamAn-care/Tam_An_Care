import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { InventoryAuthorityService } from '../inventory/inventory-authority.service';

type ReceivingStatus =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'QUARANTINED';

interface CreateReceivingInput {
  inventoryTransactionId?: string | null;
  inventoryItemId: string;
  inventoryLotId?: string | null;
  receivingStatus: ReceivingStatus;
  quantity: number;
  unit: string;
  receivedAt: string;
  note?: string | null;
}

@Injectable()
export class KitchenOperationsService {
  private readonly defaultLimit = 50;
  private readonly maxLimit = 100;

  constructor(
    private readonly db: DatabaseService,
    private readonly inventoryAuthority: InventoryAuthorityService,
  ) {}

  private boundedLimit(value?: string | number): number {
    if (value === undefined || value === null || value === '') {
      return this.defaultLimit;
    }

    const n = Number(value);

    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException('Invalid limit');
    }

    return Math.min(n, this.maxLimit);
  }

  private boundedOffset(value?: string | number): number {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const n = Number(value);

    if (!Number.isInteger(n) || n < 0) {
      throw new BadRequestException('Invalid offset');
    }

    return n;
  }

  private async requireManagement(
    actorId?: string,
    actorRole?: string,
  ) {
    const actor = await this.inventoryAuthority.requireActor(
      actorId,
      actorRole,
    );

    this.inventoryAuthority.requireAuthority(actor);

    return actor;
  }

  async createReceivingEvent(
    actorId: string | undefined,
    actorRole: string | undefined,
    input: CreateReceivingInput,
  ) {
    const actor =
      await this.requireManagement(actorId, actorRole);

    if (!input?.inventoryItemId?.trim()) {
      throw new BadRequestException(
        'inventoryItemId is required',
      );
    }

    if (
      !['ACCEPTED', 'REJECTED', 'QUARANTINED']
        .includes(input.receivingStatus)
    ) {
      throw new BadRequestException(
        'Invalid receivingStatus',
      );
    }

    const quantity = Number(input.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'quantity must be greater than zero',
      );
    }

    const unit = String(input.unit || '').trim();

    if (!unit) {
      throw new BadRequestException('unit is required');
    }

    const receivedAt =
      new Date(input.receivedAt);

    if (
      !input.receivedAt ||
      Number.isNaN(receivedAt.getTime())
    ) {
      throw new BadRequestException(
        'receivedAt is invalid',
      );
    }

    const txId =
      input.inventoryTransactionId?.trim() || null;

    const lotId =
      input.inventoryLotId?.trim() || null;

    if (
      input.receivingStatus === 'ACCEPTED' &&
      !txId
    ) {
      throw new BadRequestException(
        'ACCEPTED receiving requires inventoryTransactionId',
      );
    }

    if (
      input.receivingStatus !== 'ACCEPTED' &&
      txId
    ) {
      throw new BadRequestException(
        'Non-accepted receiving must not reference an inventory transaction',
      );
    }

    const itemResult =
      await this.db.query<{
        inventory_item_id: string;
        base_unit: string;
        active: boolean;
      }>(
        `
          SELECT
            inventory_item_id,
            base_unit,
            active
          FROM inventory_items
          WHERE inventory_item_id = $1
          LIMIT 1
        `,
        [input.inventoryItemId],
      );

    const item = itemResult.rows[0];

    if (!item || !item.active) {
      throw new NotFoundException(
        'Active inventory item not found',
      );
    }

    if (item.base_unit !== unit) {
      throw new BadRequestException(
        'Receiving unit must match inventory item base unit',
      );
    }

    if (lotId) {
      const lotResult =
        await this.db.query<{
          inventory_lot_id: string;
        }>(
          `
            SELECT inventory_lot_id
            FROM inventory_lots
            WHERE inventory_lot_id = $1
              AND inventory_item_id = $2
            LIMIT 1
          `,
          [lotId, input.inventoryItemId],
        );

      if (!lotResult.rows[0]) {
        throw new BadRequestException(
          'Inventory lot does not belong to item',
        );
      }
    }

    if (input.receivingStatus === 'ACCEPTED') {
      const txResult =
        await this.db.query<{
          inventory_transaction_id: string;
          inventory_item_id: string;
          inventory_lot_id: string | null;
          transaction_type: string;
          quantity: string;
          unit: string;
        }>(
          `
            SELECT
              inventory_transaction_id,
              inventory_item_id,
              inventory_lot_id,
              transaction_type,
              quantity::text AS quantity,
              unit
            FROM inventory_transactions
            WHERE inventory_transaction_id = $1
            LIMIT 1
          `,
          [txId],
        );

      const tx = txResult.rows[0];

      if (!tx) {
        throw new BadRequestException(
          'Inventory transaction not found',
        );
      }

      if (tx.transaction_type !== 'RECEIPT') {
        throw new BadRequestException(
          'Food receiving requires RECEIPT inventory transaction',
        );
      }

      if (
        tx.inventory_item_id !==
        input.inventoryItemId
      ) {
        throw new BadRequestException(
          'Inventory transaction item mismatch',
        );
      }

      if ((tx.inventory_lot_id || null) !== lotId) {
        throw new BadRequestException(
          'Inventory transaction lot mismatch',
        );
      }

      if (Number(tx.quantity) !== quantity) {
        throw new BadRequestException(
          'Inventory transaction quantity mismatch',
        );
      }

      if (tx.unit !== unit) {
        throw new BadRequestException(
          'Inventory transaction unit mismatch',
        );
      }
    }

    const id =
      `food-receiving-${randomUUID()}`;

    try {
      const result =
        await this.db.query(
          `
            INSERT INTO food_receiving_events (
              food_receiving_event_id,
              inventory_transaction_id,
              inventory_item_id,
              inventory_lot_id,
              receiving_status,
              quantity,
              unit,
              received_at,
              received_by,
              received_by_role,
              note
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            )
            RETURNING *
          `,
          [
            id,
            txId,
            input.inventoryItemId,
            lotId,
            input.receivingStatus,
            quantity,
            unit,
            receivedAt.toISOString(),
            actor.actorId,
            actor.actorRole,
            input.note?.trim() || null,
          ],
        );

      return result.rows[0];
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException(
          'Inventory receipt already has food receiving evidence',
        );
      }

      throw error;
    }
  }

  async listReceivingEvents(
    actorId?: string,
    actorRole?: string,
    limitInput?: string,
    offsetInput?: string,
  ) {
    await this.requireManagement(actorId, actorRole);

    const limit = this.boundedLimit(limitInput);
    const offset = this.boundedOffset(offsetInput);

    const result =
      await this.db.query(
        `
          SELECT
            e.*,
            i.code AS inventory_item_code,
            i.display_name_vi AS inventory_item_name_vi
          FROM food_receiving_events e
          JOIN inventory_items i
            ON i.inventory_item_id =
               e.inventory_item_id
          ORDER BY
            e.received_at DESC,
            e.food_receiving_event_id DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      );

    return {
      items: result.rows,
      limit,
      offset,
    };
  }

  async inventoryView(
    actorId?: string,
    actorRole?: string,
    limitInput?: string,
    offsetInput?: string,
  ) {
    await this.requireManagement(actorId, actorRole);

    const limit = this.boundedLimit(limitInput);
    const offset = this.boundedOffset(offsetInput);

    const result =
      await this.db.query(
        `
          SELECT
            i.inventory_item_id,
            i.code,
            i.display_name_vi,
            i.category,
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
            )::text AS quantity_on_hand
          FROM inventory_items i
          LEFT JOIN inventory_transactions t
            ON t.inventory_item_id =
               i.inventory_item_id
          WHERE i.active = true
          GROUP BY
            i.inventory_item_id,
            i.code,
            i.display_name_vi,
            i.category,
            i.base_unit
          ORDER BY
            i.display_name_vi,
            i.inventory_item_id
          LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      );

    return {
      items: result.rows,
      authoritativeBalance:
        'DERIVED_FROM_INVENTORY_TRANSACTIONS',
      limit,
      offset,
    };
  }

  async mealProductionView(
    actorId?: string,
    actorRole?: string,
    limitInput?: string,
    offsetInput?: string,
  ) {
    await this.requireManagement(actorId, actorRole);

    const limit = this.boundedLimit(limitInput);
    const offset = this.boundedOffset(offsetInput);

    const result =
      await this.db.query(
        `
          SELECT *
          FROM meal_schedules
          ORDER BY 1 DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      );

    return {
      items: result.rows,
      nutritionAuthority:
        'EXISTING_NUTRITION_DOMAIN',
      limit,
      offset,
    };
  }
}
