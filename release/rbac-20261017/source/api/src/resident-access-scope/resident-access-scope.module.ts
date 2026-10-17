import { AssignedResidentController } from './assigned-resident.controller';
import { GuardianResidentService } from './guardian-resident.service';
import { GuardianResidentController } from './guardian-resident.controller';
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
  controllers: [GuardianResidentController, AssignedResidentController],
  providers: [
    GuardianResidentService,
    ResidentAccessScopeService,
  ],
  exports: [
    ResidentAccessScopeService,
  ],
})
export class ResidentAccessScopeModule {}
