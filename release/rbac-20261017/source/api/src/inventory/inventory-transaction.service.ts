import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { InventoryAuthorityService } from './inventory-authority.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import {
  inventoryLimit,
  optionalText,
  positiveQuantity,
  requiredText,
} from './inventory-common';

@Injectable()
export class InventoryTransactionService {
  private readonly inbound = [
    'RECEIPT',
    'ADJUSTMENT_IN',
    'RETURN_IN',
  ];

  private readonly outbound = [
    'ISSUE',
    'ADJUSTMENT_OUT',
    'RETURN_OUT',
  ];

  constructor(
    private readonly database: DatabaseService,
    private readonly authority: InventoryAuthorityService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  async list(actorId: string | undefined, actorRole: string | undefined, query: any) {
    await this.authority.requireActor(actorId, actorRole);

    const limit = inventoryLimit(query?.limit);
    const values: any[] = [];
    const conditions: string[] = [];

    const add = (column: string, value: any) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        values.push(String(value).trim());
        conditions.push(`${column} = $${values.length}`);
      }
    };

    add('inventory_item_id', query?.inventoryItemId);
    add('inventory_lot_id', query?.inventoryLotId);
    add('performed_by', query?.performedBy);
    add('transaction_type', query?.transactionType);
    add('source_domain', query?.sourceDomain);

    if (query?.occurredFrom) {
      values.push(String(query.occurredFrom).trim());
      conditions.push(`occurred_at >= $${values.length}::timestamptz`);
    }

    if (query?.occurredTo) {
      values.push(String(query.occurredTo).trim());
      conditions.push(`occurred_at <= $${values.length}::timestamptz`);
    }

