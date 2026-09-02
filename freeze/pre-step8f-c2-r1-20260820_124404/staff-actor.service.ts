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

    const rows = await this.database.query<StaffActorRecord>(
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

    return rows[0] ?? null;
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

    return this.database.query<StaffActorRecord>(
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
  }

  async listActiveStaffActors(
    limit?: number,
  ): Promise<StaffActorRecord[]> {
    const boundedLimit = this.boundLimit(limit);

    return this.database.query<StaffActorRecord>(
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
