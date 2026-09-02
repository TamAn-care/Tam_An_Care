import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
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


  async createResident(input: {
    residentId: string;
    residentCode: string;
    displayName: string;
    dateOfBirth: string;
    gender: ResidentGender;
    room: string | null;
    bed: string | null;
    careLevel: ResidentCareLevel;
  }): Promise<ResidentContext> {
    return this.db.withTransaction(
      async (client) => {
        const result =
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
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
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
              input.residentId,
              input.residentCode,
              input.displayName,
              input.dateOfBirth,
              input.gender,
              input.room,
              input.bed,
              input.careLevel,
            ],
          );

        return this.mapResident(
          result.rows[0],
        );
      },
    );
  }

  async updateResident(
    residentId: string,
    input: {
      displayName?: string;
      dateOfBirth?: string;
      gender?: ResidentGender;
      room?: string | null;
      bed?: string | null;
      careLevel?: ResidentCareLevel;
    },
  ): Promise<ResidentContext | null> {
    return this.db.withTransaction(
      async (client) => {
        const current =
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

        if (!current.rows.length) {
          return null;
        }

        const row =
          current.rows[0];

        const result =
          await client.query<ResidentRow>(
            `
            UPDATE residents
            SET
              display_name = $2,
              date_of_birth = $3,
              gender = $4,
              room = $5,
              bed = $6,
              care_level = $7,
              updated_at = now()
            WHERE resident_id = $1
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
              residentId,
              input.displayName
                ?? row.display_name,
              input.dateOfBirth
                ?? (
                  row.date_of_birth instanceof Date
                    ? row.date_of_birth
                        .toISOString()
                        .slice(0, 10)
                    : String(
                        row.date_of_birth
                      ).slice(0, 10)
                ),
              input.gender
                ?? row.gender,
              Object.prototype.hasOwnProperty.call(
                input,
                'room',
              )
                ? input.room ?? null
                : row.room,
              Object.prototype.hasOwnProperty.call(
                input,
                'bed',
              )
                ? input.bed ?? null
                : row.bed,
              input.careLevel
                ?? row.care_level,
            ],
          );

        return this.mapResident(
          result.rows[0],
        );
      },
    );
  }

  async deactivateResident(
    residentId: string,
  ): Promise<ResidentContext | null> {
    return this.db.withTransaction(
      async (client) => {
        const result =
          await client.query<ResidentRow>(
            `
            UPDATE residents
            SET
              active_status = false,
              updated_at = now()
            WHERE resident_id = $1
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

}
