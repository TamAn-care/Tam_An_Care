import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import { KitchenOperationsService } from './kitchen-operations.service';

@Controller('api/kitchen-operations')
export class KitchenOperationsController {
  constructor(
    private readonly service:
      KitchenOperationsService,
  ) {}

  @Post('food-receiving-events')
  async createReceiving(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body?: any,
  ) {
    if (
      body &&
      (
        body.actorId !== undefined ||
        body.actorRole !== undefined ||
        body.receivedBy !== undefined ||
        body.receivedByRole !== undefined
      )
    ) {
      throw new BadRequestException(
        'Actor identity must come from authenticated request context',
      );
    }

    return this.service.createReceivingEvent(
      actorId,
      actorRole,
      body,
    );
  }

  @Get('food-receiving-events')
  async listReceiving(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listReceivingEvents(
      actorId,
      actorRole,
      limit,
      offset,
    );
  }

  @Get('inventory')
  async inventory(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.inventoryView(
      actorId,
      actorRole,
      limit,
      offset,
    );
  }

  @Get('meal-production')
  async mealProduction(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.mealProductionView(
      actorId,
      actorRole,
      limit,
      offset,
    );
  }
}
