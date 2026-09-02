import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../database/database.module';

import {
  ResidentAccessScopeService,
} from './resident-access-scope.service';

@Module({
  imports: [
    DatabaseModule,
  ],
  providers: [
    ResidentAccessScopeService,
  ],
  exports: [
    ResidentAccessScopeService,
  ],
})
export class ResidentAccessScopeModule {}
