import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StaffActorModule } from '../staff-actors/staff-actor.module';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
import { ResidentMealRegistrationController } from './resident-meal-registration.controller';
import { ResidentMealRegistrationService } from './resident-meal-registration.service';
import { InventoryModule } from '../inventory/inventory.module';
import { KitchenOperationsController } from './kitchen-operations.controller';
import { KitchenOperationsService } from './kitchen-operations.service';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
    StaffActorModule,
    ResidentAccessScopeModule,
  ],
  controllers: [
    KitchenOperationsController,
    ResidentMealRegistrationController,
  ],
  providers: [
    KitchenOperationsService,
    ResidentMealRegistrationService,
  ],
})
export class KitchenOperationsModule {}
