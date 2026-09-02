import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  ActorContext,
  ActorRole,
} from './admission.service';

import {
  AdmissionClassificationService,
} from './admission-classification.service';

@Controller('api/admissions')
export class AdmissionClassificationController {
  constructor(
    private readonly service:
      AdmissionClassificationService,
  ) {}

  private actor(
    headers:
      Record<
        string,
        string | string[] | undefined
      >,
  ): ActorContext {
    const rawId =
      headers['x-actor-id'];

    const rawRole =
      headers['x-actor-role'];

    const actorId =
      Array.isArray(rawId)
        ? rawId[0]
        : rawId;

    const actorRole =
      Array.isArray(rawRole)
        ? rawRole[0]
        : rawRole;

    if (
      !actorId ||
      !actorRole
    ) {
      throw new UnauthorizedException(
        'Thiếu thông tin phiên nhân sự.',
      );
    }

    const roles:
      ActorRole[] = [
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

  @Post(':admissionCaseId/assessments')
  createAssessment(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,

    @Param('admissionCaseId')
    admissionCaseId:
      string,

    @Body()
    body:
      unknown,
  ) {
    return this.service.createAssessment(
      this.actor(headers),
      admissionCaseId,
      body as never,
    );
  }

  @Post(':admissionCaseId/classification/generate')
  generateClassification(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,

    @Param('admissionCaseId')
    admissionCaseId:
      string,
  ) {
    return this.service.generateClassification(
      this.actor(headers),
      admissionCaseId,
    );
  }

  @Post(
    ':admissionCaseId/classification/:classificationId/approve',
  )
  approveClassification(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,

    @Param('admissionCaseId')
    admissionCaseId:
      string,

    @Param('classificationId')
    classificationId:
      string,

    @Body()
    body:
      unknown,
  ) {
    return this.service.approveClassification(
      this.actor(headers),
      admissionCaseId,
      classificationId,
      body as never,
    );
  }

  @Post(':admissionCaseId/decision')
  createDecision(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,

    @Param('admissionCaseId')
    admissionCaseId:
      string,

    @Body()
    body:
      unknown,
  ) {
    return this.service.createDecision(
      this.actor(headers),
      admissionCaseId,
      body as never,
    );
  }

  @Get(':admissionCaseId/assessment-overview')
  overview(
    @Headers()
    headers:
      Record<
        string,
        string | string[] | undefined
      >,

    @Param('admissionCaseId')
    admissionCaseId:
      string,
  ) {
    return this.service.overview(
      this.actor(headers),
      admissionCaseId,
    );
  }
}
