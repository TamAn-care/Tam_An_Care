import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { ResidentController } from './resident.controller';
import { ResidentRepository } from './resident.repository';
import { ResidentService } from './resident.service';
import { StaffActorModule } from '../staff-actors/staff-actor.module';

@Module({
  imports: [StaffActorModule, 
    DatabaseModule,
  ],

  controllers: [
    ResidentController,
  ],

  providers: [
    ResidentRepository,
    ResidentService,
  ],

  exports: [
    ResidentRepository,
    ResidentService,
  ],
})
export class ResidentModule {}
