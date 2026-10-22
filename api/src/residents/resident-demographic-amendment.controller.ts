import {
  BadRequestException, Body, ConflictException, Controller, Get,
  Headers, NotFoundException, Param, Patch,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ResidentService } from './resident.service';

type AmendmentInput = {
  expectedRevision?: string;
  dateOfBirth?: string;
  reason?: string;
};

@Controller('api/residents')
export class ResidentDemographicAmendmentController {
  constructor(
    private readonly database: DatabaseService,
    private readonly residents: ResidentService,
  ) {}

  private async supervisor(actorId?: string, actorRole?: string) {
    await this.residents.authorizeSupervisor(actorId, actorRole);
    return String(actorId);
  }

  @Get(':residentId/demographics/edit-context')
  async editContext(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    await this.supervisor(actorId, actorRole);
    const result = await this.database.query(
      `SELECT resident_id, date_of_birth::text AS date_of_birth,
         birth_date_precision,
         to_char(updated_at AT TIME ZONE 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision
       FROM residents WHERE resident_id = $1 LIMIT 1`, [residentId],
    );
    if (result.rows.length !== 1) throw new NotFoundException('Resident not found.');
    const row = result.rows[0];
    return { residentId: row.resident_id, dateOfBirth: row.date_of_birth,
      birthDatePrecision: row.birth_date_precision, revision: row.revision };
  }

  @Patch(':residentId/demographics')
  async amend(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() input: AmendmentInput = {},
  ) {
    const operator = await this.supervisor(actorId, actorRole);
    const dateOfBirth = String(input.dateOfBirth ?? '').trim();
    const expectedRevision = String(input.expectedRevision ?? '').trim();
    const reason = String(input.reason ?? '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(Date.parse(dateOfBirth)) ||
      new Date(dateOfBirth).toISOString().slice(0, 10) !== dateOfBirth ||
      dateOfBirth > new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('Date of birth must be a valid YYYY-MM-DD.');
    }
    if (!expectedRevision ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(expectedRevision)) {
      throw new BadRequestException('Valid expectedRevision is required.');
    }
    if (reason.length < 10 || reason.length > 500) {
      throw new BadRequestException('Correction reason must contain 10–500 characters.');
    }

    return this.database.withTransaction(async (client) => {
      const current = await client.query(
        `SELECT resident_id, date_of_birth::text AS date_of_birth,
         birth_date_precision,
         to_char(updated_at AT TIME ZONE 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision
         FROM residents WHERE resident_id = $1 FOR UPDATE`,
        [residentId],
      );
      if (current.rows.length !== 1) throw new NotFoundException('Resident not found.');
      const before = current.rows[0];
      if (before.revision !== expectedRevision) {
        throw new ConflictException('Resident changed. Reload before updating.');
      }
      if (before.birth_date_precision === 'YEAR_ONLY') {
        throw new ConflictException('Year-only birth dates require a separate approved precision change.');
      }
      if (before.date_of_birth === dateOfBirth) {
        return { residentId, changed: false, dateOfBirth };
      }
      const admission = await client.query(
        `SELECT admission_case_id, date_of_birth::text AS date_of_birth
         FROM admission_cases WHERE resident_id = $1 FOR UPDATE`, [residentId],
      );
      if (admission.rows.length > 1) {
        throw new ConflictException('Multiple admissions require manual reconciliation.');
      }
      if (admission.rows.length === 1 &&
        admission.rows[0].date_of_birth !== before.date_of_birth) {
        throw new ConflictException('Admission and resident data are inconsistent.');
      }

      await client.query(
        `UPDATE residents SET date_of_birth=$2::date,
          birth_year=EXTRACT(YEAR FROM $2::date)::integer,
          updated_at=NOW() WHERE resident_id=$1`,
        [residentId, dateOfBirth],
      );
      if (admission.rows.length === 1) {
        await client.query(
          `UPDATE admission_cases SET date_of_birth=$2::date,
            birth_year=EXTRACT(YEAR FROM $2::date)::integer,
            updated_at=NOW(), record_version=record_version+1
           WHERE admission_case_id=$1`,
          [admission.rows[0].admission_case_id, dateOfBirth],
        );
      }
      await client.query(
        `INSERT INTO resident_demographic_audit (
          event_type, target_resident_id, performed_by, performed_by_role,
          previous_value, new_value, reason
        ) VALUES (
          'RESIDENT_DEMOGRAPHICS_CORRECTED', $1, $2, 'SUPERVISOR',
          jsonb_build_object('dateOfBirth', $3::text),
          jsonb_build_object('dateOfBirth', $4::text,
            'source','AUTHORIZED_CORRECTION'), $5::text
        )`,
        [residentId, operator, before.date_of_birth, dateOfBirth, reason],
      );
      if (admission.rows.length === 1) {
        await client.query(
          `INSERT INTO admission_audit (
            admission_case_id, event_type, actor_id, actor_role,
            entity_type, entity_id, reason, previous_state, new_state
          ) VALUES (
            $1, 'DEMOGRAPHIC_CORRECTION', $2, 'SUPERVISOR',
            'RESIDENT', $3, $4,
            jsonb_build_object('dateOfBirth', $5::text),
            jsonb_build_object('dateOfBirth', $6::text)
          )`,
          [admission.rows[0].admission_case_id, operator, residentId,
            reason, before.date_of_birth, dateOfBirth],
        );
      }
      return { residentId, changed: true, dateOfBirth };
    });
  }
}
