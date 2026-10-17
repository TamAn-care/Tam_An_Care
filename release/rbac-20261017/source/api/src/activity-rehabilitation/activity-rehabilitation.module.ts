import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import {
  ActivityRehabilitationAuthorizationService,
} from './activity-rehabilitation-authorization.service';

import {
  ActivityRehabilitationController,
} from './activity-rehabilitation.controller';

import {
  ActivityRehabilitationService,
} from './activity-rehabilitation.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ActivityRehabilitationController],
  providers: [
    ActivityRehabilitationService,
    ActivityRehabilitationAuthorizationService,
  ],
  exports: [ActivityRehabilitationService],
})
export class ActivityRehabilitationModule {}
