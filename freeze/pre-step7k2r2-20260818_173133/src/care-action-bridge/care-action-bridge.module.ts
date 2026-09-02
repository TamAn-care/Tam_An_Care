import { Module } from '@nestjs/common';

import { WarningReviewModule } from '../warning-reviews/warning-review.module';

import { DatabaseModule } from '../database/database.module';

import { CareActionRepository } from '../care-actions/care-action.repository';
import { CareActionService } from '../care-actions/care-action.service';

import { CareActionBridgeService } from './care-action-bridge.service';
import { CareActionBridgeController } from './care-action-bridge.controller';

import { StartReviewAuthorizationModule } from '../start-review-authorization/start-review-authorization.module';


import {
  ResolutionAuthorizationModule,
} from '../resolution-authorization/resolution-authorization.module';
@Module({
  imports: [ResolutionAuthorizationModule,
    WarningReviewModule,
    DatabaseModule,
    StartReviewAuthorizationModule,],

  controllers: [
    CareActionBridgeController,
  ],

  providers: [
    CareActionRepository,
    CareActionService,
    CareActionBridgeService,
  ],

  exports: [
    CareActionBridgeService,
  ],
})
export class CareActionBridgeModule {}
