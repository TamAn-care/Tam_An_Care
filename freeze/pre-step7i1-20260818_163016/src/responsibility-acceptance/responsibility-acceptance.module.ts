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

@Module({
  imports: [
    DatabaseModule,
  ],

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
