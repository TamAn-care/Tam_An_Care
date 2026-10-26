import {
  Injectable,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

@Injectable()
export class GuardianAccessService {
  constructor(
    private readonly db: DatabaseService,
  ) {}

  async canViewResidentHealthReport(
    guardianPrincipalIdInput: string,
    residentIdInput: string,
  ): Promise<boolean> {
    const guardianPrincipalId =
      String(guardianPrincipalIdInput ?? '').trim();

    const residentId =
      String(residentIdInput ?? '').trim();

    if (!guardianPrincipalId || !residentId) {
      return false;
    }

    const result = await this.db.query(
      `
        SELECT 1
        FROM guardian_principals gp
        JOIN guardian_resident_relationships grr
          ON grr.guardian_principal_id = gp.guardian_principal_id
        JOIN residents r
          ON r.resident_id = grr.resident_id
        WHERE gp.guardian_principal_id = $1
          AND gp.status = 'ACTIVE'
          AND grr.resident_id = $2
          AND grr.status = 'ACTIVE'
          AND grr.effective_from <= now()
          AND (
            grr.effective_until IS NULL
            OR grr.effective_until >= now()
          )
          AND 'health_report:view' = ANY(grr.permissions)
          AND r.active_status = true
        LIMIT 1
      `,
      [guardianPrincipalId, residentId],
    );

    return result.rowCount === 1;
  }
}
