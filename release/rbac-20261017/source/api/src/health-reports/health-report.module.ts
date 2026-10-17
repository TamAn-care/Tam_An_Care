import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
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
    ResidentAccessScopeModule,
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
