import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';
import { ClinicalRepository } from './clinical.repository';

const UNITS: Record<string, string> = {
  sysBP: 'mmHg', diaBP: 'mmHg', heartRate: 'bpm', temp: '°C',
  spo2: '%', respRate: '/min', weight: 'kg', bloodGlucose: 'mmol/L',
};

@Injectable()
export class VitalSignService {
  constructor(private readonly db: DatabaseService, private readonly scope: ResidentAccessScopeService,
    private readonly audit: ClinicalRepository) {}

  async record(residentId: string, actorId: string | undefined, role: string | undefined,
    input: { measuredAt?: string; measurements?: Record<string, unknown>; note?: string }) {
    if (!actorId || role !== 'NURSE') throw new ForbiddenException('Nurse authority is required');
    const measuredAt = input?.measuredAt;
    const values = input?.measurements;
    if (!measuredAt || !Number.isFinite(Date.parse(measuredAt)) || !values ||
        typeof values !== 'object' || Array.isArray(values)) {
      throw new BadRequestException('Valid measurement timestamp and values are required');
    }
    const entries = Object.entries(values);
    if (!entries.length || entries.length > 8 || entries.some(([key, value]) =>
      !Object.prototype.hasOwnProperty.call(UNITS, key) || typeof value !== 'number' || !Number.isFinite(value))) {
      throw new BadRequestException('Measurements must contain supported finite numeric values');
    }
    if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 2000)) {
      throw new BadRequestException('Measurement note is invalid');
    }
    const predicate = this.scope.sqlPredicate('r', actorId, 'NURSE');
    return this.db.withTransaction(async client => {
      const recorded: string[] = [];
      for (const [type, value] of entries) {
        const id = randomUUID();
        const result = await client.query(`
          INSERT INTO clinical_observations (
            clinical_observation_id, resident_id, observation_code, observation_type,
            numeric_value, text_value, unit, measured_at, recorded_by, recorded_by_role, status
          )
          SELECT $5, r.resident_id, $5, $6, $7, $8, $9, $10::timestamptz, $1, 'NURSE', 'RECORDED'
          FROM residents r WHERE (${predicate.sql}) AND r.resident_id = $4
          RETURNING *
        `, [...predicate.params, residentId, id, type, value, input.note || null, UNITS[type], measuredAt]);
        if (result.rows.length !== 1) throw new NotFoundException('Resident not found');
        await this.audit.insertAudit(client, {
          aggregateColumn: 'clinical_observation_id', aggregateId: id, residentId,
          eventType: 'OBSERVATION_RECORDED', actorId, actorRole: 'NURSE',
          previousState: null, newState: result.rows[0],
        });
        recorded.push(id);
      }
      return { recorded };
    });
  }
}
