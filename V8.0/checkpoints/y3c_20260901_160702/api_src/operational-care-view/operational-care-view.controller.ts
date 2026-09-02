import {
  Controller,
  Get,
  Headers,
  Param,
} from '@nestjs/common';

import {
  OperationalCareViewService,
} from './operational-care-view.service';

@Controller('api/operations')
export class OperationalCareViewController {
  constructor(
    private readonly careView:
      OperationalCareViewService,
  ) {}

  @Get('residents/:residentId/care-view')
  residentCareView(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.careView.getResidentCareView(
      residentId,
      {
        actorId,
        actorRole,
      },
    );
  }
}
