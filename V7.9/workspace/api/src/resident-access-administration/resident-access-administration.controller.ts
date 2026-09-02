import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import {
  ResidentAccessAdministrationService,
} from './resident-access-administration.service';

@Controller('api/operations')
export class ResidentAccessAdministrationController {
  constructor(
    private readonly service:
      ResidentAccessAdministrationService,
  ) {}

  @Get('access-assignments')
  listAssignments(
    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,

    @Query('status')
    status?: string,

    @Query('actorRole')
    filterActorRole?: string,

    @Query('actorId')
    filterActorId?: string,

    @Query('limit')
    limit?: string,
  ) {
    return this.service.listAssignments(
      {
        actorId,
        actorRole,
      },
      {
        status,
        actorRole:
          filterActorRole,
        actorId:
          filterActorId,
        limit,
      },
    );
  }

  @Get(
    'residents/:residentId/access-assignments',
  )
  listResidentAssignments(
    @Param('residentId')
    residentId: string,

    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,

    @Query('status')
    status?: string,

    @Query('limit')
    limit?: string,
  ) {
    return this.service.listResidentAssignments(
      residentId,
      {
        actorId,
        actorRole,
      },
      {
        status,
        limit,
      },
    );
  }

  @Post(
    'residents/:residentId/access-assignments',
  )
  @HttpCode(HttpStatus.CREATED)
  createAssignment(
    @Param('residentId')
    residentId: string,

    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,

    @Body()
    body: {
      actorId?: string;
      actorRole?: string;
      accessScope?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    } = {},
  ) {
    return this.service.createAssignment(
      residentId,
      {
        actorId,
        actorRole,
      },
      body,
    );
  }

  @Post(
    'access-assignments/:assignmentId/revoke',
  )
  @HttpCode(HttpStatus.OK)
  revokeAssignment(
    @Param('assignmentId')
    assignmentId: string,

    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,

    @Body()
    body: {
      revocationReason?: string;
    } = {},
  ) {
    return this.service.revokeAssignment(
      assignmentId,
      {
        actorId,
        actorRole,
      },
      body,
    );
  }


  /* V79_PHASE1D_PUBLIC_ACCESS_WRITE_R57 */
  @Post('access-assignments')
  createPublicAccessAssignment(
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-role') actorRole: string,
    @Body() body: any,
  ) {
    const residentId = body?.residentId;

    const actor = {
      actorId,
      actorRole,
    };

    const input = {
      ...body,
    };

    delete input.residentId;

    return this.service.createAssignment(
      residentId,
      actor,
      input,
    );
  }

}
