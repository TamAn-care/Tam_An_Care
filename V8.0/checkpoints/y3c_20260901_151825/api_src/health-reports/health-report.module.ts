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

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [
    HealthReportController,
  ],
  providers: [
    HealthReportService,
  ],
})
export class HealthReportModule {}
