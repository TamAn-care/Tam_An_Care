import { Module } from '@nestjs/common';

import { WarningReviewModule } from '../warning-reviews/warning-review.module';

import { CareActionBridgeService } from './care-action-bridge.service';

@Module({
  imports: [
    WarningReviewModule,
  ],

  providers: [
    CareActionBridgeService,
  ],

  exports: [
    CareActionBridgeService,
  ],
})
export class CareActionBridgeModule {}
