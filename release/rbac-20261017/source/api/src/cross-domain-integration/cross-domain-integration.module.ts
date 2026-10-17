import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { CrossDomainIntegrationController } from './cross-domain-integration.controller';
import { CrossDomainIntegrationService } from './cross-domain-integration.service';

@Module({
  imports: [DatabaseModule, ResidentAccessScopeModule],
  controllers: [CrossDomainIntegrationController],
  providers: [CrossDomainIntegrationService],
  exports: [CrossDomainIntegrationService],
})
export class CrossDomainIntegrationModule {}
