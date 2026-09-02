import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { ResidentController } from './resident.controller';
import { ResidentRepository } from './resident.repository';
import { ResidentService } from './resident.service';

@Module({
  imports: [
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
