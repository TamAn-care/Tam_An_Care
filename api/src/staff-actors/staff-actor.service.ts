import { BadRequestException } from '@nestjs/common';
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

import {
  DatabaseService,
} from '../database/database.service';

export type StaffActorRole =
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
  department: string;
  email: string;
  phone: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateStaffActorInput {
  staffCode: string;
  displayName: string;
  primaryOperationalRole: StaffActorRole;
  employmentReference: string | null;
  department: string;
  email: string;
  phone: string;
  initialPassword: string;
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

@Injectable()
export class StaffActorService {
  private readonly defaultLimit = 50;
  private readonly maxLimit = 100;

  constructor(
    private readonly database: DatabaseService,
  ) {}

  private passwordMaterial(password: string) {
    const salt = randomBytes(16).toString('hex');
    const iterations = 210000;
    const digest = 'sha256';

    const passwordHash = pbkdf2Sync(
      password,
      salt,
      iterations,
      32,
      digest,
    ).toString('hex');

    return {
      salt,
      iterations,
      digest,
      passwordHash,
    };
  }

  async createStaffActor(
    input: CreateStaffActorInput,
    performedBy: string,
    performedByRole: 'SUPERVISOR' | 'ADMIN',
  ): Promise<StaffActorRecord> {
    const material = this.passwordMaterial(
      input.initialPassword,
    );

    return this.database.withTransaction(
      async (client) => {
        const created =
          await client.query<StaffActorRecord>(
            `
            INSERT INTO staff_actors (
              actor_id,
              staff_code,
              display_name,
              primary_operational_role,
              status,
              employment_reference,
              department,
              email,
              phone
            )
            VALUES (
              $1,
              $1,
              $2,
              $3,
              'ACTIVE',
              $4,
              $5,
              $6,
              $7
            )
            RETURNING
              actor_id,
              staff_code,
              display_name,
              primary_operational_role,
              status,
              employment_reference,
              department,
              email,
              phone,
              created_at,
              updated_at
            `,
            [
              input.staffCode,
              input.displayName,
              input.primaryOperationalRole,
              input.employmentReference,
              input.department,
              input.email,
              input.phone,
            ],
          );

        const actor = created.rows[0];

        if (!actor) {
          throw new Error(
            'Staff actor creation returned no row',
          );
        }

        await client.query(
          `
          INSERT INTO auth_credentials (
            actor_id,
            password_hash,
            password_salt,
            password_iterations,
            password_digest,
            failed_attempts,
            locked_until,
            password_changed_at,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            0,
            NULL,
            now(),
            now(),
            now()
          )
          `,
          [
            actor.actor_id,
            material.passwordHash,
            material.salt,
            material.iterations,
            material.digest,
          ],
        );

        await client.query(
          `
          INSERT INTO staff_actor_audit (
            event_type,
            target_actor_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          VALUES (
            'STAFF_CREATED',
            $1,
            $2,
            $3,
            NULL,
            jsonb_build_object(
              'actorId', $1::text,
              'staffCode', $4::text,
              'displayName', $5::text,
              'primaryOperationalRole', $6::text,
              'status', 'ACTIVE'
            )
          )
          `,
          [
            actor.actor_id,
            performedBy,
            performedByRole,
            actor.staff_code,
            actor.display_name,
            actor.primary_operational_role,
          ],
        );

        return actor;
      },
    );
  }

  async findByActorId(
    actorId: string,
  ): Promise<StaffActorRecord | null> {
    const normalized =
      String(actorId || '').trim();

    if (!normalized) {
      return null;
    }

    const result =
      await this.database.query<StaffActorRecord>(
        `
        SELECT
          actor_id,
          staff_code,
          display_name,
          primary_operational_role,
          status,
          employment_reference,
          department,
          email,
          phone,
          created_at,
          updated_at
        FROM staff_actors
        WHERE actor_id = $1
        LIMIT 1
        `,
        [normalized],
      );

    return result.rows[0] ?? null;
  }

  async findByStaffCode(
    staffCode: string,
  ): Promise<StaffActorRecord | null> {
    const normalized =
      String(staffCode || '').trim();

    if (!normalized) {
      return null;
    }

    const result =
      await this.database.query<StaffActorRecord>(
        `
        SELECT
          actor_id,
          staff_code,
          display_name,
          primary_operational_role,
          status,
          employment_reference,
          department,
          email,
          phone,
          created_at,
          updated_at
        FROM staff_actors
        WHERE UPPER(staff_code) = UPPER($1)
        LIMIT 1
        `,
        [normalized],
      );

    return result.rows[0] ?? null;
  }

  async resolveCanonicalActor(
    actorId: string,
  ): Promise<CanonicalActorResolution> {
    const actor =
      await this.findByActorId(actorId);

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
    const actor =
      await this.findByActorId(actorId);

    if (!actor || actor.status !== 'ACTIVE') {
      return null;
    }

    return actor;
  }

  async resolveActiveActorWithRole(
    actorId: string,
    claimedRole: string,
  ): Promise<StaffActorRecord | null> {
    const actor =
      await this.resolveActiveActor(actorId);

    if (!actor) {
      return null;
    }

    const role = String(claimedRole || '')
      .trim()
      .toUpperCase();

    if (actor.primary_operational_role !== role) {
      return null;
    }

    return actor;
  }

  async listStaffActors(
    limit?: number,
  ): Promise<StaffActorRecord[]> {
    const boundedLimit = this.boundLimit(limit);

    const result =
      await this.database.query<StaffActorRecord>(
        `
        SELECT
          actor_id,
          staff_code,
          display_name,
          primary_operational_role,
          status,
          employment_reference,
          department,
          email,
          phone,
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

    const result =
      await this.database.query<StaffActorRecord>(
        `
        SELECT
          actor_id,
          staff_code,
          display_name,
          primary_operational_role,
          status,
          employment_reference,
          department,
          email,
          phone,
          created_at,
          updated_at
        FROM staff_actors
        WHERE status = 'ACTIVE'
        ORDER BY
          primary_operational_role,
          display_name,
          actor_id
        LIMIT $1
        `,
        [boundedLimit],
      );

    return result.rows;
  }

  async resetPassword(
    actorId: string,
    password: string,
    performedBy: string,
  ): Promise<StaffActorRecord | null> {
    // PROTECTED_ADMIN_RESET_FORBIDDEN
    // TA-DIR-001 may change its own password only through
    // self/change-password after verifying the current password.
    if (actorId === 'TA-DIR-001') {
      await this.database.query(
        `
        INSERT INTO staff_actor_audit (
          event_type,
          target_actor_id,
          performed_by,
          performed_by_role,
          previous_value,
          new_value
        )
        VALUES (
          'STAFF_PROFILE_UPDATED',
          $1,
          $2,
          'SUPERVISOR',
          NULL,
          jsonb_build_object(
            'passwordResetBlocked', true,
            'protectedAccount', true,
            'reason', 'PROTECTED_ADMIN_ACCOUNT'
          )
        )
        `,
        [
          actorId,
          performedBy,
        ],
      );

      throw new BadRequestException(
        'PROTECTED_ADMIN_RESET_FORBIDDEN',
      );
    }

    const actor =
      await this.findByActorId(actorId);

    if (!actor) {
      return null;
    }

    const material =
      this.passwordMaterial(password);

    await this.database.withTransaction(
      async (client) => {
        await client.query(
          `
          INSERT INTO auth_credentials (
            actor_id,
            password_hash,
            password_salt,
            password_iterations,
            password_digest,
            failed_attempts,
            locked_until,
            password_changed_at,
            created_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,
            0,NULL,now(),now(),now()
          )
          ON CONFLICT (actor_id)
          DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            password_salt = EXCLUDED.password_salt,
            password_iterations = EXCLUDED.password_iterations,
            password_digest = EXCLUDED.password_digest,
            failed_attempts = 0,
            locked_until = NULL,
            password_changed_at = now(),
            updated_at = now()
          `,
          [
            actorId,
            material.passwordHash,
            material.salt,
            material.iterations,
            material.digest,
          ],
        );

        await client.query(
          `
          UPDATE auth_sessions
          SET
            revoked_at = now(),
            revoked_reason = 'STAFF_PROFILE_UPDATED'
          WHERE actor_id = $1
            AND revoked_at IS NULL
          `,
          [actorId],
        );

        await client.query(
          `
          UPDATE staff_actors
          SET updated_at = now()
          WHERE actor_id = $1
          `,
          [actorId],
        );

        await client.query(
          `
          INSERT INTO staff_actor_audit (
            event_type,
            target_actor_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          VALUES (
            'STAFF_PROFILE_UPDATED',
            $1,
            $2,
            'SUPERVISOR',
            NULL,
            jsonb_build_object(
              'passwordReset', true
            )
          )
          `,
          [
            actorId,
            performedBy,
          ],
        );
      },
    );

    return this.findByActorId(actorId);
  }

  async updateStatus(
    actorId: string,
    status: StaffActorStatus,
    reason: string,
    performedBy: string,
  ): Promise<StaffActorRecord | null> {
    const actor =
      await this.findByActorId(actorId);

    if (!actor) {
      return null;
    }

    await this.database.withTransaction(
      async (client) => {
        await client.query(
          `
          UPDATE staff_actors
          SET
            status = $2,
            updated_at = now()
          WHERE actor_id = $1
          `,
          [
            actorId,
            status,
          ],
        );

        if (status !== 'ACTIVE') {
          await client.query(
            `
            UPDATE auth_sessions
            SET
              revoked_at = now(),
              revoked_reason = 'ACCOUNT_' || $2
            WHERE actor_id = $1
              AND revoked_at IS NULL
            `,
            [
              actorId,
              status,
            ],
          );
        }

        await client.query(
          `
          INSERT INTO staff_actor_audit (
            event_type,
            target_actor_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          VALUES (
            'STAFF_STATUS_CHANGED',
            $1,
            $2,
            'SUPERVISOR',
            jsonb_build_object(
              'status', $3::text
            ),
            jsonb_build_object(
              'status', $4::text,
              'reason', $5::text
            )
          )
          `,
          [
            actorId,
            performedBy,
            actor.status,
            status,
            reason,
          ],
        );
      },
    );

    return this.findByActorId(actorId);
  }

  async changeOwnPassword(
    actorId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const result =
      await this.database.query<{
        password_hash: string;
        password_salt: string;
        password_iterations: number;
        password_digest: string;
        status: StaffActorStatus;
      }>(
        `
        SELECT
          c.password_hash,
          c.password_salt,
          c.password_iterations,
          c.password_digest,
          s.status
        FROM auth_credentials c
        JOIN staff_actors s
          ON s.actor_id = c.actor_id
        WHERE c.actor_id = $1
        LIMIT 1
        `,
        [actorId],
      );

    const row = result.rows[0];

    if (!row || row.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Account is not active',
      );
    }

    const calculated =
      pbkdf2Sync(
        currentPassword,
        row.password_salt,
        row.password_iterations,
        32,
        row.password_digest,
      );

    const expected =
      Buffer.from(
        row.password_hash,
        'hex',
      );

    const valid =
      expected.length === calculated.length &&
      timingSafeEqual(
        expected,
        calculated,
      );

    if (!valid) {
      throw new UnauthorizedException(
        'Current password is incorrect',
      );
    }

    const material =
      this.passwordMaterial(newPassword);

    await this.database.withTransaction(
      async (client) => {
        await client.query(
          `
          UPDATE auth_credentials
          SET
            password_hash = $2,
            password_salt = $3,
            password_iterations = $4,
            password_digest = $5,
            failed_attempts = 0,
            locked_until = NULL,
            password_changed_at = now(),
            updated_at = now()
          WHERE actor_id = $1
          `,
          [
            actorId,
            material.passwordHash,
            material.salt,
            material.iterations,
            material.digest,
          ],
        );

        await client.query(
          `
          UPDATE auth_sessions
          SET
            revoked_at = now(),
            revoked_reason = 'SELF_PASSWORD_CHANGE'
          WHERE actor_id = $1
            AND revoked_at IS NULL
          `,
          [actorId],
        );

        await client.query(
          `
          UPDATE staff_actors
          SET updated_at = now()
          WHERE actor_id = $1
          `,
          [actorId],
        );

        await client.query(
          `
          INSERT INTO staff_actor_audit (
            event_type,
            target_actor_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          VALUES (
            'STAFF_PROFILE_UPDATED',
            $1,
            $1,
            $2,
            NULL,
            jsonb_build_object(
              'passwordChanged', true
            )
          )
          `,
          [
            actorId,
            row.status === 'ACTIVE'
              ? (
                  (
                    await client.query<{
                      primary_operational_role: string
                    }>(
                      `
                      SELECT primary_operational_role
                      FROM staff_actors
                      WHERE actor_id = $1
                      LIMIT 1
                      `,
                      [actorId],
                    )
                  ).rows[0]?.primary_operational_role
                  || 'CAREGIVER'
                )
              : 'CAREGIVER',
          ],
        );
      },
    );

    return true;
  }

  private boundLimit(
    requested?: number,
  ): number {
    if (
      requested === undefined ||
      requested === null ||
      !Number.isFinite(Number(requested))
    ) {
      return this.defaultLimit;
    }

    const normalized =
      Math.floor(Number(requested));

    if (normalized < 1) {
      return this.defaultLimit;
    }

    return Math.min(
      normalized,
      this.maxLimit,
    );
  }
}
