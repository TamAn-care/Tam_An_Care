import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'crypto';

import {
  DatabaseService,
} from '../database/database.service';

type HumanActor = {
  actorId?: string;
  actorRole?: string;
};

type CreateAssignmentDto = {
  actorId?: string;
  actorRole?: string;
  accessScope?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

type RevokeAssignmentDto = {
  revocationReason?: string;
};

type AssignmentRow = {
  resident_access_assignment_id: string;
  resident_id: string;
  actor_id: string;
  actor_role: string;
  access_scope: string;
  status: 'ACTIVE' | 'REVOKED';
  effective_from: Date | string;
  effective_to: Date | string | null;
  assigned_by: string;
  assigned_by_role: string;
  assigned_at: Date | string;
  revoked_by: string | null;
  revoked_by_role: string | null;
  revoked_at: Date | string | null;
  revocation_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ListFilters = {
  status?: string;
  actorRole?: string;
  actorId?: string;
  limit?: string;
};

@Injectable()
export class ResidentAccessAdministrationService {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  private authorizeSupervisor(
    actor: HumanActor,
  ): {
    actorId: string;
    actorRole: 'SUPERVISOR';
  } {
    const actorId =
      String(actor.actorId ?? '').trim();

    const actorRole =
      String(actor.actorRole ?? '')
        .trim()
        .toUpperCase();

    if (!actorId || !actorRole) {
      throw new UnauthorizedException(
        'Human actor identity required.',
      );
    }

    if (
      actorRole === 'AI' ||
      actorRole === 'SYSTEM'
    ) {
      throw new ForbiddenException(
        'Human supervisor authority required.',
      );
    }

    if (actorRole !== 'SUPERVISOR') {
      throw new ForbiddenException(
        'Supervisor authority required.',
      );
    }

    return {
      actorId,
      actorRole: 'SUPERVISOR',
    };
  }

  private normalizeLimit(
    raw?: string,
  ): number {
    if (
      raw === undefined ||
      raw === null ||
      String(raw).trim() === ''
    ) {
      return 50;
    }

    const value =
      Number.parseInt(String(raw), 10);

    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 100
    ) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 100.',
      );
    }

    return value;
  }

  private parseTimestamp(
    value: string,
    field: string,
  ): Date {
    const parsed =
      new Date(value);

    if (
      !value ||
      Number.isNaN(parsed.getTime())
    ) {
      throw new BadRequestException(
        `${field} must be a valid ISO-8601 timestamp.`,
      );
    }

    return parsed;
  }

  private normalizeCreate(
    input: CreateAssignmentDto,
  ) {
    const actorId =
      String(input.actorId ?? '').trim();

    const actorRole =
      String(input.actorRole ?? '')
        .trim()
        .toUpperCase();

    const accessScope =
      String(input.accessScope ?? '')
        .trim()
        .toUpperCase();

    if (!actorId) {
      throw new BadRequestException(
        'actorId is required.',
      );
    }

    const validPair =
      (
        actorRole === 'CAREGIVER' &&
        accessScope === 'DIRECT_CARE'
      ) ||
      (
        actorRole === 'NURSE' &&
        accessScope === 'CLINICAL_CARE'
      );

    if (!validPair) {
      throw new BadRequestException(
        'Invalid actorRole/accessScope combination.',
      );
    }

    if (!input.effectiveFrom) {
      throw new BadRequestException(
        'effectiveFrom is required.',
      );
    }

    const effectiveFrom =
      this.parseTimestamp(
        input.effectiveFrom,
        'effectiveFrom',
      );

    let effectiveTo: Date | null = null;

    if (
      input.effectiveTo !== undefined &&
      input.effectiveTo !== null &&
      String(input.effectiveTo).trim() !== ''
    ) {
      effectiveTo =
        this.parseTimestamp(
          String(input.effectiveTo),
          'effectiveTo',
        );

      if (
        effectiveTo.getTime() <=
        effectiveFrom.getTime()
      ) {
        throw new BadRequestException(
          'effectiveTo must be after effectiveFrom.',
        );
      }
    }

    return {
      actorId,
      actorRole,
      accessScope,
      effectiveFrom,
      effectiveTo,
    };
  }

  private normalizeRevoke(
    input: RevokeAssignmentDto,
  ) {
    const revocationReason =
      String(
        input.revocationReason ?? '',
      ).trim();

    if (!revocationReason) {
      throw new BadRequestException(
        'revocationReason is required.',
      );
    }

    return {
      revocationReason,
    };
  }

  private effectiveStatus(
    row: AssignmentRow,
  ):
    | 'SCHEDULED'
    | 'ACTIVE'
    | 'EXPIRED'
    | 'REVOKED' {
    if (row.status === 'REVOKED') {
      return 'REVOKED';
    }

    const now =
      Date.now();

    const effectiveFrom =
      new Date(
        row.effective_from,
      ).getTime();

    const effectiveTo =
      row.effective_to
        ? new Date(
            row.effective_to,
          ).getTime()
        : null;

    if (effectiveFrom > now) {
      return 'SCHEDULED';
    }

    if (
      effectiveTo !== null &&
      effectiveTo <= now
    ) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }

  private mapAssignment(
    row: AssignmentRow,
  ) {
    return {
      residentAccessAssignmentId:
        row.resident_access_assignment_id,

      residentId:
        row.resident_id,

      actorId:
        row.actor_id,

      actorRole:
        row.actor_role,

      accessScope:
        row.access_scope,

      persistedStatus:
        row.status,

      effectiveStatus:
        this.effectiveStatus(row),

      effectiveFrom:
        row.effective_from,

      effectiveTo:
        row.effective_to,

      assignedBy:
        row.assigned_by,

      assignedByRole:
        row.assigned_by_role,

      assignedAt:
        row.assigned_at,

      revokedBy:
        row.revoked_by,

      revokedByRole:
        row.revoked_by_role,

      revokedAt:
        row.revoked_at,

      revocationReason:
        row.revocation_reason,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    };
  }

  private assignmentProjection() {
    return `
      resident_access_assignment_id,
      resident_id,
      actor_id,
      actor_role,
      access_scope,
      status,
      effective_from,
      effective_to,
      assigned_by,
      assigned_by_role,
      assigned_at,
      revoked_by,
      revoked_by_role,
      revoked_at,
      revocation_reason,
      created_at,
      updated_at
    `;
  }

  async listAssignments(
    actor: HumanActor,
    filters: ListFilters,
  ) {
    const authority =
      this.authorizeSupervisor(actor);

    const limit =
      this.normalizeLimit(
        filters.limit,
      );

    const status =
      String(
        filters.status ?? 'ALL',
      )
        .trim()
        .toUpperCase();

    const actorRole =
      String(
        filters.actorRole ?? '',
      )
        .trim()
        .toUpperCase();

    const actorId =
      String(
        filters.actorId ?? '',
      ).trim();

    if (
      ![
        'ALL',
        'ACTIVE',
        'REVOKED',
      ].includes(status)
    ) {
      throw new BadRequestException(
        'status must be ACTIVE, REVOKED or ALL.',
      );
    }

    if (
      actorRole &&
      ![
        'CAREGIVER',
        'NURSE',
      ].includes(actorRole)
    ) {
      throw new BadRequestException(
        'actorRole must be CAREGIVER or NURSE.',
      );
    }

    const result =
      await this.database.query<AssignmentRow>(
        `
        SELECT
          ${this.assignmentProjection()}
        FROM resident_access_assignments
        WHERE
          ($1 = 'ALL' OR status = $1)
          AND (
            $2 = ''
            OR actor_role = $2
          )
          AND (
            $3 = ''
            OR actor_id = $3
          )
        ORDER BY
          assigned_at DESC,
          resident_access_assignment_id DESC
        LIMIT $4
        `,
        [
          status,
          actorRole,
          actorId,
          limit,
        ],
      );

    return {
      status: 'OK',

      data:
        result.rows.map(
          (row) =>
            this.mapAssignment(row),
        ),

      meta: {
        limit,
        returned:
          result.rows.length,
      },

      authority: {
        actorId:
          authority.actorId,

        actorRole:
          authority.actorRole,

        serverAuthorized:
          true,

        mutationAuthority:
          'SUPERVISOR_ONLY',
      },
    };
  }

  async listResidentAssignments(
    residentId: string,
    actor: HumanActor,
    filters: ListFilters,
  ) {
    const authority =
      this.authorizeSupervisor(actor);

    const normalizedResidentId =
      String(
        residentId ?? '',
      ).trim();

    if (!normalizedResidentId) {
      throw new BadRequestException(
        'residentId is required.',
      );
    }

    const limit =
      this.normalizeLimit(
        filters.limit,
      );

    const status =
      String(
        filters.status ?? 'ALL',
      )
        .trim()
        .toUpperCase();

    if (
      ![
        'ALL',
        'ACTIVE',
        'REVOKED',
      ].includes(status)
    ) {
      throw new BadRequestException(
        'status must be ACTIVE, REVOKED or ALL.',
      );
    }

    const resident =
      await this.database.query(
        `
        SELECT resident_id
        FROM residents
        WHERE resident_id = $1
        LIMIT 1
        `,
        [
          normalizedResidentId,
        ],
      );

    if (!resident.rowCount) {
      throw new NotFoundException(
        'Resident not found.',
      );
    }

    const result =
      await this.database.query<AssignmentRow>(
        `
        SELECT
          ${this.assignmentProjection()}
        FROM resident_access_assignments
        WHERE
          resident_id = $1
          AND (
            $2 = 'ALL'
            OR status = $2
          )
        ORDER BY
          assigned_at DESC,
          resident_access_assignment_id DESC
        LIMIT $3
        `,
        [
          normalizedResidentId,
          status,
          limit,
        ],
      );

    return {
      status: 'OK',

      residentId:
        normalizedResidentId,

      data:
        result.rows.map(
          (row) =>
            this.mapAssignment(row),
        ),

      meta: {
        limit,
        returned:
          result.rows.length,
      },

      authority: {
        actorId:
          authority.actorId,

        actorRole:
          authority.actorRole,

        serverAuthorized:
          true,

        mutationAuthority:
          'SUPERVISOR_ONLY',
      },
    };
  }

  async createAssignment(
    residentId: string,
    actor: HumanActor,
    input: CreateAssignmentDto,
  ) {
    const authority =
      this.authorizeSupervisor(actor);

    const normalizedResidentId =
      String(
        residentId ?? '',
      ).trim();

    if (!normalizedResidentId) {
      throw new BadRequestException(
        'residentId is required.',
      );
    }

    const normalized =
      this.normalizeCreate(input);

    const assignmentId =
      `raa-${randomUUID()}`;

    const now =
      new Date();

    try {
      const created =
        await this.database.query<AssignmentRow>(
          `
          INSERT INTO resident_access_assignments (
            resident_access_assignment_id,
            resident_id,
            actor_id,
            actor_role,
            access_scope,
            status,
            effective_from,
            effective_to,
            assigned_by,
            assigned_by_role,
            assigned_at
          )
          SELECT
            $1,
            r.resident_id,
            $3,
            $4,
            $5,
            'ACTIVE',
            $6,
            $7,
            $8,
            'SUPERVISOR',
            $9
          FROM residents r
          WHERE
            r.resident_id = $2
            AND r.active_status = true
          RETURNING
            ${this.assignmentProjection()}
          `,
          [
            assignmentId,
            normalizedResidentId,
            normalized.actorId,
            normalized.actorRole,
            normalized.accessScope,
            normalized.effectiveFrom,
            normalized.effectiveTo,
            authority.actorId,
            now,
          ],
        );

      if (!created.rowCount) {
        throw new NotFoundException(
          'Resident not found.',
        );
      }

      return {
        status: 'OK',

        data:
          this.mapAssignment(
            created.rows[0],
          ),

        authority: {
          serverAuthorized:
            true,

          mutationAuthority:
            'SUPERVISOR_ONLY',
        },
      };
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException(
          'Active resident access assignment already exists.',
        );
      }

      throw error;
    }
  }

  async revokeAssignment(
    assignmentId: string,
    actor: HumanActor,
    input: RevokeAssignmentDto,
  ) {
    const authority =
      this.authorizeSupervisor(actor);

    const normalizedAssignmentId =
      String(
        assignmentId ?? '',
      ).trim();

    if (!normalizedAssignmentId) {
      throw new BadRequestException(
        'assignmentId is required.',
      );
    }

    const normalized =
      this.normalizeRevoke(input);

    const now =
      new Date();

    const updated =
      await this.database.query<AssignmentRow>(
        `
        UPDATE resident_access_assignments
        SET
          status = 'REVOKED',
          revoked_by = $2,
          revoked_by_role = 'SUPERVISOR',
          revoked_at = $3,
          revocation_reason = $4,
          updated_at = $3
        WHERE
          resident_access_assignment_id = $1
          AND status = 'ACTIVE'
        RETURNING
          ${this.assignmentProjection()}
        `,
        [
          normalizedAssignmentId,
          authority.actorId,
          now,
          normalized.revocationReason,
        ],
      );

    if (updated.rowCount) {
      return {
        status: 'OK',

        data:
          this.mapAssignment(
            updated.rows[0],
          ),

        idempotentReplay:
          false,

        authority: {
          serverAuthorized:
            true,

          mutationAuthority:
            'SUPERVISOR_ONLY',
        },
      };
    }

    const existing =
      await this.database.query<AssignmentRow>(
        `
        SELECT
          ${this.assignmentProjection()}
        FROM resident_access_assignments
        WHERE
          resident_access_assignment_id = $1
        LIMIT 1
        `,
        [
          normalizedAssignmentId,
        ],
      );

    if (!existing.rowCount) {
      throw new NotFoundException(
        'Access assignment not found.',
      );
    }

    const row =
      existing.rows[0];

    if (row.status === 'REVOKED') {
      return {
        status: 'OK',

        data:
          this.mapAssignment(row),

        idempotentReplay:
          true,

        authority: {
          serverAuthorized:
            true,

          mutationAuthority:
            'SUPERVISOR_ONLY',
        },
      };
    }

    throw new ConflictException(
      'Access assignment is not revocable.',
    );
  }
}
