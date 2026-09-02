import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Body,
  Query,
  UnauthorizedException,
} from '@nestjs/common';

import {
  StaffActorService,
} from './staff-actor.service';

type StaffRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR'
  | 'CARE_MANAGER';

type StaffStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

type StaffActorDto = {
  actorId: string;
  staffCode: string;
  displayName: string;
  primaryOperationalRole: StaffRole;
  status: StaffStatus;
  employmentReference: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

@Controller('api/operations/staff-actors')
export class StaffActorController {
  private readonly defaultLimit = 50;
  private readonly maxLimit = 100;

  constructor(
    private readonly staffActors: StaffActorService,
  ) {}

  private async authorizeSupervisor(
    actorId?: string,
    actorRole?: string,
  ): Promise<void> {
    if (!actorId || !actorRole) {
      throw new UnauthorizedException(
        'Actor context is required',
      );
    }

    if (actorRole !== 'SUPERVISOR') {
      throw new ForbiddenException(
        'Supervisor authority is required',
      );
    }

    const actor =
      await this.staffActors.resolveActiveActorWithRole(
        actorId,
        'SUPERVISOR',
      );

    if (!actor) {
      throw new ForbiddenException(
        'Canonical active Supervisor is required',
      );
    }
  }

  private parseLimit(
    raw?: string,
  ): number {
    if (
      raw === undefined ||
      raw.trim() === ''
    ) {
      return this.defaultLimit;
    }

    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException(
        'limit must be an integer',
      );
    }

    const limit = Number(raw);

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > this.maxLimit
    ) {
      throw new BadRequestException(
        `limit must be between 1 and ${this.maxLimit}`,
      );
    }

    return limit;
  }

  private parseRole(
    raw?: string,
  ): StaffRole | undefined {
    if (
      raw === undefined ||
      raw === '' ||
      raw === 'ALL'
    ) {
      return undefined;
    }

    const allowed: StaffRole[] = [
      'CAREGIVER',
      'NURSE',
      'SUPERVISOR',
      'CARE_MANAGER',
    ];

    if (
      !allowed.includes(
        raw as StaffRole,
      )
    ) {
      throw new BadRequestException(
        'Invalid role',
      );
    }

    return raw as StaffRole;
  }

  private parseStatus(
    raw?: string,
  ): StaffStatus | undefined {
    if (
      raw === undefined ||
      raw === '' ||
      raw === 'ALL'
    ) {
      return undefined;
    }

    const allowed: StaffStatus[] = [
      'ACTIVE',
      'INACTIVE',
      'SUSPENDED',
      'ARCHIVED',
    ];

    if (
      !allowed.includes(
        raw as StaffStatus,
      )
    ) {
      throw new BadRequestException(
        'Invalid status',
      );
    }

    return raw as StaffStatus;
  }

  private value(
    row: Record<string, unknown>,
    camel: string,
    snake: string,
  ): unknown {
    return row[camel] ?? row[snake];
  }

  private toDto(
    input: unknown,
  ): StaffActorDto {
    const row =
      input as Record<string, unknown>;

    return {
      actorId: String(
        this.value(
          row,
          'actorId',
          'actor_id',
        ) ?? '',
      ),
      staffCode: String(
        this.value(
          row,
          'staffCode',
          'staff_code',
        ) ?? '',
      ),
      displayName: String(
        this.value(
          row,
          'displayName',
          'display_name',
        ) ?? '',
      ),
      primaryOperationalRole:
        String(
          this.value(
            row,
            'primaryOperationalRole',
            'primary_operational_role',
          ),
        ) as StaffRole,
      status:
        String(
          this.value(
            row,
            'status',
            'status',
          ),
        ) as StaffStatus,
      employmentReference:
        this.value(
          row,
          'employmentReference',
          'employment_reference',
        ) == null
          ? null
          : String(
              this.value(
                row,
                'employmentReference',
                'employment_reference',
              ),
            ),
      createdAt:
        this.value(
          row,
          'createdAt',
          'created_at',
        ) as string | Date,
      updatedAt:
        this.value(
          row,
          'updatedAt',
          'updated_at',
        ) as string | Date,
    };
  }


  @Post()
  async createStaffActor(
    @Headers('x-actor-id')
    requesterId: string | undefined,

    @Headers('x-actor-role')
    requesterRole: string | undefined,

    @Body()
    body: {
      staffCode?: string;
      displayName?: string;
      primaryOperationalRole?: string;
      employmentReference?: string | null;
    } = {},
  ): Promise<StaffActorDto> {
    await this.authorizeSupervisor(
      requesterId,
      requesterRole,
    );

    const staffCode =
      String(body.staffCode || '').trim();

    const displayName =
      String(body.displayName || '').trim();

    const targetRole =
      String(
        body.primaryOperationalRole || '',
      )
        .trim()
        .toUpperCase();

    if (!staffCode) {
      throw new BadRequestException(
        'staffCode is required',
      );
    }

    if (!displayName) {
      throw new BadRequestException(
        'displayName is required',
      );
    }

    const allowedTargetRoles = [
      'CAREGIVER',
      'NURSE',
      'CARE_MANAGER',
    ] as const;

    if (
      !allowedTargetRoles.includes(
        targetRole as
          | 'CAREGIVER'
          | 'NURSE'
          | 'CARE_MANAGER',
      )
    ) {
      throw new BadRequestException(
        'primaryOperationalRole must be CAREGIVER, NURSE, or CARE_MANAGER',
      );
    }

    const created =
      await this.staffActors.createStaffActor(
        {
          staffCode,
          displayName,
          primaryOperationalRole:
            targetRole as
              | 'CAREGIVER'
              | 'NURSE'
              | 'CARE_MANAGER',
          employmentReference:
            body.employmentReference == null
              ? null
              : String(
                  body.employmentReference,
                ).trim() || null,
        },
        requesterId as string,
        'SUPERVISOR',
      );

    return this.toDto(created);
  }

  @Get()
  async list(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Query('limit')
    rawLimit?: string,

    @Query('role')
    rawRole?: string,

    @Query('status')
    rawStatus?: string,
  ): Promise<{
    items: StaffActorDto[];
    count: number;
    limit: number;
  }> {
    await this.authorizeSupervisor(
      actorId,
      actorRole,
    );

    const limit =
      this.parseLimit(rawLimit);

    const role =
      this.parseRole(rawRole);

    const status =
      this.parseStatus(rawStatus);

    const rows =
      await this.staffActors.listStaffActors(
        limit,
      );

    const items =
      rows
        .map((row) =>
          this.toDto(row),
        )
        .filter((row) =>
          role
            ? row.primaryOperationalRole === role
            : true,
        )
        .filter((row) =>
          status
            ? row.status === status
            : true,
        );

    return {
      items,
      count: items.length,
      limit,
    };
  }

  @Get(':actorId')
  async detail(
    @Headers('x-actor-id')
    requesterId: string | undefined,

    @Headers('x-actor-role')
    requesterRole: string | undefined,

    @Param('actorId')
    targetActorId: string,
  ): Promise<StaffActorDto> {
    await this.authorizeSupervisor(
      requesterId,
      requesterRole,
    );

    const actor =
      await this.staffActors.findByActorId(
        targetActorId,
      );

    if (!actor) {
      throw new NotFoundException(
        'Staff actor not found',
      );
    }

    return this.toDto(actor);
  }
}
