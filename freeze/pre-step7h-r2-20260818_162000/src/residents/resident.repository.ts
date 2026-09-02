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
}
