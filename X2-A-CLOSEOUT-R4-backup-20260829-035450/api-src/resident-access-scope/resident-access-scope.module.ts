import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  StaffActorModule,
} from '../staff-actors/staff-actor.module';

import {
  ResidentAccessScopeService,
} from './resident-access-scope.service';

@Module({
  imports: [
    DatabaseModule,
    StaffActorModule,
  ],
  providers: [
    ResidentAccessScopeService,
  ],
  exports: [
    ResidentAccessScopeService,
  ],
})
export class ResidentAccessScopeModule {}
