import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ResidentAccessScopeService } from './resident-access-scope.service';

@Injectable()
export class GuardianResidentService {
  constructor(private readonly db: DatabaseService, private readonly scope: ResidentAccessScopeService) {}

  private async read(actorId: string | undefined, role: string | undefined, residentId?: string) {
    if (!actorId || role !== 'GUARDIAN') {
      throw new ForbiddenException('Guardian identity is required');
    }
    const predicate = this.scope.sqlPredicate('r', actorId, 'GUARDIAN');
    const result = await this.db.query<{
      residentId: string; residentCode: string; displayName: string;
      room: string | null; careLevel: string;
    }>(`
      SELECT r.resident_id AS "residentId", r.resident_code AS "residentCode",
             r.display_name AS "displayName", r.room, r.care_level AS "careLevel"
      FROM residents r
      WHERE (${predicate.sql})
        ${residentId === undefined ? '' : 'AND r.resident_id = $4'}
      ORDER BY r.resident_id
    `, residentId === undefined ? predicate.params : [...predicate.params, residentId]);
    return result.rows;
  }

  list(actorId?: string, role?: string) {
    return this.read(actorId, role);
  }

  async detail(actorId: string | undefined, role: string | undefined, residentId: string) {
    const rows = await this.read(actorId, role, residentId);
    if (rows.length !== 1) throw new NotFoundException('Resident not found');
    return rows[0];
  }
}
