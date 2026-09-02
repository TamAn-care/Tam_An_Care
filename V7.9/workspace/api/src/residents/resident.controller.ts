import { Controller, Get, Param, Body, ForbiddenException, Headers, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ResidentService } from './resident.service';
import { StaffActorService } from '../staff-actors/staff-actor.service';

@Controller('api/residents')
export class ResidentController {
  constructor(
    private readonly residentService: ResidentService,
    private readonly staffActors: StaffActorService,
  ) {}

  private async authorizeSupervisor(
    actorIdHeader?: string,
    actorRoleHeader?: string,
  ) {
    const actorId =
      String(actorIdHeader ?? '').trim();

    const actorRole =
      String(actorRoleHeader ?? '')
        .trim()
        .toUpperCase();

    if (!actorId || !actorRole) {
      throw new UnauthorizedException(
        'Human actor identity required.',
      );
    }

    if (actorRole !== 'SUPERVISOR') {
      throw new ForbiddenException(
        'Supervisor authority required.',
      );
    }

    const canonical =
      await this.staffActors
        .resolveActiveActorWithRole(
          actorId,
          'SUPERVISOR',
        );

    if (!canonical) {
      throw new ForbiddenException(
        'Canonical active supervisor authority required.',
      );
    }
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


  @Post()
  async createResident(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Body()
    body: any,
  ) {
    await this.authorizeSupervisor(
      actorId,
      actorRole,
    );

    return this.residentService
      .createResident(body);
  }

  @Patch(':residentId')
  async updateResident(
    @Param('residentId')
    residentId: string,
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Body()
    body: any,
  ) {
    await this.authorizeSupervisor(
      actorId,
      actorRole,
    );

    return this.residentService
      .updateResident(
        residentId,
        body,
      );
  }

  @Post(':residentId/deactivate')
  async deactivateResident(
    @Param('residentId')
    residentId: string,
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
  ) {
    await this.authorizeSupervisor(
      actorId,
      actorRole,
    );

    return this.residentService
      .deactivateResident(
        residentId,
      );
  }

}
