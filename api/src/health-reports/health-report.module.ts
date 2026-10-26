import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  HealthReportController,
} from './health-report.controller';

import {
  HealthReportService,
} from './health-report.service';

import {
  GuardianAccessModule,
} from '../guardian-access/guardian-access.module';

import {
  ResidentAccessScopeModule,
} from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [
    DatabaseModule,
    GuardianAccessModule,
    ResidentAccessScopeModule,
  ],
  controllers: [
    HealthReportController,
  ],
  providers: [
    HealthReportService,
  ],
})
export class HealthReportModule {}
