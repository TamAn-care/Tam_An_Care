import { Module } from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  StaffActorModule,
} from '../staff-actors/staff-actor.module';

import {
  ResidentAccessAdministrationController,
} from './resident-access-administration.controller';

import {
  ResidentAccessAdministrationService,
} from './resident-access-administration.service';

@Module({
  imports: [
    DatabaseModule,
    StaffActorModule,
  ],
  controllers: [
    ResidentAccessAdministrationController,
  ],
  providers: [
    ResidentAccessAdministrationService,
  ],
})
export class ResidentAccessAdministrationModule {}
