import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  StaffActorService,
} from './staff-actor.service';

import {
  StaffActorController,
} from './staff-actor.controller';

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [
    StaffActorController,
  ],
  providers: [
    StaffActorService,
  ],
  exports: [
    StaffActorService,
  ],
})
export class StaffActorModule {}
