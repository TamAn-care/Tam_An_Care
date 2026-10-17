import { VitalSignService } from './vital-sign.service';
import { VitalSignController } from './vital-sign.controller';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  ClinicalAuthorizationService,
} from './clinical-authorization.service';

import {
  ClinicalRepository,
} from './clinical.repository';

import {
  ClinicalService,
} from './clinical.service';

import {
  ClinicalController,
} from './clinical.controller';

@Module({
  imports: [
    ResidentAccessScopeModule,
    DatabaseModule,
  ],

  providers: [
    VitalSignService,
    ClinicalAuthorizationService,
    ClinicalRepository,
    ClinicalService,
  ],

  controllers: [
    VitalSignController,
    ClinicalController,
  ],

  exports: [
    ClinicalService,
  ],
})
export class ClinicalModule {}
