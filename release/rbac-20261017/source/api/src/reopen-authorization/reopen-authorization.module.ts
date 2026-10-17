import {
  Module,
} from '@nestjs/common';

import {
  ReopenAuthorizationService,
} from './reopen-authorization.service';

@Module({
  providers: [
    ReopenAuthorizationService,
  ],
  exports: [
    ReopenAuthorizationService,
  ],
})
export class ReopenAuthorizationModule {}
