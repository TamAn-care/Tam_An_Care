import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResidentLifecycleService } from './resident-lifecycle.service';

@Controller('api/resident-lifecycle')
export class ResidentLifecycleController {
  constructor(private readonly service: ResidentLifecycleService) {}

  private actor(actorId?: string, actorRole?: string) {
    return {
      actorId: String(actorId ?? '').trim(),
      actorRole: String(actorRole ?? '').trim().toUpperCase(),
    };
  }

  private rejectBodyActor(body: any) {
    if (body && (body.actorId !== undefined || body.actorRole !== undefined)) {
      throw new BadRequestException('Actor identity must come from authenticated headers');
    }
  }

  @Post('residents/:residentId/discharge')
  discharge(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.discharge(
      this.actor(actorId, actorRole),
      residentId,
      body,
    );
  }

  @Get('residents/:residentId/history')
  history(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.history(
      this.actor(actorId, actorRole),
      residentId,
      limit,
      offset,
    );
  }

  @Get('residents/:residentId/care-plans')
  carePlans(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.carePlans(
      this.actor(actorId, actorRole),
      residentId,
      limit,
      offset,
    );
  }

  @Patch('care-plans/:carePlanId')
  updateCarePlan(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('carePlanId') carePlanId?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.updateCarePlan(
      this.actor(actorId, actorRole),
      carePlanId,
      body,
    );
  }
}
