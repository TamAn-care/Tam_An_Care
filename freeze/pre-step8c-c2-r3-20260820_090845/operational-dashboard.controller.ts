import {
  Controller,
  Get,
  Headers,
} from '@nestjs/common';

import {
  OperationalDashboardService,
} from './operational-dashboard.service';

@Controller('operations')
export class OperationalDashboardController {
  constructor(
    private readonly service:
      OperationalDashboardService,
  ) {}

  @Get('dashboard')
  dashboard(
    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,
  ) {
    return this.service.getDashboard(
      actorId,
      actorRole,
    );
  }
}
