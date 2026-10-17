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
import { AccommodationService } from './accommodation.service';

@Controller('api/accommodation')
export class AccommodationController {
  constructor(private readonly service: AccommodationService) {}

  private actor(actorId?: string, actorRole?: string) {
    return {
      actorId: String(actorId ?? '').trim(),
      actorRole: String(actorRole ?? '').trim().toUpperCase(),
    };
  }

  private rejectBodyActor(body: any) {
    if (
      body &&
      (
        body.actorId !== undefined ||
        body.actorRole !== undefined ||
        body.assignedBy !== undefined ||
        body.endedBy !== undefined
      )
    ) {
      throw new BadRequestException(
        'Actor identity must come from authenticated request context',
      );
    }
  }

  @Get('overview')
  overview(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('buildingId') buildingId?: string,
    @Query('floorId') floorId?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.overviewPaged(
      this.actor(actorId, actorRole),
      buildingId,
      floorId,
      roomId,
      status,
      search,
      limit,
      offset,
    );
  }

  @Get('buildings')
  buildings(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.service.listBuildings(
      this.actor(actorId, actorRole),
    );
  }

  @Post('buildings')
  createBuilding(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.createBuilding(
      this.actor(actorId, actorRole),
      body,
    );
  }

  @Get('floors')
  floors(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.service.listFloors(
      this.actor(actorId, actorRole),
      buildingId,
    );
  }

  @Post('floors')
  createFloor(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.createFloor(
      this.actor(actorId, actorRole),
      body,
    );
  }

  @Get('rooms')
  rooms(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('floorId') floorId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listRooms(
      this.actor(actorId, actorRole),
      floorId,
      limit,
      offset,
    );
  }

  @Post('rooms')
  createRoom(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.createRoom(
      this.actor(actorId, actorRole),
      body,
    );
  }

  @Get('beds')
  beds(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listBeds(
      this.actor(actorId, actorRole),
      roomId,
      status,
      limit,
      offset,
    );
  }

  @Post('beds')
  createBed(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.createBed(
      this.actor(actorId, actorRole),
      body,
    );
  }

  @Post('beds/:bedId/status')
  setBedStatus(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('bedId') bedId?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.setBedStatus(
      this.actor(actorId, actorRole),
      bedId,
      body?.status,
    );
  }

  @Post('beds/:bedId/assign')
  assign(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('bedId') bedId?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.assign(
      this.actor(actorId, actorRole),
      bedId,
      body?.residentId,
    );
  }

  @Post('residents/:residentId/transfer')
  transfer(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.transfer(
      this.actor(actorId, actorRole),
      residentId,
      body?.bedId,
    );
  }

  @Post('residents/:residentId/release')
  release(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Body() body?: any,
  ) {
    this.rejectBodyActor(body);
    return this.service.release(
      this.actor(actorId, actorRole),
      residentId,
      body?.reason,
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
}
