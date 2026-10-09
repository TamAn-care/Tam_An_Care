import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
import { PaperRecordController } from './paper-record.controller';
import { PaperRecordService } from './paper-record.service';

@Module({
  imports: [
    DatabaseModule,
    ResidentAccessScopeModule,
  ],
  controllers: [
    PaperRecordController,
  ],
  providers: [
    PaperRecordService,
  ],
})
export class PaperRecordModule {}
