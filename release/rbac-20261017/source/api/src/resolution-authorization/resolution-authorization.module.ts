import {
  Module,
} from '@nestjs/common';

import {
  ResolutionAuthorizationService,
} from './resolution-authorization.service';

@Module({
  providers: [
    ResolutionAuthorizationService,
  ],
  exports: [
    ResolutionAuthorizationService,
  ],
})
export class ResolutionAuthorizationModule {}
