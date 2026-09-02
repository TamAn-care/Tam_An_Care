import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  OperationalWorkEventTypeService,
} from './operational-work-event-type.service';

@Controller('api/operations/work-event-types')
export class OperationalWorkEventTypeController {
  constructor(
    private readonly service:
      OperationalWorkEventTypeService,
  ) {}

  @Get()
  list(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Query('limit')
    limit?: string,

    @Query('active')
    active?: string,
  ) {
    return this.service.list(
      actorId,
      actorRole,
      limit,
      active,
    );
  }

  @Get(':id')
  detail(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Param('id')
    id: string,
  ) {
    return this.service.detail(
      actorId,
      actorRole,
      id,
    );
  }

  @Post()
  create(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Body()
    body: Record<string, unknown>,
  ) {
    return this.service.create(
      actorId,
      actorRole,
      body || {},
    );
  }

  @Patch(':id')
  update(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Param('id')
    id: string,

    @Body()
    body: Record<string, unknown>,
  ) {
    return this.service.update(
      actorId,
      actorRole,
      id,
      body || {},
    );
  }
}
