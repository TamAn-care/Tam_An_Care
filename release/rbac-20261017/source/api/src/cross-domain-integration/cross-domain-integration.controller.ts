import { Headers, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';
import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import {
  CrossDomainIntegrationService,
} from './cross-domain-integration.service';

@Controller('api/integration')
export class CrossDomainIntegrationController {
  constructor(
    private readonly integration:
      CrossDomainIntegrationService,
    private readonly scope: ResidentAccessScopeService,
  ) {}

  @Get('residents/:residentId/overview')
  async overview(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') role?: string,
  ) {
    if (!actorId || (role !== 'NURSE' && role !== 'SUPERVISOR')) {
      throw new ForbiddenException('Clinical or supervisory authority is required');
    }
    if (!await this.scope.canAccessResident(actorId, role, residentId)) throw new NotFoundException('Resident not found');
    return this.integration.residentOverview(
      residentId,
    );
  }
}
