import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InventoryAuthorityService } from './inventory-authority.service';
import { InventoryController } from './inventory.controller';
import { InventoryItemService } from './inventory-item.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryLotService } from './inventory-lot.service';
import { InventoryTransactionService } from './inventory-transaction.service';

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [
    InventoryController,
  ],
  providers: [
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
