import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
import { StaffActorModule } from '../staff-actors/staff-actor.module';
import { NutritionOperationsController } from './nutrition-operations.controller';
import { NutritionOperationsService } from './nutrition-operations.service';

@Module({
  imports: [DatabaseModule, StaffActorModule, ResidentAccessScopeModule],
  controllers: [NutritionOperationsController],
  providers: [NutritionOperationsService],
})
export class NutritionOperationsModule {}
