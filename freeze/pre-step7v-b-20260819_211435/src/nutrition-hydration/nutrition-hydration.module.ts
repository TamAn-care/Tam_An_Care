import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
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
  imports: [DatabaseModule],
  controllers: [NutritionHydrationController],
  providers: [
    NutritionHydrationAuthorizationService,
    NutritionHydrationService,
  ],
  exports: [
    NutritionHydrationService,
  ],
})
export class NutritionHydrationModule {}
