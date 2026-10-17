import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InventoryAuthorityService } from './inventory-authority.service';
import { InventoryController } from './inventory.controller';
import { InventoryItemService } from './inventory-item.service';
import { InventoryKpiService } from './inventory-kpi.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryLotService } from './inventory-lot.service';
import { InventoryTransactionService } from './inventory-transaction.service';

import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
import { ResidentConsumptionService } from './resident-consumption.service';

@Module({
  imports: [
    ResidentAccessScopeModule,
    DatabaseModule,
  ],
  controllers: [
    InventoryController,
  ],
  providers: [
    ResidentConsumptionService,
    InventoryKpiService,
    InventoryAuthorityService,
    InventoryItemService,
    InventoryLotService,
    InventoryLedgerService,
    InventoryTransactionService,
  ],
  exports: [
    InventoryAuthorityService,
    InventoryItemService,
    InventoryLotService,
    InventoryLedgerService,
    InventoryTransactionService,
  ],
})
export class InventoryModule {}
