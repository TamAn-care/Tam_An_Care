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
import { ResidentLeaveService } from './resident-leave.service';

@Controller('api/resident-leave')
export class ResidentLeaveController {
  constructor(private readonly service: ResidentLeaveService) {}

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

  @Post('requests')
  @HttpCode(201)
  createRequest(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.createLeaveRequest(
      this.actor(actorId, actorRole),
      body,
    );
  }

  @Get('requests')
  listRequests(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query() query: any = {},
  ) {
    return this.service.listLeaveRequests(
      this.actor(actorId, actorRole),
      query,
    );
  }

  @Get('requests/:id')
  getRequest(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
  ) {
    return this.service.getLeaveRequest(
      this.actor(actorId, actorRole),
      id,
    );
  }

  @Patch('requests/:id/confirm-subsequent')
  confirmSubsequent(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.confirmSubsequentDays(
      this.actor(actorId, actorRole),
      id,
      body,
    );
  }

  @Post('requests/:id/return')
  @HttpCode(200)
  recordReturn(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.recordReturn(
      this.actor(actorId, actorRole),
      id,
      body,
    );
  }

  @Post('requests/:id/cancel')
  @HttpCode(200)
  cancelLeave(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('id') id?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.cancelLeave(
      this.actor(actorId, actorRole),
      id,
      body,
    );
  }
}
