import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
import { FamilyMealController } from './family-meal.controller';
import { FamilyMealService } from './family-meal.service';
import {
  NutritionHydrationAuthorizationService,
} from './nutrition-hydration-authorization.service';
import {
  NutritionHydrationController,
} from './nutrition-hydration.controller';
import {
  NutritionHydrationService,
} from './nutrition-hydration.service';

@Module({
  imports: [DatabaseModule, ResidentAccessScopeModule],
  controllers: [NutritionHydrationController, FamilyMealController],
  providers: [
    NutritionHydrationAuthorizationService,
    NutritionHydrationService,
    FamilyMealService,
  ],
  exports: [
    NutritionHydrationService,
  ],
})
export class NutritionHydrationModule {}
