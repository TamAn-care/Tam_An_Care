import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';

import {
  StaffActorService,
  StaffActorStatus,
} from './staff-actor.service';

type StaffRole =
  'ADMIN'
  | 'SUPERVISOR'
  | 'CARE_MANAGER'
  | 'MEDICAL_HEAD'
  | 'NURSE'
  | 'CAREGIVER'
  | 'NUTRITIONIST'
  | 'ACCOUNTANT'
  | 'RECEPTIONIST'
  | 'PSYCHOLOGIST'
  | 'SOCIAL_WORKER'
  | 'REHABILITATION_SPECIALIST'
  | 'COMMUNICATIONS'
  | 'HOUSEKEEPING'
  | 'SECURITY'
  | 'GUARDIAN';

type StaffStatus =
  StaffActorStatus;

type StaffActorDto = {
  actorId: string;
  staffCode: string;
  displayName: string;
  primaryOperationalRole:
    StaffRole;
  department: string;
  email: string;
  phone: string;
  status: StaffStatus;
  employmentReference:
    string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

@Controller(
  'api/operations/staff-actors',
)
export class StaffActorController {
  private readonly defaultLimit = 50;
  private readonly maxLimit = 100;

  constructor(
    private readonly staffActors:
      StaffActorService,
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

    const normalizedRole =
      String(actorRole)
        .trim()
        .toUpperCase();

    if (
      normalizedRole !== 'SUPERVISOR'
      && normalizedRole !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Admin or Supervisor authority is required',
      );
    }

    const actor =
      await this.staffActors.resolveActiveActorWithRole(
        actorId,
        normalizedRole,
      );

    if (!actor) {
      throw new ForbiddenException(
        'Canonical active Admin or Supervisor is required',
      );
    }
  }

  private async authorizeSelf(
    actorId?: string,
    actorRole?: string,
  ): Promise<void> {
    if (!actorId || !actorRole) {
      throw new UnauthorizedException(
        'Actor context is required',
      );
    }

    const actor =
      await this.staffActors
        .resolveActiveActorWithRole(
          actorId,
          actorRole,
        );

    if (!actor) {
      throw new ForbiddenException(
        'Canonical active actor is required',
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

  private toDto(
    input: unknown,
  ): StaffActorDto {
    const row =
      input as Record<
        string,
        unknown
      >;

    const value = (
      camel: string,
      snake: string,
    ) =>
      row[camel] ??
      row[snake];

    return {
      actorId:
        String(
          value(
            'actorId',
            'actor_id',
          ) ?? '',
        ),

      staffCode:
        String(
          value(
            'staffCode',
            'staff_code',
          ) ?? '',
        ),

      displayName:
        String(
          value(
            'displayName',
            'display_name',
          ) ?? '',
        ),

      primaryOperationalRole:
        String(
          value(
            'primaryOperationalRole',
            'primary_operational_role',
          ),
        ) as StaffRole,

      department:
        String(
          value(
            'department',
            'department',
          ) ?? '',
        ),

      email:
        String(
          value(
            'email',
            'email',
          ) ?? '',
        ),

      phone:
        String(
          value(
            'phone',
            'phone',
          ) ?? '',
        ),

      status:
        String(
          value(
            'status',
            'status',
          ),
        ) as StaffStatus,

      employmentReference:
        value(
          'employmentReference',
          'employment_reference',
        ) == null
          ? null
          : String(
              value(
                'employmentReference',
                'employment_reference',
              ),
            ),

      createdAt:
        value(
          'createdAt',
          'created_at',
        ) as string | Date,

      updatedAt:
        value(
          'updatedAt',
          'updated_at',
        ) as string | Date,
    };
  }

  @Post()
  async createStaffActor(
    @Headers('x-actor-id')
    requesterId:
      string | undefined,

    @Headers('x-actor-role')
    requesterRole:
      string | undefined,

    @Body()
    body: {
      staffCode?: string;
      displayName?: string;
      primaryOperationalRole?:
        string;
      employmentReference?:
        string | null;
      department?: string;
      email?: string;
      phone?: string;
      initialPassword?: string;
    } = {},
  ): Promise<StaffActorDto> {
    await this.authorizeSupervisor(
      requesterId,
      requesterRole,
    );

    const staffCode =
      String(
        body.staffCode || '',
      ).trim();

    const displayName =
      String(
        body.displayName || '',
      ).trim();

    const targetRole =
      String(
        body.primaryOperationalRole ||
          '',
      )
        .trim()
        .toUpperCase();

    const initialPassword =
      String(
        body.initialPassword || '',
      );

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

    if (initialPassword.length < 12) {
      throw new BadRequestException(
        'initialPassword must contain at least 12 characters',
      );
    }

    const allowedRoles = [
      'ADMIN',
      'SUPERVISOR',
      'CARE_MANAGER',
      'MEDICAL_HEAD',
      'NURSE',
      'CAREGIVER',
      'NUTRITIONIST',
      'ACCOUNTANT',
      'RECEPTIONIST',
      'PSYCHOLOGIST',
      'SOCIAL_WORKER',
      'REHABILITATION_SPECIALIST',
      'COMMUNICATIONS',
      'HOUSEKEEPING',
      'SECURITY',
      'GUARDIAN',
    ] as const;

    if (
      !allowedRoles.includes(
        targetRole as StaffRole,
      )
    ) {
      throw new BadRequestException(
        'Supported creation roles are CAREGIVER, NURSE, or CARE_MANAGER',
      );
    }

    const duplicate =
      await this.staffActors
        .findByStaffCode(staffCode);

    if (duplicate) {
      throw new BadRequestException(
        'staffCode already exists',
      );
    }

    const created =
      await this.staffActors
        .createStaffActor(
          {
            staffCode,
            displayName,
            primaryOperationalRole:
              targetRole as StaffRole,

            employmentReference:
              body.employmentReference ==
                null
                ? null
                : String(
                    body.employmentReference,
                  ).trim() || null,

            department:
              String(
                body.department || '',
              ).trim(),

            email:
              String(
                body.email || '',
              ).trim(),

            phone:
              String(
                body.phone || '',
              ).trim(),

            initialPassword,
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
      await this.staffActors
        .listStaffActors(limit);

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

  @Post('self/change-password')
  async changeOwnPassword(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Body()
    body: {
      currentPassword?: string;
      newPassword?: string;
    } = {},
  ) {
    await this.authorizeSelf(
      actorId,
      actorRole,
    );

    const currentPassword =
      String(
        body.currentPassword || '',
      );

    const newPassword =
      String(
        body.newPassword || '',
      );

    if (newPassword.length < 12) {
      throw new BadRequestException(
        'newPassword must contain at least 12 characters',
      );
    }

    await this.staffActors
      .changeOwnPassword(
        actorId as string,
        currentPassword,
        newPassword,
      );

    return {
      success: true,
      message:
        'Password changed successfully',
    };
  }

  @Post(':actorId/reset-password')
  async resetPassword(
    @Headers('x-actor-id')
    requesterId:
      string | undefined,

    @Headers('x-actor-role')
    requesterRole:
      string | undefined,

    @Param('actorId')
    targetActorId: string,

    @Body()
    body: {
      newPassword?: string;
    } = {},
  ) {
    await this.authorizeSupervisor(
      requesterId,
      requesterRole,
    );

    const password =
      String(
        body.newPassword || '',
      );

    if (password.length < 12) {
      throw new BadRequestException(
        'newPassword must contain at least 12 characters',
      );
    }

    const updated =
      await this.staffActors
        .resetPassword(
          targetActorId,
          password,
          requesterId as string,
        );

    if (!updated) {
      throw new NotFoundException(
        'Staff actor not found',
      );
    }

    return {
      success: true,
      actor: this.toDto(updated),
    };
  }

  @Post(':actorId/status')
  async updateStatus(
    @Headers('x-actor-id')
    requesterId:
      string | undefined,

    @Headers('x-actor-role')
    requesterRole:
      string | undefined,

    @Param('actorId')
    targetActorId: string,

    @Body()
    body: {
      status?: string;
      reason?: string;
    } = {},
  ): Promise<StaffActorDto> {
    await this.authorizeSupervisor(
      requesterId,
      requesterRole,
    );

    const status =
      this.parseStatus(body.status);

    if (!status) {
      throw new BadRequestException(
        'status is required',
      );
    }

    if (
      requesterId === targetActorId &&
      status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'Supervisor cannot deactivate their own current account',
      );
    }

    const updated =
      await this.staffActors
        .updateStatus(
          targetActorId,
          status,
          String(
            body.reason ||
              'Administrative update',
          ),
          requesterId as string,
        );

    if (!updated) {
      throw new NotFoundException(
        'Staff actor not found',
      );
    }

    return this.toDto(updated);
  }

  @Post(':actorId/archive')
  async archive(
    @Headers('x-actor-id')
    requesterId:
      string | undefined,

    @Headers('x-actor-role')
    requesterRole:
      string | undefined,

    @Param('actorId')
    targetActorId: string,
  ) {
    await this.authorizeSupervisor(
      requesterId,
      requesterRole,
    );

    if (requesterId === targetActorId) {
      throw new BadRequestException(
        'Supervisor cannot archive their own current account',
      );
    }

    const current =
      await this.staffActors
        .findByActorId(
          targetActorId,
        );

    if (!current) {
      throw new NotFoundException(
        'Staff actor not found',
      );
    }

    if (
      current.primary_operational_role ===
        'SUPERVISOR'
    ) {
      throw new ForbiddenException(
        'A Supervisor account cannot be archived from this endpoint',
      );
    }

    const updated =
      await this.staffActors
        .updateStatus(
          targetActorId,
          'ARCHIVED',
          'Archived from staff administration',
          requesterId as string,
        );

    return {
      success: true,
      deletedActor:
        this.toDto(updated),
    };
  }

  @Get(':actorId')
  async detail(
    @Headers('x-actor-id')
    requesterId:
      string | undefined,

    @Headers('x-actor-role')
    requesterRole:
      string | undefined,

    @Param('actorId')
    targetActorId: string,
  ): Promise<StaffActorDto> {
    await this.authorizeSupervisor(
      requesterId,
      requesterRole,
    );

    const actor =
      await this.staffActors
        .findByActorId(
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
