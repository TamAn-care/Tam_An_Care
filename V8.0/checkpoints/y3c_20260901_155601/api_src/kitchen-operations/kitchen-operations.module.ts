import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InventoryModule } from '../inventory/inventory.module';
import { KitchenOperationsController } from './kitchen-operations.controller';
import { KitchenOperationsService } from './kitchen-operations.service';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
  ],
  controllers: [
    KitchenOperationsController,
  ],
  providers: [
    KitchenOperationsService,
  ],
})
export class KitchenOperationsModule {}
