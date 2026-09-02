import {
  Injectable,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

export type ResidentAccessHumanRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR';

export type ResidentScopeSql = {
  sql: string;
  params: any[];
  nextParameter: number;
  enforcement:
    | 'ASSIGNMENT_SCOPED'
    | 'SUPERVISORY_ALL_ACTIVE_RESIDENTS';
};

@Injectable()
export class ResidentAccessScopeService {
  constructor(
    private readonly db: DatabaseService,
  ) {}

  private scopeForRole(
    actorRole: ResidentAccessHumanRole,
  ):
    | 'DIRECT_CARE'
    | 'CLINICAL_CARE'
    | null
  {
    if (actorRole === 'CAREGIVER') {
      return 'DIRECT_CARE';
    }

    if (actorRole === 'NURSE') {
      return 'CLINICAL_CARE';
    }

    return null;
  }

  async canAccessResident(
    actorIdInput: string,
    actorRole: ResidentAccessHumanRole,
    residentIdInput: string,
  ): Promise<boolean> {
    const actorId =
      String(actorIdInput ?? '').trim();

    const residentId =
      String(residentIdInput ?? '').trim();

    if (!actorId || !residentId) {
      return false;
    }

    if (actorRole === 'SUPERVISOR') {
      const result =
        await this.db.query(
          `
            SELECT 1
            FROM residents r
            WHERE
              r.resident_id = $1
              AND r.active_status = true
            LIMIT 1
          `,
          [
            residentId,
          ],
        );

      return result.rowCount === 1;
    }

    const accessScope =
      this.scopeForRole(actorRole);

    if (!accessScope) {
      return false;
    }

    const result =
      await this.db.query(
        `
          SELECT 1
          FROM residents r
          WHERE
            r.resident_id = $1
            AND r.active_status = true
            AND EXISTS (
              SELECT 1
              FROM resident_access_assignments raa
              WHERE
                raa.resident_id = r.resident_id
                AND raa.actor_id = $2
                AND raa.actor_role = $3
                AND raa.access_scope = $4
                AND raa.status = 'ACTIVE'
                AND raa.effective_from <= NOW()
                AND (
                  raa.effective_to IS NULL
                  OR raa.effective_to > NOW()
                )
            )
          LIMIT 1
        `,
        [
          residentId,
          actorId,
          actorRole,
          accessScope,
        ],
      );

    return result.rowCount === 1;
  }

  sqlPredicate(
    residentAliasInput: string,
    actorIdInput: string,
    actorRole: ResidentAccessHumanRole,
    startParameter = 1,
  ): ResidentScopeSql {
    const residentAlias =
      String(residentAliasInput ?? '').trim();

    const actorId =
      String(actorIdInput ?? '').trim();

    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
        residentAlias,
      )
    ) {
      throw new Error(
        'Unsafe resident SQL alias.',
      );
    }

    if (!actorId) {
      return {
        sql: 'FALSE',
        params: [],
        nextParameter: startParameter,
        enforcement: 'ASSIGNMENT_SCOPED',
      };
    }

    if (actorRole === 'SUPERVISOR') {
      return {
        sql: 'TRUE',
        params: [],
        nextParameter: startParameter,
        enforcement:
          'SUPERVISORY_ALL_ACTIVE_RESIDENTS',
      };
    }

    const accessScope =
      this.scopeForRole(actorRole);

    if (!accessScope) {
      return {
        sql: 'FALSE',
        params: [],
        nextParameter: startParameter,
        enforcement: 'ASSIGNMENT_SCOPED',
      };
    }

    const actorIdParameter =
      startParameter;

    const actorRoleParameter =
      startParameter + 1;

    const accessScopeParameter =
      startParameter + 2;

    return {
      sql: `
        EXISTS (
          SELECT 1
          FROM resident_access_assignments raa
          WHERE
            raa.resident_id =
              ${residentAlias}.resident_id
            AND raa.actor_id =
              $${actorIdParameter}
            AND raa.actor_role =
              $${actorRoleParameter}
            AND raa.access_scope =
              $${accessScopeParameter}
            AND raa.status = 'ACTIVE'
            AND raa.effective_from <= NOW()
            AND (
              raa.effective_to IS NULL
              OR raa.effective_to > NOW()
            )
        )
      `,
      params: [
        actorId,
        actorRole,
        accessScope,
      ],
      nextParameter:
        startParameter + 3,
      enforcement: 'ASSIGNMENT_SCOPED',
    };
  }
}
