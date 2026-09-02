import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { ResidentService } from './resident.service';

@Controller('api/residents')
export class ResidentController {
  constructor(
    private readonly residentService: ResidentService,
  ) {}


  @Post()
  async createResident(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Body()
    body: {
      residentCode?: string;
      displayName?: string;
      dateOfBirth?: string;
      gender?: string;
      room?: string | null;
      bed?: string | null;
      careLevel?: string;
    } = {},
  ) {
    await this.residentService.authorizeSupervisor(
      actorId,
      actorRole,
    );

    return this.residentService.create(
      body,
      actorId as string,
    );
  }

  @Get()
  listResidents() {
    return this.residentService.list();
  }

  @Get(':residentId')
  getResident(
    @Param('residentId') residentId: string,
  ) {
    return this.residentService.getById(residentId);
  }
}
