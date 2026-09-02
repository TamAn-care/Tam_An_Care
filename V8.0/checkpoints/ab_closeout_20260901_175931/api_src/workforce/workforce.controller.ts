import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { WorkforceService } from './workforce.service';

@Controller('api/workforce')
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  private actor(actorId?: string, actorRole?: string) {
    return {
      actorId: String(actorId ?? '').trim(),
      actorRole: String(actorRole ?? '').trim(),
    };
  }

  private rejectBodyActor(b: any) {
    if (b && typeof b === 'object' && ('actorId' in b || 'actorRole' in b)) {
      throw new BadRequestException('Actor context cannot be spoofed in body');
    }
  }

  @Post('shifts')
  @HttpCode(201)
  scheduleShift(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.scheduleShift(
      this.actor(actorId, actorRole),
      body,
    );
  }

  @Get('shifts')
  listShifts(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query() query: any = {},
  ) {
    return this.service.listShifts(
      this.actor(actorId, actorRole),
      query,
    );
  }

  @Get('shifts/:id')
  getShift(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
  ) {
    return this.service.getShift(
      this.actor(actorId, actorRole),
      id,
    );
  }

  @Post('shifts/:id/checkin')
  @HttpCode(200)
  checkinShift(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
  ) {
    return this.service.checkinShift(
      this.actor(actorId, actorRole),
      id,
    );
  }

  @Post('shifts/:id/checkout')
  @HttpCode(200)
  checkoutShift(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.checkoutShift(
      this.actor(actorId, actorRole),
      id,
      body,
    );
  }

  @Post('shifts/:id/handover')
  @HttpCode(201)
  submitHandover(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.submitHandover(
      this.actor(actorId, actorRole),
      id,
      body,
    );
  }

  @Post('handovers/:id/acknowledge')
  @HttpCode(200)
  acknowledgeHandover(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
  ) {
    return this.service.acknowledgeHandover(
      this.actor(actorId, actorRole),
      id,
    );
  }

  @Post('shifts/:id/cancel')
  @HttpCode(200)
  cancelShift(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.cancelShift(
      this.actor(actorId, actorRole),
      id,
      body,
    );
  }
}
