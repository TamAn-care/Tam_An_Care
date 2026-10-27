
import { Injectable, ForbiddenException }
  from '@nestjs/common';

import { DatabaseService }
  from '../database/database.service';

/**
 * Finance authorization foundation.
 *
 * NOT registered as a public controller.
 *
 * Caller MUST obtain actorId, actorRole and sessionId
 * from ProductionAuthMiddleware after successful JWT
 * signature and active-session verification.
 *
 * Never populate these fields from arbitrary frontend
 * request bodies, query strings, or client role headers.
 *
 * Fail-closed: without an approved server-side allowlist,
 * all Finance writes are denied.
 */

export interface VerifiedFinanceIdentity {
  actorId: string;
  actorRole: string;
  sessionId: string;
}

@Injectable()
export class FinanceAuthorizationService {

  constructor(
    private readonly db: DatabaseService,
  ) {}

  private validIdentifier(
    value: unknown,
  ): value is string {
    return (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.length <= 200
    );
  }

  private configuredFinanceRoles(): Set<string> {
    const raw =
      process.env.TAMANCARE_FINANCE_WRITE_ROLES || '';

    const roles = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    // Empty configuration MUST NOT grant privileges.
    if (roles.length === 0) {
      return new Set();
    }

    // Only canonical role identifiers are acceptable.
    if (
      roles.some(
        (role) => !/^[A-Z][A-Z0-9_]{1,63}$/.test(role),
      )
    ) {
      return new Set();
    }

    return new Set(roles);
  }

  async assertFinanceWrite(
    identity: VerifiedFinanceIdentity,
  ): Promise<void> {

    if (
      !identity ||
      !this.validIdentifier(identity.actorId) ||
      !this.validIdentifier(identity.actorRole) ||
      !this.validIdentifier(identity.sessionId)
    ) {
      throw new ForbiddenException(
        'FINANCE_IDENTITY_NOT_VERIFIED',
      );
    }

    const allowedRoles = this.configuredFinanceRoles();

    if (!allowedRoles.has(identity.actorRole)) {
      throw new ForbiddenException(
        'FINANCE_ROLE_NOT_AUTHORIZED',
      );
    }

    // Validate authorization against current,
    // non-revoked server-side session state.
    //
    // A matching client-supplied role is NOT sufficient.
    const result = await this.db.query<{
      actor_id: string;
      actor_role: string;
    }>(
      `SELECT actor_id, actor_role
       FROM auth_sessions
       WHERE session_id = $1
         AND actor_id = $2
         AND actor_role = $3
         AND revoked_at IS NULL
         AND expires_at > now()
       LIMIT 1`,
      [
        identity.sessionId,
        identity.actorId,
        identity.actorRole,
      ],
    );

    if (
      result.rows.length !== 1 ||
      result.rows[0].actor_id !== identity.actorId ||
      result.rows[0].actor_role !== identity.actorRole
    ) {
      throw new ForbiddenException(
        'FINANCE_SESSION_NOT_ACTIVE',
      );
    }
  }
}
