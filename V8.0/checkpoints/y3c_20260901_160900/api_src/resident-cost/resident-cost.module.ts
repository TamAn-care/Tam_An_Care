import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ResidentCostController } from './resident-cost.controller';
import { ResidentCostService } from './resident-cost.service';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
  ],
  controllers: [ResidentCostController],
  providers: [ResidentCostService],
  exports: [ResidentCostService],
})
export class ResidentCostModule {}
