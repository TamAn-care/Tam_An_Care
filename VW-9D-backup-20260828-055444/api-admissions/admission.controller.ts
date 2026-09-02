import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ActorContext,
  ActorRole,
  AdmissionService,
  CreateAdmissionInput,
  CreateContactInput,
  CreateMeasurementInput,
} from './admission.service';

@Controller('api/admissions')
export class AdmissionController {
  constructor(
    private readonly service: AdmissionService,
  ) {}

  private headerValue(
    value:
      | string
      | string[]
      | undefined,
  ): string | null {
    if (Array.isArray(value)) {
      return value[0] || null;
    }

    return value || null;
  }

  private actor(
    headers:
      Record<
        string,
        string | string[] | undefined
      >,
  ): ActorContext {
    const actorId =
      this.headerValue(
        headers['x-actor-id'],
      );

    const actorRole =
      this.headerValue(
        headers['x-actor-role'],
      );

    if (
      !actorId ||
      !actorRole
    ) {
      throw new UnauthorizedException(
        'Thiếu thông tin phiên nhân sự.',
      );
    }

    const roles: ActorRole[] = [
      'CAREGIVER',
      'NURSE',
      'CARE_MANAGER',
      'SUPERVISOR',
    ];

    if (
      !roles.includes(
        actorRole as ActorRole,
      )
    ) {
      throw new ForbiddenException(
        'Vai trò nhân sự không hợp lệ.',
      );
    }

    return {
      actorId,
      actorRole:
        actorRole as ActorRole,
    };
  }

  @Get()
  list(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,
    @Query('limit')
    limit?: string,
    @Query('offset')
    offset?: string,
    @Query('status')
    status?: string,
    @Query('q')
    q?: string,
  ) {
    return this.service.list(
      this.actor(headers),
      {
        limit,
        offset,
        status,
        q,
      },
    );
  }

  @Get(':admissionCaseId')
  getById(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,
    @Param('admissionCaseId')
    admissionCaseId: string,
  ) {
    return this.service.getById(
      this.actor(headers),
      admissionCaseId,
    );
  }

  @Post()
  create(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,
    @Body()
    input: CreateAdmissionInput,
  ) {
    return this.service.create(
      this.actor(headers),
      input,
    );
  }

  @Post(':admissionCaseId/measurements')
  createMeasurement(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,
    @Param('admissionCaseId')
    admissionCaseId: string,
    @Body()
    input: CreateMeasurementInput,
  ) {
    return this.service.createMeasurement(
      this.actor(headers),
      admissionCaseId,
      input,
    );
  }

  @Post(':admissionCaseId/contacts')
  createContact(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,
    @Param('admissionCaseId')
    admissionCaseId: string,
    @Body()
    input: CreateContactInput,
  ) {
    return this.service.createContact(
      this.actor(headers),
      admissionCaseId,
      input,
    );
  }
}
