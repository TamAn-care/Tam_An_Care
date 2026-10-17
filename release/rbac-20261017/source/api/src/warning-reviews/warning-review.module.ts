import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ResidentModule } from '../residents/resident.module';

import { WarningReviewController } from './warning-review.controller';
import { WarningReviewRepository } from './warning-review.repository';
import { WarningReviewService } from './warning-review.service';

@Module({
  imports: [
    DatabaseModule,
    ResidentModule,
  ],

  controllers: [
    WarningReviewController,
  ],

  providers: [
    WarningReviewRepository,
    WarningReviewService,
  ],

  exports: [
    WarningReviewService,
  ],
})
export class WarningReviewModule {}
