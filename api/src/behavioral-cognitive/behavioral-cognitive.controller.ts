import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { BehavioralCognitiveService } from './behavioral-cognitive.service';

@Controller('api/behavioral-cognitive')
export class BehavioralCognitiveController {
  constructor(private readonly service: BehavioralCognitiveService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('guardian-resident-ids')
  guardianResidentIds(
    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,
  ) {
    return this.service.listGuardianResidentIds(
      actorId,
      actorRole,
    );
  }

  @Get('psychological-assessments')
  psychologicalAssessments(
    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,
  ) {
    return this.service.listPsychologicalAssessments(
      actorId,
      actorRole,
    );
  }

  @Get(':residentId/psychological-assessments')
  residentPsychologicalAssessments(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Param('residentId')
    residentId: string,
  ) {
    return this.service.listPsychologicalAssessments(
      actorId,
      actorRole,
      residentId,
    );
  }

  @Post(':residentId/psychological-assessments')
  createPsychologicalAssessment(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Param('residentId')
    residentId: string,

    @Body()
    body: any,
  ) {
    return this.service.createPsychologicalAssessment(
      residentId,
      {
        ...body,
        actorId,
        actorRole,
      },
    );
  }

  @Post(':residentId/execute')
  execute(
    @Param('residentId') residentId: string,
    @Body() body: any,
  ) {
    return this.service.execute(residentId, body);
  }
}
