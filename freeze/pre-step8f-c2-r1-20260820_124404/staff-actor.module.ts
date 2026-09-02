import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  StaffActorService,
} from './staff-actor.service';

@Module({
  imports: [
    DatabaseModule,
  ],
  providers: [
    StaffActorService,
  ],
  exports: [
    StaffActorService,
  ],
})
export class StaffActorModule {}
