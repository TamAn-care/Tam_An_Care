import {
  Module,
} from '@nestjs/common';

import {
  CarePlanAuthorizationService,
} from './care-plan-authorization.service';


@Module({
  providers: [
    CarePlanAuthorizationService,
  ],

  exports: [
    CarePlanAuthorizationService,
  ],
})
export class CarePlanAuthorizationModule {}
