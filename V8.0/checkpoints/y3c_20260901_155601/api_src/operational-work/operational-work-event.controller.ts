import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { OperationalWorkEventService } from './operational-work-event.service';

@Controller('api/operations/work-events')
export class OperationalWorkEventController {
  constructor(
    private readonly service:
      OperationalWorkEventService,
  ) {}

  @Get()
  list(
    @Headers('x-actor-id') actorId:
      | string
      | undefined,
    @Headers('x-actor-role') actorRole:
      | string
      | undefined,
    @Query() query: any,
  ) {
    return this.service.list(
      actorId,
      actorRole,
      query,
    );
  }

  @Get(':id')
  detail(
    @Headers('x-actor-id') actorId:
      | string
      | undefined,
    @Headers('x-actor-role') actorRole:
      | string
      | undefined,
    @Param('id') id: string,
  ) {
    return this.service.detail(
      actorId,
      actorRole,
      id,
    );
  }

  @Post()
  create(
    @Headers('x-actor-id') actorId:
      | string
      | undefined,
    @Headers('x-actor-role') actorRole:
      | string
      | undefined,
    @Body() body: any,
  ) {
    return this.service.create(
      actorId,
      actorRole,
      body,
    );
  }

  @Post(':id/verify')
  verify(
    @Headers('x-actor-id') actorId:
      | string
      | undefined,
    @Headers('x-actor-role') actorRole:
      | string
      | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.verify(
      actorId,
      actorRole,
      id,
      body,
    );
  }

  @Post(':id/amend')
  amend(
    @Headers('x-actor-id') actorId:
      | string
      | undefined,
    @Headers('x-actor-role') actorRole:
      | string
      | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.amend(
      actorId,
      actorRole,
      id,
      body,
    );
  }

  @Post(':id/void')
  voidEvent(
    @Headers('x-actor-id') actorId:
      | string
      | undefined,
    @Headers('x-actor-role') actorRole:
      | string
      | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.voidEvent(
      actorId,
      actorRole,
      id,
      body,
    );
  }
}
