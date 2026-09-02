import {
  Injectable,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

export type StaffActorRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR'
  | 'CARE_MANAGER';

export type StaffActorStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface StaffActorRecord {
  actor_id: string;
  staff_code: string;
  display_name: string;
  primary_operational_role: StaffActorRole;
  status: StaffActorStatus;
  employment_reference: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CanonicalActorResolution {
  found: boolean;
  actorId: string;
  displayName: string | null;
  staffCode: string | null;
  canonicalRole: StaffActorRole | null;
  status: StaffActorStatus | null;
  active: boolean;
}

export interface CreateStaffActorInput {
  actorId: string;
  staffCode: string;
  displayName: string;
  primaryOperationalRole: StaffActorRole;
  employmentReference?: string | null;
}

export interface UpdateStaffActorInput {
  displayName?: string;
  employmentReference?: string | null;
  primaryOperationalRole?: StaffActorRole;
  status?: StaffActorStatus;
}

@Injectable()
export class StaffActorService {
  private readonly defaultLimit = 50;

  private readonly maxLimit = 100;

  constructor(
    private readonly database: DatabaseService,
  ) {}

  async findByActorId(
    actorId: string,
  ): Promise<StaffActorRecord | null> {
    const normalizedActorId = String(actorId || '').trim();

    if (!normalizedActorId) {
      return null;
    }

    const result = await this.database.query<StaffActorRecord>(
      `
      SELECT
        actor_id,
        staff_code,
        display_name,
        primary_operational_role,
        status,
        employment_reference,
        created_at,
        updated_at
      FROM staff_actors
      WHERE actor_id = $1
      LIMIT 1
      `,
      [normalizedActorId],
    );

    return result.rows[0] ?? null;
  }

  async resolveCanonicalActor(
    actorId: string,
  ): Promise<CanonicalActorResolution> {
    const actor = await this.findByActorId(actorId);

    if (!actor) {
      return {
        found: false,
        actorId: String(actorId || '').trim(),
        displayName: null,
        staffCode: null,
        canonicalRole: null,
        status: null,
        active: false,
      };
    }

    return {
      found: true,
      actorId: actor.actor_id,
      displayName: actor.display_name,
      staffCode: actor.staff_code,
      canonicalRole: actor.primary_operational_role,
      status: actor.status,
      active: actor.status === 'ACTIVE',
    };
  }

  async resolveActiveActor(
    actorId: string,
  ): Promise<StaffActorRecord | null> {
    const actor = await this.findByActorId(actorId);

    if (!actor || actor.status !== 'ACTIVE') {
      return null;
    }

    return actor;
  }

  async resolveActiveActorWithRole(
    actorId: string,
    claimedRole: string,
  ): Promise<StaffActorRecord | null> {
    const actor = await this.resolveActiveActor(actorId);

    if (!actor) {
      return null;
    }

    const role = String(claimedRole || '')
      .trim()
      .toUpperCase();

    if (
      actor.primary_operational_role
      !== role
    ) {
      return null;
    }

    return actor;
  }

  async listStaffActors(
    limit?: number,
  ): Promise<StaffActorRecord[]> {
    const boundedLimit = this.boundLimit(limit);

    const result = await this.database.query<StaffActorRecord>(
      `
      SELECT
        actor_id,
        staff_code,
        display_name,
        primary_operational_role,
        status,
        employment_reference,
        created_at,
        updated_at
      FROM staff_actors
      ORDER BY
        display_name ASC,
        actor_id ASC
      LIMIT $1
      `,
      [boundedLimit],
    );

    return result.rows;
  }

  async listActiveStaffActors(
    limit?: number,
  ): Promise<StaffActorRecord[]> {
    const boundedLimit = this.boundLimit(limit);

    const result = await this.database.query<StaffActorRecord>(
      `
      SELECT
        actor_id,
        staff_code,
        display_name,
        primary_operational_role,
        status,
        employment_reference,
        created_at,
        updated_at
      FROM staff_actors
      WHERE status = 'ACTIVE'
      ORDER BY
        primary_operational_role ASC,
        display_name ASC,
        actor_id ASC
      LIMIT $1
      `,
      [boundedLimit],
    );

    return result.rows;
  }

  async createStaffActor(
    input: CreateStaffActorInput,
    performedBy: string,
    performedByRole: string,
  ): Promise<StaffActorRecord> {
    const actorId = String(input.actorId || '').trim();
    const staffCode = String(input.staffCode || '').trim();
    const displayName = String(input.displayName || '').trim();
    const role = String(
      input.primaryOperationalRole || '',
    ).trim().toUpperCase() as StaffActorRole;

    const employmentReference =
      input.employmentReference == null
        ? null
        : String(
            input.employmentReference,
          ).trim() || null;

    if (!actorId || !staffCode || !displayName) {
      throw new Error(
        'actorId, staffCode and displayName are required',
      );
    }

    const result =
      await this.database.query<StaffActorRecord>(
        `
        WITH inserted AS (
          INSERT INTO staff_actors (
            actor_id,
            staff_code,
            display_name,
            primary_operational_role,
            status,
            employment_reference
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'ACTIVE',
            $5
          )
          RETURNING
            actor_id,
            staff_code,
            display_name,
            primary_operational_role,
            status,
            employment_reference,
            created_at,
            updated_at
        ),
        audit_insert AS (
          INSERT INTO staff_actor_audit (
            event_type,
            target_actor_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          SELECT
            'STAFF_CREATED',
            actor_id,
            $6,
            $7,
            NULL,
            to_jsonb(inserted)
          FROM inserted
          RETURNING audit_id
        )
        SELECT
          actor_id,
          staff_code,
          display_name,
          primary_operational_role,
          status,
          employment_reference,
          created_at,
          updated_at
        FROM inserted
        `,
        [
          actorId,
          staffCode,
          displayName,
          role,
          employmentReference,
          performedBy,
          performedByRole,
        ],
      );

    const actor = result.rows[0];

    if (!actor) {
      throw new Error(
        'Staff actor creation failed',
      );
    }

    return actor;
  }

  async updateStaffActor(
    actorId: string,
    input: UpdateStaffActorInput,
    performedBy: string,
    performedByRole: string,
  ): Promise<StaffActorRecord | null> {
    const normalizedActorId =
      String(actorId || '').trim();

    if (!normalizedActorId) {
      return null;
    }

    const current =
      await this.findByActorId(
        normalizedActorId,
      );

    if (!current) {
      return null;
    }

    const nextDisplayName =
      input.displayName === undefined
        ? current.display_name
        : String(input.displayName || '').trim();

    if (!nextDisplayName) {
      throw new Error(
        'displayName cannot be empty',
      );
    }

    const nextEmploymentReference =
      input.employmentReference === undefined
        ? current.employment_reference
        : (
            input.employmentReference == null
              ? null
              : String(
                  input.employmentReference,
                ).trim() || null
          );

    const nextRole =
      input.primaryOperationalRole === undefined
        ? current.primary_operational_role
        : input.primaryOperationalRole;

    const nextStatus =
      input.status === undefined
        ? current.status
        : input.status;

    const removesActiveSupervisor =
      current.primary_operational_role === 'SUPERVISOR'
      && current.status === 'ACTIVE'
      && (
        nextRole !== 'SUPERVISOR'
        || nextStatus !== 'ACTIVE'
      );

    const result =
      await this.database.query<StaffActorRecord>(
        `
        WITH guard AS (
          SELECT
            CASE
              WHEN $8::boolean = false THEN true
              ELSE (
                SELECT COUNT(*) > 1
                FROM staff_actors
                WHERE
                  primary_operational_role = 'SUPERVISOR'
                  AND status = 'ACTIVE'
              )
            END AS allowed
        ),
        previous_row AS (
          SELECT *
          FROM staff_actors
          WHERE actor_id = $1
        ),
        updated AS (
          UPDATE staff_actors
          SET
            display_name = $2,
            employment_reference = $3,
            primary_operational_role = $4,
            status = $5,
            updated_at = now()
          WHERE
            actor_id = $1
            AND (
              SELECT allowed
              FROM guard
            )
          RETURNING
            actor_id,
            staff_code,
            display_name,
            primary_operational_role,
            status,
            employment_reference,
            created_at,
            updated_at
        ),
        audit_insert AS (
          INSERT INTO staff_actor_audit (
            event_type,
            target_actor_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          SELECT
            CASE
              WHEN p.primary_operational_role
                   IS DISTINCT FROM u.primary_operational_role
                THEN 'STAFF_ROLE_CHANGED'
              WHEN p.status
                   IS DISTINCT FROM u.status
                THEN 'STAFF_STATUS_CHANGED'
              ELSE 'STAFF_PROFILE_UPDATED'
            END,
            u.actor_id,
            $6,
            $7,
            to_jsonb(p),
            to_jsonb(u)
          FROM previous_row p
          JOIN updated u
            ON u.actor_id = p.actor_id
          RETURNING audit_id
        )
        SELECT
          actor_id,
          staff_code,
          display_name,
          primary_operational_role,
          status,
          employment_reference,
          created_at,
          updated_at
        FROM updated
        `,
        [
          normalizedActorId,
          nextDisplayName,
          nextEmploymentReference,
          nextRole,
          nextStatus,
          performedBy,
          performedByRole,
          removesActiveSupervisor,
        ],
      );

    const updated = result.rows[0];

    if (
      !updated
      && removesActiveSupervisor
    ) {
      throw new Error(
        'Last active Supervisor cannot be deactivated or demoted',
      );
    }

    return updated ?? null;
  }

  private boundLimit(
    requested?: number,
  ): number {
    if (
      requested === undefined
      || requested === null
      || !Number.isFinite(Number(requested))
    ) {
      return this.defaultLimit;
    }

    const normalized = Math.floor(Number(requested));

    if (normalized < 1) {
      return this.defaultLimit;
    }

    return Math.min(
      normalized,
      this.maxLimit,
    );
  }
}
