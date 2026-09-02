import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  MedicationAuthorizationService,
} from './medication-authorization.service';

import {
  MedicationRepository,
} from './medication.repository';

import {
  MedicationService,
} from './medication.service';

import {
  MedicationController,
} from './medication.controller';

@Module({
  imports: [
    DatabaseModule,
  ],

  providers: [
    MedicationAuthorizationService,
    MedicationRepository,
    MedicationService,
  ],

  controllers: [
    MedicationController,
  ],

  exports: [
    MedicationService,
  ],
})
export class MedicationModule {}
