import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

import { ResidentController } from './resident.controller';
import { ResidentRepository } from './resident.repository';
import { ResidentService } from './resident.service';

@Module({
  imports: [
    DatabaseModule,
    ResidentAccessScopeModule,
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
