import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ResidentCostService } from './resident-cost.service';

@Controller('api/resident-cost')
export class ResidentCostController {
  constructor(
    private readonly service: ResidentCostService,
  ) {}

  private rejectActorSpoof(body: any) {
    if (
      body &&
      (
        body.actorId !== undefined ||
        body.actorRole !== undefined ||
        body.recordedBy !== undefined ||
        body.recordedByRole !== undefined ||
        body.reconciledBy !== undefined ||
        body.lockedBy !== undefined
      )
    ) {
      throw new BadRequestException(
        'Actor context không được truyền trong request body.',
      );
    }
  }

  @Post('usage-events')
  createUsageCost(
    @Body() body: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    this.rejectActorSpoof(body);
    return this.service.createUsageCost(
      body,
      actorId,
      actorRole,
    );
  }

  @Get('usage-events')
  listUsageCosts(
    @Query() query: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.service.listUsageCosts(
      query,
      actorId,
      actorRole,
    );
  }

  @Post('periods')
  createPeriod(
    @Body() body: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    this.rejectActorSpoof(body);
    return this.service.createPeriod(
      body,
      actorId,
      actorRole,
    );
  }

  @Get('periods')
  listPeriods(
    @Query() query: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.service.listPeriods(
      query,
      actorId,
      actorRole,
    );
  }

  @Post('periods/:id/reconcile')
  reconcile(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    this.rejectActorSpoof(body);
    return this.service.reconcilePeriod(
      id,
      body,
      actorId,
      actorRole,
    );
  }

  @Post('periods/:id/lock')
  lock(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    this.rejectActorSpoof(body);
    return this.service.lockPeriod(
      id,
      actorId,
      actorRole,
    );
  }
}
