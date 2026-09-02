import { Module } from '@nestjs/common';

import {
  CrossDomainIntegrationModule,
} from '../cross-domain-integration/cross-domain-integration.module';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  ResidentAccessScopeModule,
} from '../resident-access-scope/resident-access-scope.module';

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
    ResidentAccessScopeModule,
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
