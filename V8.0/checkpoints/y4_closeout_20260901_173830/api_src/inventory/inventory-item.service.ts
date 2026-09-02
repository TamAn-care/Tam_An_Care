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
  requiredText,
} from './inventory-common';

@Injectable()
export class InventoryItemService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authority: InventoryAuthorityService,
  ) {}

  async list(actorId: string | undefined, actorRole: string | undefined, query: any) {
    await this.authority.requireActor(actorId, actorRole);

    const limit = inventoryLimit(query?.limit);
    const values: any[] = [];
    const conditions: string[] = [];

    if (query?.active !== undefined && query?.active !== '') {
      if (!['true', 'false'].includes(String(query.active))) {
        throw new BadRequestException('active must be true or false');
      }
      values.push(String(query.active) === 'true');
      conditions.push(`active = $${values.length}`);
    }

    if (query?.category) {
      values.push(String(query.category).trim());
      conditions.push(`category = $${values.length}`);
    }

    if (query?.q) {
      values.push(`%${String(query.q).trim()}%`);
      conditions.push(
        `(code ILIKE $${values.length} OR display_name_vi ILIKE $${values.length})`,
      );
    }

    values.push(limit);

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const result = await this.database.query(
      `
      SELECT *
      FROM inventory_items
      ${where}
      ORDER BY code ASC, inventory_item_id ASC
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
      FROM inventory_items
      WHERE inventory_item_id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rowCount) {
      throw new NotFoundException('Inventory item not found');
    }

    return result.rows[0];
  }

  async create(actorId: string | undefined, actorRole: string | undefined, body: any) {
    const actor = await this.authority.requireActor(actorId, actorRole);
    this.authority.requireAuthority(actor);

    const code = requiredText(body?.code, 'code').toUpperCase();
    const displayNameVi = requiredText(
      body?.displayNameVi,
      'displayNameVi',
    );
    const category = requiredText(body?.category, 'category');
    const baseUnit = requiredText(body?.baseUnit, 'baseUnit');

    const lotTrackingRequired =
      body?.lotTrackingRequired === undefined
        ? false
        : body.lotTrackingRequired;

    if (typeof lotTrackingRequired !== 'boolean') {
      throw new BadRequestException(
        'lotTrackingRequired must be boolean',
      );
    }

    const id = `inventory-item-${randomUUID()}`;

    try {
      const result = await this.database.query(
        `
        INSERT INTO inventory_items (
          inventory_item_id,
          code,
          display_name_vi,
          category,
          base_unit,
          active,
          lot_tracking_required
        )
        VALUES ($1,$2,$3,$4,$5,true,$6)
        RETURNING *
        `,
        [
          id,
          code,
          displayNameVi,
          category,
          baseUnit,
          lotTrackingRequired,
        ],
      );

      return result.rows[0];
    } catch (error: any) {
      if (String(error?.code || '') === '23505') {
        throw new ConflictException(
          'Inventory item code already exists',
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

    if (body?.code !== undefined) {
      throw new BadRequestException(
        'Inventory item code is immutable',
      );
    }

    return this.database.withTransaction(async (client) => {
      const current = await client.query(
        `
        SELECT *
        FROM inventory_items
        WHERE inventory_item_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [id],
      );

      if (!current.rowCount) {
        throw new NotFoundException('Inventory item not found');
      }

      const previous: any = current.rows[0];

      const displayNameVi =
        body?.displayNameVi === undefined
          ? previous.display_name_vi
          : requiredText(body.displayNameVi, 'displayNameVi');

      const category =
        body?.category === undefined
          ? previous.category
          : requiredText(body.category, 'category');

      const baseUnit =
        body?.baseUnit === undefined
          ? previous.base_unit
          : requiredText(body.baseUnit, 'baseUnit');

      const active =
        body?.active === undefined
          ? previous.active
          : body.active;

      const lotTrackingRequired =
        body?.lotTrackingRequired === undefined
          ? previous.lot_tracking_required
          : body.lotTrackingRequired;

      if (typeof active !== 'boolean') {
        throw new BadRequestException('active must be boolean');
      }

      if (typeof lotTrackingRequired !== 'boolean') {
        throw new BadRequestException(
          'lotTrackingRequired must be boolean',
        );
      }

      /*
       * Once ledger history exists, changing the canonical accounting
       * unit would reinterpret immutable historical quantities.
       */
      if (baseUnit !== previous.base_unit) {
        const history = await client.query(
          `
          SELECT 1
          FROM inventory_transactions
          WHERE inventory_item_id = $1
          LIMIT 1
          `,
          [id],
        );

        if (history.rowCount) {
          throw new ConflictException(
            'baseUnit cannot change after ledger history exists',
          );
        }
      }

      const result = await client.query(
        `
        UPDATE inventory_items
        SET
          display_name_vi = $2,
          category = $3,
          base_unit = $4,
          active = $5,
          lot_tracking_required = $6,
          updated_at = now()
        WHERE inventory_item_id = $1
        RETURNING *
        `,
        [
          id,
          displayNameVi,
          category,
          baseUnit,
          active,
          lotTrackingRequired,
        ],
      );

      return result.rows[0];
    });
  }
}
