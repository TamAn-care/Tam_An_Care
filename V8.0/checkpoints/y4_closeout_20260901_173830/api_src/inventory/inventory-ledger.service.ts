import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';

@Injectable()
export class InventoryLedgerService {
  lockKey(
    inventoryItemId: string,
    inventoryLotId: string | null,
  ): string {
    return inventoryLotId
      ? `INVENTORY_ITEM_LOT:${inventoryItemId}:${inventoryLotId}`
      : `INVENTORY_ITEM:${inventoryItemId}`;
  }

  async acquireLock(
    client: PoolClient,
    inventoryItemId: string,
    inventoryLotId: string | null,
  ): Promise<void> {
    await client.query(
      `
      SELECT pg_advisory_xact_lock(
        hashtextextended($1::text, 0)
      )
      `,
      [
        this.lockKey(
          inventoryItemId,
          inventoryLotId,
        ),
      ],
    );
  }

  async balance(
    client: PoolClient,
    inventoryItemId: string,
    inventoryLotId: string | null,
  ): Promise<number> {
    const result = await client.query(
      `
      SELECT COALESCE(
        SUM(
          CASE
            WHEN transaction_type IN (
              'RECEIPT',
              'ADJUSTMENT_IN',
              'RETURN_IN'
            )
              THEN quantity
            WHEN transaction_type IN (
              'ISSUE',
              'ADJUSTMENT_OUT',
              'RETURN_OUT'
            )
              THEN -quantity
            ELSE 0
          END
        ),
        0
      ) AS balance
      FROM inventory_transactions
      WHERE inventory_item_id = $1
        AND (
          $2::text IS NULL
          OR inventory_lot_id = $2
        )
      `,
      [
        inventoryItemId,
        inventoryLotId,
      ],
    );

    return Number(result.rows[0]?.balance || 0);
  }

  signedQuantity(
    transactionType: string,
    quantity: number,
  ): number {
    if (
      [
        'RECEIPT',
        'ADJUSTMENT_IN',
        'RETURN_IN',
      ].includes(transactionType)
    ) {
      return quantity;
    }

    return -quantity;
  }
}
