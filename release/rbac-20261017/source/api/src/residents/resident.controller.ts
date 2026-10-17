import {
  Body,
  ForbiddenException,
  UnauthorizedException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ResidentService } from './resident.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';

@Controller('api/residents')
export class ResidentController {
  constructor(
    private readonly residentService: ResidentService,
    private readonly residentAccessScope: ResidentAccessScopeService,
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
  async listResidents(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Query('limit')
    limitRaw?: string,

    @Query('offset')
    offsetRaw?: string,
  ) {
    // Until a fully scoped listing is implemented, prevent cross-resident listing.
    await this.residentService.authorizeSupervisor(actorId, actorRole);
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
  async getResident(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('residentId') residentId: string,
  ) {
    if (!actorId || !actorRole) {
      throw new UnauthorizedException('Actor context is required');
    }
    if (!['CAREGIVER', 'NURSE', 'SUPERVISOR', 'PSYCHOLOGIST', 'SOCIAL_WORKER'].includes(actorRole)) {
      throw new ForbiddenException('Resident access role is not authorized');
    }
    const authorized = await this.residentAccessScope.canAccessResident(
      actorId, actorRole as 'CAREGIVER' | 'NURSE' | 'SUPERVISOR' | 'PSYCHOLOGIST' | 'SOCIAL_WORKER', residentId,
    );
    if (!authorized) {
      throw new ForbiddenException('Resident access denied');
    }
    return this.residentService.getById(residentId);
  }
}
