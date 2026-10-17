import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  IncidentAuthorizationService,
} from './incident-authorization.service';

import {
  IncidentService,
} from './incident.service';

import {
  IncidentController,
} from './incident.controller';


@Module({
  imports: [
    DatabaseModule,
  ],

  providers: [
    IncidentAuthorizationService,
    IncidentService,
  ],

  controllers: [
    IncidentController,
  ],

  exports: [
    IncidentService,
  ],
})
export class IncidentModule {}
