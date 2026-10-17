import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ResidentAccessHumanRole, ResidentAccessScopeService } from './resident-access-scope.service';

@Controller('api/operations/residents')
export class AssignedResidentController {
  constructor(private readonly db: DatabaseService, private readonly scope: ResidentAccessScopeService) {}

  @Get('assigned')
  async list(@Headers('x-actor-id') actorId?: string, @Headers('x-actor-role') role?: string) {
    if (!actorId || !['NURSE', 'CAREGIVER', 'PSYCHOLOGIST', 'SOCIAL_WORKER'].includes(role ?? '')) {
      throw new ForbiddenException('Assigned care role is required');
    }
    const predicate = this.scope.sqlPredicate('r', actorId, role as ResidentAccessHumanRole);
    const result = await this.db.query(`
      SELECT r.resident_id AS "residentId", r.resident_code AS "residentCode",
        r.display_name AS "displayName", r.gender, r.room, r.bed,
        r.care_level AS "careLevel", r.active_status AS "activeStatus"
      FROM residents r WHERE (${predicate.sql}) ORDER BY r.resident_id
    `, predicate.params);
    return result.rows.map(resident => ({ resident, clinicalRecord: false,
      source: 'V7.4.3_DEVELOPMENT_CONTEXT' }));
  }
}
