import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { InventoryAuthorityService } from './inventory-authority.service';
import {
  inventoryLimit,
  optionalText,
  requiredText,
} from './inventory-common';

@Injectable()
export class InventoryLotService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authority: InventoryAuthorityService,
  ) {}

  async list(actorId: string | undefined, actorRole: string | undefined, query: any) {
    await this.authority.requireActor(actorId, actorRole);

    const limit = inventoryLimit(query?.limit);
    const values: any[] = [];
    const conditions: string[] = [];

    if (query?.inventoryItemId) {
      values.push(String(query.inventoryItemId).trim());
      conditions.push(`inventory_item_id = $${values.length}`);
    }

    if (query?.status) {
      values.push(String(query.status).trim());
      conditions.push(`status = $${values.length}`);
    }

    if (query?.expiryBefore) {
      values.push(String(query.expiryBefore).trim());
      conditions.push(`expiry_date <= $${values.length}::date`);
    }

    values.push(limit);

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const result = await this.database.query(
      `
      SELECT *
      FROM inventory_lots
      ${where}
      ORDER BY expiry_date ASC NULLS LAST, inventory_lot_id ASC
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
      FROM inventory_lots
      WHERE inventory_lot_id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rowCount) {
      throw new NotFoundException('Inventory lot not found');
    }

    return result.rows[0];
  }

  async create(actorId: string | undefined, actorRole: string | undefined, body: any) {
    const actor = await this.authority.requireActor(actorId, actorRole);
    this.authority.requireAuthority(actor);

    const inventoryItemId = requiredText(
      body?.inventoryItemId,
      'inventoryItemId',
    );

    const lotCode = requiredText(body?.lotCode, 'lotCode');
    const status =
      body?.status === undefined
        ? 'ACTIVE'
        : requiredText(body.status, 'status');

    const allowedStatuses = [
      'ACTIVE',
      'QUARANTINED',
      'EXHAUSTED',
      'CLOSED',
    ];

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('Invalid lot status');
    }

    const item = await this.database.query(
      `
      SELECT inventory_item_id
      FROM inventory_items
      WHERE inventory_item_id = $1
      LIMIT 1
      `,
      [inventoryItemId],
    );

    if (!item.rowCount) {
      throw new BadRequestException('Inventory item not found');
    }

    const id = `inventory-lot-${randomUUID()}`;

    try {
      const result = await this.database.query(
        `
        INSERT INTO inventory_lots (
          inventory_lot_id,
          inventory_item_id,
          lot_code,
          supplier_reference,
          received_at,
          expiry_date,
          status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          id,
          inventoryItemId,
          lotCode,
          optionalText(body?.supplierReference),
          optionalText(body?.receivedDate),
          optionalText(body?.expiryDate),
          status,
        ],
      );

      return result.rows[0];
    } catch (error: any) {
      if (String(error?.code || '') === '23505') {
        throw new ConflictException(
          'Inventory lot already exists',
        );
      }
      throw error;
    }
  }

  async update(
    actorId: string | undefined,
    actorRole: string | undefined,
    id: string,
    body: any,
  ) {
    const actor = await this.authority.requireActor(actorId, actorRole);
    this.authority.requireAuthority(actor);

    if (
      body?.inventoryItemId !== undefined ||
      body?.inventory_item_id !== undefined
    ) {
      throw new BadRequestException(
        'inventoryItemId is immutable',
      );
    }

    return this.database.withTransaction(async (client) => {
      const current = await client.query(
        `
        SELECT *
        FROM inventory_lots
        WHERE inventory_lot_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [id],
      );

      if (!current.rowCount) {
        throw new NotFoundException('Inventory lot not found');
      }

      const previous: any = current.rows[0];

      const lotCode =
        body?.lotCode === undefined
          ? previous.lot_code
          : requiredText(body.lotCode, 'lotCode');

      const status =
        body?.status === undefined
          ? previous.status
          : requiredText(body.status, 'status');

      if (
        ![
          'ACTIVE',
          'QUARANTINED',
          'EXHAUSTED',
          'CLOSED',
        ].includes(status)
      ) {
        throw new BadRequestException('Invalid lot status');
      }

      try {
        const result = await client.query(
          `
          UPDATE inventory_lots
          SET
            lot_code = $2,
            supplier_reference = $3,
            received_at = $4,
            expiry_date = $5,
            status = $6
          WHERE inventory_lot_id = $1
          RETURNING *
          `,
          [
            id,
            lotCode,
            body?.supplierReference === undefined
              ? previous.supplier_reference
              : optionalText(body.supplierReference),
            body?.receivedDate === undefined
              ? previous.received_at
              : optionalText(body.receivedDate),
            body?.expiryDate === undefined
              ? previous.expiry_date
              : optionalText(body.expiryDate),
            status,
          ],
        );

        return result.rows[0];
      } catch (error: any) {
        if (String(error?.code || '') === '23505') {
          throw new ConflictException(
            'Inventory lot already exists',
          );
        }
        throw error;
      }
    });
  }
}
