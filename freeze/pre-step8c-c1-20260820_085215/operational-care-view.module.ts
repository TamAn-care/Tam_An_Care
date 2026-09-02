import { Module } from '@nestjs/common';

import {
  CrossDomainIntegrationModule,
} from '../cross-domain-integration/cross-domain-integration.module';

import {
  OperationalCareViewController,
} from './operational-care-view.controller';

import {
  OperationalCareViewService,
} from './operational-care-view.service';

@Module({
  imports: [
    CrossDomainIntegrationModule,
  ],
  controllers: [
    OperationalCareViewController,
  ],
  providers: [
    OperationalCareViewService,
  ],
})
export class OperationalCareViewModule {}
