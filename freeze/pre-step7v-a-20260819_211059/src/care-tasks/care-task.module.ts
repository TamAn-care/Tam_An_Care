import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  CareTaskRepository,
} from './care-task.repository';

import {
  CareTaskService,
} from './care-task.service';


@Module({
  imports: [
    DatabaseModule,
  ],

  providers: [
    CareTaskRepository,
    CareTaskService,
  ],

  exports: [
    CareTaskRepository,
    CareTaskService,
  ],
})
export class CareTaskModule {}
