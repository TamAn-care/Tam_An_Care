import { Module } from '@nestjs/common';

import {
  CrossDomainIntegrationModule,
} from '../cross-domain-integration/cross-domain-integration.module';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  OperationalCareViewController,
} from './operational-care-view.controller';

import {
  OperationalCareViewService,
} from './operational-care-view.service';

import {
  OperationalDashboardController,
} from './operational-dashboard.controller';

import {
  OperationalDashboardService,
} from './operational-dashboard.service';

@Module({
  imports: [
    CrossDomainIntegrationModule,
    DatabaseModule,
  ],
  controllers: [
    OperationalCareViewController,
    OperationalDashboardController,
  ],
  providers: [
    OperationalCareViewService,
    OperationalDashboardService,
  ],
})
export class OperationalCareViewModule {}
