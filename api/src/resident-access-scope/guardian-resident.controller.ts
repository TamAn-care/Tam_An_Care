import { Controller, ForbiddenException, Get, Headers, Param, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ResidentAccessScopeService } from './resident-access-scope.service';

@Controller('api/family-portal/residents')
export class GuardianResidentController {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ResidentAccessScopeService,
  ) {}

  private requireGuardian(actorId?: string, actorRole?: string): string {
    if (!actorId || !actorRole) throw new UnauthorizedException('Guardian session is required');
    if (actorRole !== 'GUARDIAN') throw new ForbiddenException('Guardian identity is required');
    return actorId;
  }

  @Get('ids')
  async listLinkedResidentIds(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    const guardianId = this.requireGuardian(actorId, actorRole);
    return { residentIds: await this.scope.listAccessibleResidentIds(guardianId, 'GUARDIAN') };
  }

  @Get()
  async listLinkedResidents(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    const guardianId = this.requireGuardian(actorId, actorRole);
    const result = await this.db.query(
      `SELECT r.resident_id AS "residentId",
              r.resident_code AS "residentCode",
              r.display_name AS "displayName",
              COALESCE(to_jsonb(r)->>'date_of_birth',to_jsonb(r)->>'birth_year') AS "dateOfBirth",
              r.gender, r.room, r.bed, r.care_level AS "careLevel",
              r.active_status AS "activeStatus"
         FROM residents r
        WHERE r.active_status=true
          AND EXISTS (
            SELECT 1 FROM guardian_identities g
            JOIN guardian_resident_links l ON l.guardian_id=g.guardian_id
            WHERE g.guardian_id=$1 AND g.status='ACTIVE'
              AND l.resident_id=r.resident_id AND l.status='ACTIVE'
              AND l.effective_from<=now()
              AND (l.effective_to IS NULL OR l.effective_to>now())
          )
        ORDER BY r.resident_code,r.resident_id`,
      [guardianId],
    );
    return result.rows.map((resident) => ({
      resident,
      source: 'POSTGRESQL' as const,
      clinicalRecord: false as const,
    }));
  }

  @Get(':residentId')
  async getLinkedResident(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('residentId') residentId: string,
  ) {
    const guardianId = this.requireGuardian(actorId, actorRole);
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(residentId)
      || !await this.scope.canAccessResident(guardianId, 'GUARDIAN', residentId)) {
      throw new ForbiddenException('GUARDIAN_RESIDENT_SCOPE_DENIED');
    }
    const result = await this.db.query(
      `SELECT r.resident_id AS "residentId",
              r.resident_code AS "residentCode",
              r.display_name AS "displayName",
              COALESCE(to_jsonb(r)->>'date_of_birth',to_jsonb(r)->>'birth_year') AS "dateOfBirth",
              r.gender, r.room, r.bed, r.care_level AS "careLevel",
              r.active_status AS "activeStatus"
         FROM residents r WHERE r.resident_id=$1 AND r.active_status=true LIMIT 1`,
      [residentId],
    );
    if (result.rowCount !== 1) throw new ForbiddenException('GUARDIAN_RESIDENT_SCOPE_DENIED');
    return { resident: result.rows[0], source: 'POSTGRESQL', clinicalRecord: false };
  }
}
