import {
  Module,
} from '@nestjs/common';

import {
  CareTaskAuthorizationService,
} from './care-task-authorization.service';


@Module({
  providers: [
    CareTaskAuthorizationService,
  ],

  exports: [
    CareTaskAuthorizationService,
  ],
})
export class CareTaskAuthorizationModule {}