    values.push(limit);

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const result = await this.database.query(
      `
      SELECT *
      FROM inventory_transactions
      ${where}
      ORDER BY occurred_at DESC, inventory_transaction_id DESC
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

  async detail(actorId: string | undefined, actorRole: string | undefined, id: string) {
    await this.authority.requireActor(actorId, actorRole);

    const result = await this.database.query(
      `
      SELECT *
      FROM inventory_transactions
      WHERE inventory_transaction_id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        'Inventory transaction not found',
      );
    }

    return result.rows[0];
  }

  async readBalance(
    actorId: string | undefined,
    actorRole: string | undefined,
    inventoryItemId: string,
    query: any,
  ) {
    await this.authority.requireActor(actorId, actorRole);

    const inventoryLotId =
      optionalText(query?.inventoryLotId);

    return this.database.withTransaction(
      async (client) => {
        const item = await client.query(
          `
          SELECT *
          FROM inventory_items
          WHERE inventory_item_id = $1
          LIMIT 1
          `,
          [inventoryItemId],
        );

        if (!item.rowCount) {
          throw new NotFoundException(
            'Inventory item not found',
          );
        }

        if (inventoryLotId !== null) {
          const lot = await client.query(
            `
            SELECT inventory_lot_id
            FROM inventory_lots
            WHERE inventory_lot_id = $1
              AND inventory_item_id = $2
            LIMIT 1
            `,
            [
              inventoryLotId,
              inventoryItemId,
            ],
          );

          if (!lot.rowCount) {
            throw new NotFoundException(
              'Inventory lot not found for item',
            );
          }
        }

        const balance = await this.ledger.balance(
          client,
          inventoryItemId,
          inventoryLotId,
        );

        return {
          inventory_item_id: inventoryItemId,
          inventory_lot_id: inventoryLotId,
          unit: item.rows[0].base_unit,
          balance: balance.toFixed(4),
          as_of: new Date().toISOString(),
        };
      },
    );
  }

  async create(actorId: string | undefined, actorRole: string | undefined, body: any) {
    const inventoryItemId = requiredText(
      body?.inventoryItemId,
      'inventoryItemId',
    );

    const inventoryLotId =
      optionalText(body?.inventoryLotId);

    const transactionType = requiredText(
      body?.transactionType,
      'transactionType',
    );

    if (
      ![
        ...this.inbound,
        ...this.outbound,
      ].includes(transactionType)
    ) {
      throw new BadRequestException(
        'Invalid transactionType',
      );
    }

    const quantity = positiveQuantity(body?.quantity);
    const unit = requiredText(body?.unit, 'unit');

    const sourceDomain = requiredText(
      body?.sourceDomain,
      'sourceDomain',
    );

    const sourceEntityType =
      optionalText(body?.sourceEntityType);
    const sourceEntityId =
      optionalText(body?.sourceEntityId);

    if (
      (sourceEntityType === null) !==
      (sourceEntityId === null)
    ) {
      throw new BadRequestException(
        'sourceEntityType and sourceEntityId must both be supplied or both be null',
      );
    }

    const id =
      `inventory-transaction-${randomUUID()}`;

    try {
      return await this.database.withTransaction(
        async (client) => {
          const actor =
            await this.authority.requireActor(
              actorId,
              actorRole,
              client,
            );

          /*
           * OPS-2-B generic stock mutation is deliberately restricted.
           * Caregiver/nurse resident-attributed ISSUE belongs to OPS-2-C.
           */
          this.authority.requireAuthority(actor);

          const itemResult = await client.query(
            `
            SELECT *
            FROM inventory_items
            WHERE inventory_item_id = $1
              AND active = true
            LIMIT 1
            `,
            [inventoryItemId],
          );

          if (!itemResult.rowCount) {
            throw new BadRequestException(
              'Active inventory item not found',
            );
          }

          const item: any = itemResult.rows[0];

          if (unit !== item.base_unit) {
            throw new BadRequestException(
              'transaction unit must equal item base_unit',
            );
          }

          if (
            item.lot_tracking_required === true &&
            inventoryLotId === null
          ) {
            throw new BadRequestException(
              'inventoryLotId is required for lot-tracked item',
            );
          }

          let lot: any = null;

          if (inventoryLotId !== null) {
            const lotResult = await client.query(
              `
              SELECT *
              FROM inventory_lots
              WHERE inventory_lot_id = $1
                AND inventory_item_id = $2
              LIMIT 1
              `,
              [
                inventoryLotId,
                inventoryItemId,
              ],
            );

            if (!lotResult.rowCount) {
              throw new BadRequestException(
                'Inventory lot does not belong to item',
              );
            }

            lot = lotResult.rows[0];
          }

          const isOutbound =
            this.outbound.includes(transactionType);

          if (isOutbound && lot !== null) {
            if (lot.status !== 'ACTIVE') {
              throw new BadRequestException(
                'Outbound requires ACTIVE lot',
              );
            }

            if (
              transactionType === 'ISSUE' &&
              lot.expiry_date !== null &&
              new Date(lot.expiry_date).getTime() <
                new Date().setHours(0, 0, 0, 0)
            ) {
              throw new BadRequestException(
                'Expired lot cannot be issued',
              );
            }
          }

          /*
           * Serialize every movement for this accounting key.
           * This also ensures an inbound racing with an outbound cannot
           * produce a stale balance decision.
           */
          await this.ledger.acquireLock(
            client,
            inventoryItemId,
            inventoryLotId,
          );

          const currentBalance =
            await this.ledger.balance(
              client,
              inventoryItemId,
              inventoryLotId,
            );

          const resultingBalance =
            currentBalance +
            this.ledger.signedQuantity(
              transactionType,
              quantity,
            );

          if (
            isOutbound &&
            resultingBalance < 0
          ) {
            throw new ConflictException(
              'Insufficient inventory stock',
            );
          }

          const occurredAt =
            body?.occurredAt === undefined
              ? new Date().toISOString()
              : body.occurredAt;

          const result = await client.query(
            `
            INSERT INTO inventory_transactions (
              inventory_transaction_id,
              inventory_item_id,
              inventory_lot_id,
              transaction_type,
              quantity,
              unit,
              source_domain,
              source_entity_type,
              source_entity_id,
              occurred_at,
              performed_by,
              performed_by_role,
              reason_code,
              note
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              $11,$12,$13,$14
            )
            RETURNING *
            `,
            [
              id,
              inventoryItemId,
              inventoryLotId,
              transactionType,
              quantity,
              unit,
              sourceDomain,
              sourceEntityType,
              sourceEntityId,
              occurredAt,
              actor.actorId,
              actor.actorRole,
              optionalText(body?.reasonCode),
              optionalText(body?.note),
            ],
          );

          return result.rows[0];
        },
      );
    } catch (error: any) {
      if (String(error?.code || '') === '23505') {
        throw new ConflictException(
          'Inventory source transaction already exists',
        );
      }

      throw error;
    }
  }
}
