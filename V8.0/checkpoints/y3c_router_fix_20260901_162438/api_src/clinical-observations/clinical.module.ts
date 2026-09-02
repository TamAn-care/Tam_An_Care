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
    DatabaseModule,
  ],

  providers: [
    ClinicalAuthorizationService,
    ClinicalRepository,
    ClinicalService,
  ],

  controllers: [
    ClinicalController,
  ],

  exports: [
    ClinicalService,
  ],
})
export class ClinicalModule {}
