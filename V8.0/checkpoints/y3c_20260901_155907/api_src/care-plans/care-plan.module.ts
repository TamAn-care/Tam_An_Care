import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  CarePlanRepository,
} from './care-plan.repository';

import {
  CarePlanService,
} from './care-plan.service';

@Module({
  imports: [
    DatabaseModule,
  ],

  providers: [
    CarePlanRepository,
    CarePlanService,
  ],

  exports: [
    CarePlanRepository,
    CarePlanService,
  ],
})
export class CarePlanModule {}
