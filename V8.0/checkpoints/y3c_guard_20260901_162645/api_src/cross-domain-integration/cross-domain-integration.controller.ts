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
  ) {}

  @Get('residents/:residentId/overview')
  overview(
    @Param('residentId') residentId: string,
  ) {
    return this.integration.residentOverview(
      residentId,
    );
  }
}
