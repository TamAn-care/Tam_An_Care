import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { DatabaseService } from '../database/database.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import {
  ResidentAccessHumanRole,
  ResidentAccessScopeService,
} from '../resident-access-scope/resident-access-scope.service';

export type ResidentConsumptionRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR';

export type CreateResidentConsumptionInput = {
  residentId: string;
  inventoryItemId: string;
  inventoryLotId?: string | null;
  quantity: number;
  unit: string;
  sourceType: string;
  sourceId: string;
  note?: string | null;
};

export type ResidentConsumptionActor = {
  actorId: string;
  actorRole: ResidentConsumptionRole;
};

type InventoryItemRow = {
  inventory_item_id: string;
  base_unit: string;
  active: boolean;
  lot_tracking_required: boolean;
};

type InventoryLotRow = {
  inventory_lot_id: string;
  inventory_item_id: string;
  expiry_date: string | null;
  status: string;
};

@Injectable()
export class ResidentConsumptionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly residentAccess: ResidentAccessScopeService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  async create(
    input: CreateResidentConsumptionInput,
    actor: ResidentConsumptionActor,
  ) {
    const residentId = String(input?.residentId ?? '').trim();
    const inventoryItemId =
      String(input?.inventoryItemId ?? '').trim();
    const inventoryLotId =
      input?.inventoryLotId == null
        ? null
        : String(input.inventoryLotId).trim() || null;
    const unit = String(input?.unit ?? '').trim();
    const sourceType = String(input?.sourceType ?? '').trim();
    const sourceId = String(input?.sourceId ?? '').trim();
    const note =
      input?.note == null
        ? null
        : String(input.note).trim() || null;
    const quantity = Number(input?.quantity);

    const actorId = String(actor?.actorId ?? '').trim();
    const actorRole = actor?.actorRole;

    if (
      !residentId ||
      !inventoryItemId ||
      !unit ||
      !sourceType ||
      !sourceId ||
      !actorId
    ) {
      throw new BadRequestException(
        'Resident consumption requires resident, item, unit, source, and human actor',
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'Quantity must be greater than zero',
      );
    }

    if (
      actorRole !== 'CAREGIVER' &&
      actorRole !== 'NURSE' &&
      actorRole !== 'SUPERVISOR'
    ) {
      throw new ForbiddenException(
        'Resident consumption authority is required',
      );
    }

    const canAccess =
      await this.residentAccess.canAccessResident(
        actorId,
        actorRole as ResidentAccessHumanRole,
        residentId,
      );

    if (!canAccess) {
      throw new ForbiddenException(
        'Resident access is required',
      );
    }

    return this.db.withTransaction(async (client) => {
      /*
       * Reuse the accepted inventory ledger accounting lock.
       * No application-memory mutex and no second stock ledger.
       */
      await this.ledger.acquireLock(
        client,
        inventoryItemId,
        inventoryLotId,
      );

      const itemResult =
        await client.query<InventoryItemRow>(
          `
            SELECT
              inventory_item_id,
              base_unit,
              active,
              lot_tracking_required
            FROM inventory_items
            WHERE inventory_item_id = $1
            LIMIT 1
          `,
          [
            inventoryItemId,
          ],
        );

      const item = itemResult.rows[0];

      if (!item) {
        throw new NotFoundException(
          'Inventory item not found',
        );
      }

      if (!item.active) {
        throw new BadRequestException(
          'Inventory item is inactive',
        );
      }

      if (item.base_unit !== unit) {
        throw new BadRequestException(
          'Inventory transaction unit must equal item base unit',
        );
      }

      if (
        item.lot_tracking_required === true &&
        !inventoryLotId
      ) {
        throw new BadRequestException(
          'Inventory lot is required for lot-tracked item',
        );
      }

      if (inventoryLotId) {
        const lotResult =
          await client.query<InventoryLotRow>(
            `
              SELECT
                inventory_lot_id,
                inventory_item_id,
                expiry_date,
                status
              FROM inventory_lots
              WHERE inventory_lot_id = $1
              LIMIT 1
            `,
            [
              inventoryLotId,
            ],
          );

        const lot = lotResult.rows[0];

        if (!lot) {
          throw new NotFoundException(
            'Inventory lot not found',
          );
        }

        if (lot.inventory_item_id !== inventoryItemId) {
          throw new BadRequestException(
            'Inventory lot does not belong to inventory item',
          );
        }

        if (lot.status !== 'ACTIVE') {
          throw new BadRequestException(
            'Inventory lot is not active',
          );
        }

        if (
          lot.expiry_date &&
          new Date(lot.expiry_date).getTime() <
            new Date().setHours(0, 0, 0, 0)
        ) {
          throw new BadRequestException(
            'Expired inventory lot cannot be issued',
          );
        }
      }

      /*
       * Source-backed idempotency is checked inside the same
       * transaction before stock calculation.
       */
      const duplicateResult =
        await client.query(
          `
            SELECT 1
            FROM inventory_transactions
            WHERE
              source_domain = 'RESIDENT_CONSUMPTION'
              AND source_entity_type = $1
              AND source_entity_id = $2
              AND inventory_item_id = $3
              AND COALESCE(inventory_lot_id, '') =
                  COALESCE($4::text, '')
            LIMIT 1
          `,
          [
            sourceType,
            sourceId,
            inventoryItemId,
            inventoryLotId,
          ],
        );

      if (duplicateResult.rowCount) {
        throw new ConflictException(
          'Duplicate inventory transaction source',
        );
      }

      const balance =
        await this.ledger.balance(
          client,
          inventoryItemId,
          inventoryLotId,
        );

      if (balance < quantity) {
        throw new ConflictException(
          'Inventory issue would create negative stock',
        );
      }

      const occurredAt = new Date();
      const transactionId = randomUUID();
      const consumptionEventId = randomUUID();

      await client.query(
        `
          INSERT INTO inventory_transactions (
            inventory_transaction_id,
            inventory_item_id,
            inventory_lot_id,
            transaction_type,
            quantity,
            unit,
            occurred_at,
            performed_by,
            performed_by_role,
            source_domain,
            source_entity_type,
            source_entity_id,
            note
          )
          VALUES (
            $1,
            $2,
            $3,
            'ISSUE',
            $4,
            $5,
            $6,
            $7,
            $8,
            'RESIDENT_CONSUMPTION',
            $9,
            $10,
            $11
          )
        `,
        [
          transactionId,
          inventoryItemId,
          inventoryLotId,
          quantity,
          unit,
          occurredAt,
          actorId,
          actorRole,
          sourceType,
          sourceId,
          note,
        ],
      );

      await client.query(
        `
          INSERT INTO resident_consumption_events (
            resident_consumption_event_id,
            resident_id,
            inventory_item_id,
            inventory_lot_id,
            inventory_transaction_id,
            work_event_id,
            quantity,
            unit,
            occurred_at,
            recorded_by,
            recorded_by_role,
            source_domain,
            source_entity_type,
            source_entity_id,
            note
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            NULL,
            $6,
            $7,
            $8,
            $9,
            $10,
            'RESIDENT_CONSUMPTION',
            $11,
            $12,
            $13
          )
        `,
        [
          consumptionEventId,
          residentId,
          inventoryItemId,
          inventoryLotId,
          transactionId,
          quantity,
          unit,
          occurredAt,
          actorId,
          actorRole,
          sourceType,
          sourceId,
          note,
        ],
      );

      return {
        residentConsumptionEventId:
          consumptionEventId,
        residentId,
        inventoryItemId,
        inventoryLotId,
        inventoryTransactionId:
          transactionId,
        transactionType: 'ISSUE' as const,
        quantity,
        unit,
        occurredAt:
          occurredAt.toISOString(),
        recordedBy: actorId,
        recordedByRole: actorRole,
        sourceType,
        sourceId,
        note,
      };
    });
  }
}
