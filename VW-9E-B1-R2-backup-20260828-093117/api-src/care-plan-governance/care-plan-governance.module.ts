import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  CarePlanAuthorizationModule,
} from '../care-plan-authorization/care-plan-authorization.module';

import {
  CarePlanGovernanceController,
} from './care-plan-governance.controller';

import {
  CarePlanGovernanceService,
} from './care-plan-governance.service';


@Module({
  imports: [
    DatabaseModule,
    CarePlanAuthorizationModule,
  ],

  controllers: [
    CarePlanGovernanceController,
  ],

  providers: [
    CarePlanGovernanceService,
  ],
})
export class CarePlanGovernanceModule {}
