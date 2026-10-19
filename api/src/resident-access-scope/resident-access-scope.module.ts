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
import { GuardianResidentController } from './guardian-resident.controller';

@Module({
  imports: [
    DatabaseModule,
    StaffActorModule,
  ],
  controllers: [GuardianResidentController],
  providers: [
    ResidentAccessScopeService,
  ],
  exports: [
    ResidentAccessScopeService,
  ],
})
export class ResidentAccessScopeModule {}
