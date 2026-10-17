import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';

import {
  HealthReportActorRole,
  HealthReportRow,
  HealthReportService,
} from './health-report.service';

@Controller(['health-reports', 'api/health-reports'])
export class HealthReportController {
  constructor(
    private readonly service:
      HealthReportService,
  ) {}

  private actor(
    actorId?: string,
    actorRole?: string,
  ): {
    actorId: string;
    actorRole:
      HealthReportActorRole;
  } {
    if (!actorId || !actorRole) {
      throw new UnauthorizedException(
        'x-actor-id and x-actor-role are required',
      );
    }

    const roles:
      HealthReportActorRole[] = [
        'ADMIN',
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'MEDICAL_HEAD',
        'SUPERVISOR',
        'GUARDIAN',
        'FAMILY',
        'RECEPTIONIST',
        'ACCOUNTANT',
        'SOCIAL_WORKER',
        'PSYCHOLOGIST',
      ];

    if (
      !roles.includes(
        actorRole as
          HealthReportActorRole,
      )
    ) {
      throw new UnauthorizedException(
        'Unsupported actor role',
      );
    }

    return {
      actorId,
      actorRole:
        actorRole as
          HealthReportActorRole,
    };
  }

  @Get()
  list(
    @Headers('x-actor-id')
    actorId?: string,
    @Headers('x-actor-role')
    actorRole?: string,
    @Query('residentId')
    residentId?: string,
  ): Promise<HealthReportRow[]> {
    return this.service.list(
      this.actor(
        actorId,
        actorRole,
      ),
      residentId,
    );
  }

  @Get(':healthReportId')
  detail(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Param('healthReportId')
    healthReportId: string,
  ): Promise<
    Record<string, unknown>
  > {
    return this.service.detail(
      this.actor(
        actorId,
        actorRole,
      ),
      healthReportId,
    );
  }

  @Post()
  create(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Body()
    body: {
      residentId: string;
      reportType:
        | 'WEEKLY'
        | 'MONTHLY'
        | 'QUARTERLY'
        | 'CUSTOM'
        | 'EVENT_BASED';
      periodStart: string;
      periodEnd: string;
      summary?: string;
    },
  ): Promise<HealthReportRow> {
    return this.service.create(
      this.actor(
        actorId,
        actorRole,
      ),
      body,
    );
  }

  @Put(':healthReportId')
  update(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('healthReportId') healthReportId: string,
    @Body() body: { summary: string },
  ): Promise<HealthReportRow> {
    return this.service.update(this.actor(actorId, actorRole), healthReportId, body);
  }

  @Post(':healthReportId/generate')
  generate(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Param('healthReportId')
    healthReportId: string,
  ): Promise<
    Record<string, unknown>
  > {
    return this.service.generate(
      this.actor(
        actorId,
        actorRole,
      ),
      healthReportId,
    );
  }

  @Post(':healthReportId/start-review')
  startReview(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Param('healthReportId')
    healthReportId: string,
  ): Promise<HealthReportRow> {
    return this.service.startReview(
      this.actor(
        actorId,
        actorRole,
      ),
      healthReportId,
    );
  }

  @Post(':healthReportId/approve')
  approve(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Param('healthReportId')
    healthReportId: string,
  ): Promise<HealthReportRow> {
    return this.service.approve(
      this.actor(
        actorId,
        actorRole,
      ),
      healthReportId,
    );
  }

  @Post(':healthReportId/deliver')
  deliver(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Param('healthReportId')
    healthReportId: string,
    @Body()
    body: {
      admissionContactId: string;
      deliveryMethod: string;
      notes?: string;
    },
  ): Promise<
    Record<string, unknown>
  > {
    return this.service.deliver(
      this.actor(
        actorId,
        actorRole,
      ),
      healthReportId,
      body,
    );
  }

  @Get(':healthReportId/pdf')
  async pdf(
    @Headers('x-actor-id')
    actorId: string | undefined,
    @Headers('x-actor-role')
    actorRole: string | undefined,
    @Param('healthReportId')
    healthReportId: string,
  ): Promise<StreamableFile> {
    const pdf =
      await this.service.pdf(
        this.actor(
          actorId,
          actorRole,
        ),
        healthReportId,
      );

    return new StreamableFile(
      pdf,
      {
        type:
          'application/pdf',
        disposition:
          `inline; filename="${healthReportId}.pdf"`,
      },
    );
  }
}
