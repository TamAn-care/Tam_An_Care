import { Module } from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  OperationalWorkEventTypeController,
} from './operational-work-event-type.controller';

import {
  OperationalWorkEventTypeService,
} from './operational-work-event-type.service';

import {
  OperationalWorkEventController,
} from './operational-work-event.controller';

import {
  OperationalWorkEventService,
} from './operational-work-event.service';

@Module({
  imports: [
    DatabaseModule,
  ],

  controllers: [
    OperationalWorkEventTypeController,
    OperationalWorkEventController,
  ],

  providers: [
    OperationalWorkEventTypeService,
    OperationalWorkEventService,
  ],

  exports: [
    OperationalWorkEventTypeService,
    OperationalWorkEventService,
  ],
})
export class OperationalWorkModule {}
