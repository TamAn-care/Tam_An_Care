import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  CareTaskAuthorizationModule,
} from '../care-task-authorization/care-task-authorization.module';
import {
  OperationalWorkModule,
} from '../operational-work/operational-work.module';

import {
  CareTaskExecutionController,
} from './care-task-execution.controller';

import {
  CareTaskExecutionService,
} from './care-task-execution.service';


@Module({
  imports: [
    DatabaseModule,
    CareTaskAuthorizationModule,
    OperationalWorkModule,
  ],

  controllers: [
    CareTaskExecutionController,
  ],

  providers: [
    CareTaskExecutionService,
  ],

  exports: [
    CareTaskExecutionService,
  ],
})
export class CareTaskExecutionModule {}
