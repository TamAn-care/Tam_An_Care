import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
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
  listResidents(
    @Query('limit')
    limitRaw?: string,

    @Query('offset')
    offsetRaw?: string,
  ) {
    if (
      limitRaw === undefined &&
      offsetRaw === undefined
    ) {
      return this.residentService.list();
    }

    const parsedLimit =
      Number(limitRaw ?? 50);

    const parsedOffset =
      Number(offsetRaw ?? 0);

    const limit =
      Number.isInteger(parsedLimit)
        ? Math.min(
            Math.max(
              parsedLimit,
              1,
            ),
            200,
          )
        : 50;

    const offset =
      Number.isInteger(parsedOffset)
        ? Math.max(
            parsedOffset,
            0,
          )
        : 0;

    return this.residentService
      .listPage(
        limit,
        offset,
      );
  }

  @Get(':residentId')
  getResident(
    @Param('residentId') residentId: string,
  ) {
    return this.residentService.getById(residentId);
  }
}
