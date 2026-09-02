import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateResidentInput,
  ResidentCareLevel,
  ResidentContext,
  ResidentGender,
} from './resident.types';

interface ResidentRow {
  resident_id: string;
  resident_code: string;
  display_name: string;
  date_of_birth: string | Date;
  gender: ResidentGender;
  room: string | null;
  bed: string | null;
  care_level: ResidentCareLevel;
  active_status: boolean;
}

@Injectable()
export class ResidentRepository {
  constructor(
    private readonly db: DatabaseService,
  ) {}


  async resolveActiveSupervisor(
    actorId: string,
  ): Promise<boolean> {
    return this.db.withTransaction(
      async (client) => {
        const result =
          await client.query(
            `
            SELECT 1
            FROM staff_actors
            WHERE
              actor_id = $1
              AND status = 'ACTIVE'
              AND primary_operational_role = 'SUPERVISOR'
            LIMIT 1
            `,
            [actorId],
          );

        return result.rows.length === 1;
      },
    );
  }

  async createWithAudit(
    input: CreateResidentInput,
    performedBy: string,
    performedByRole: 'SUPERVISOR',
  ): Promise<ResidentContext> {
    return this.db.withTransaction(
      async (client) => {
        const created =
          await client.query<ResidentRow>(
            `
            INSERT INTO residents (
              resident_id,
              resident_code,
              display_name,
              date_of_birth,
              gender,
              room,
              bed,
              care_level,
              active_status
            )
            VALUES (
              'resident-' || gen_random_uuid()::text,
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              true
            )
            RETURNING
              resident_id,
              resident_code,
              display_name,
              date_of_birth,
              gender,
              room,
              bed,
              care_level,
              active_status
            `,
            [
              input.residentCode,
              input.displayName,
              input.dateOfBirth,
              input.gender,
              input.room,
              input.bed,
              input.careLevel,
            ],
          );

        const row = created.rows[0];

        if (!row) {
          throw new Error(
            'Resident creation returned no row',
          );
        }

        await client.query(
          `
          INSERT INTO resident_audit (
            event_type,
            target_resident_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          VALUES (
            'RESIDENT_CREATED',
            $1,
            $2,
            $3,
            NULL,
            jsonb_build_object(
              'residentId', $1::text,
              'residentCode', $4::text,
              'displayName', $5::text,
              'dateOfBirth', $6::date,
              'gender', $7::text,
              'room', $8::text,
              'bed', $9::text,
              'careLevel', $10::text,
              'activeStatus', true
            )
          )
          `,
          [
            row.resident_id,
            performedBy,
            performedByRole,
            row.resident_code,
            row.display_name,
            String(row.date_of_birth)
              .slice(0, 10),
            row.gender,
            row.room,
            row.bed,
            row.care_level,
          ],
        );

        return this.mapResident(row);
      },
    );
  }

  async list(): Promise<ResidentContext[]> {
    return this.db.withTransaction(
      async (client) => {
        const result =
          await client.query<ResidentRow>(
            `
            SELECT
              resident_id,
              resident_code,
              display_name,
              date_of_birth,
              gender,
              room,
              bed,
              care_level,
              active_status
            FROM residents
            ORDER BY
              resident_code ASC,
              resident_id ASC
            `,
          );

        return result.rows.map(
          (row) => this.mapResident(row),
        );
      },
    );
  }

  async findById(
    residentId: string,
  ): Promise<ResidentContext | null> {
    return this.db.withTransaction(
      async (client) => {
        const result =
          await client.query<ResidentRow>(
            `
            SELECT
              resident_id,
              resident_code,
              display_name,
              date_of_birth,
              gender,
              room,
              bed,
              care_level,
              active_status
            FROM residents
            WHERE resident_id = $1
            LIMIT 1
            `,
            [residentId],
          );

        if (!result.rows.length) {
          return null;
        }

        return this.mapResident(
          result.rows[0],
        );
      },
    );
  }

  private mapResident(
    row: ResidentRow,
  ): ResidentContext {
    const dateOfBirth =
      row.date_of_birth instanceof Date
        ? row.date_of_birth
            .toISOString()
            .slice(0, 10)
        : String(row.date_of_birth)
            .slice(0, 10);

    return {
      residentId:
        row.resident_id,

      residentCode:
        row.resident_code,

      displayName:
        row.display_name,

      dateOfBirth,

      gender:
        row.gender,

      room:
        row.room,

      bed:
        row.bed,

      careLevel:
        row.care_level,

      activeStatus:
        row.active_status,
    };
  }
}
