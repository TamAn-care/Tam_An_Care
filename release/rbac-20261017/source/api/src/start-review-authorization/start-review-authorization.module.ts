import {
  Module,
} from '@nestjs/common';

import {
  StartReviewAuthorizationService,
} from './start-review-authorization.service';

@Module({
  providers: [
    StartReviewAuthorizationService,
  ],

  exports: [
    StartReviewAuthorizationService,
  ],
})
export class StartReviewAuthorizationModule {}
