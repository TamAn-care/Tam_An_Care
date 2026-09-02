import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  CareActionRepository,
} from '../care-actions/care-action.repository';

import {
  CareActionService,
} from '../care-actions/care-action.service';

import {
  ResponsibilityAcceptanceController,
} from './responsibility-acceptance.controller';

import {
  ResponsibilityAcceptanceService,
} from './responsibility-acceptance.service';

import { StartReviewAuthorizationModule } from '../start-review-authorization/start-review-authorization.module';


import {
  ResolutionAuthorizationModule,
} from '../resolution-authorization/resolution-authorization.module';
@Module({
  imports: [ResolutionAuthorizationModule,
    DatabaseModule,
    StartReviewAuthorizationModule,],

  controllers: [
    ResponsibilityAcceptanceController,
  ],

  providers: [
    CareActionRepository,
    CareActionService,
    ResponsibilityAcceptanceService,
  ],

  exports: [
    ResponsibilityAcceptanceService,
  ],
})
export class ResponsibilityAcceptanceModule {}
