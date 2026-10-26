import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  GuardianAccessService,
} from './guardian-access.service';

@Module({
  imports: [DatabaseModule],
  providers: [GuardianAccessService],
  exports: [GuardianAccessService],
})
export class GuardianAccessModule {}
