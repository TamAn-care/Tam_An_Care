import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import type { DocumentAction } from './finance-document-workflow';

/**
 * V3.8.4 internal authorization boundary ONLY.
 * No controller registration, mutation, EXECUTE grant or public endpoint.
 * Actor ID/role is obtained exclusively from the server-authenticated request
 * WeakMap and checked against the live, unrevoked session.
 */
@Injectable()
export class FinanceDocumentAuthorizationService {
  constructor(private readonly db: DatabaseService) {}

  async authorize(request: object, action: DocumentAction): Promise<{
    actorId: string; actorRole: string; sessionId: string;
  }> {
    const identity = readVerifiedFinanceIdentity(request);
    if (!identity) throw new ForbiddenException('FINANCE_VERIFIED_IDENTITY_REQUIRED');
    const key: Record<DocumentAction, string> = {
      SUBMIT: 'TAMANCARE_FINANCE_DOCUMENT_PREPARER_ROLES',
      REVIEW: 'TAMANCARE_FINANCE_DOCUMENT_REVIEWER_ROLES',
      APPROVE: 'TAMANCARE_FINANCE_DOCUMENT_APPROVER_ROLES',
      REJECT: 'TAMANCARE_FINANCE_DOCUMENT_REVIEWER_ROLES',
    };
    if (!Object.prototype.hasOwnProperty.call(key, action)) {
      throw new ForbiddenException('FINANCE_DOCUMENT_ACTION_FORBIDDEN');
    }
    const roles = (process.env[key[action]] ?? '')
      .split(',').map(x => x.trim()).filter(Boolean);
    if (roles.length === 0 ||
        roles.some(x => !/^[A-Z][A-Z0-9_]{1,63}$/.test(x)) ||
        !roles.includes(identity.actorRole)) {
      throw new ForbiddenException('FINANCE_DOCUMENT_ROLE_FORBIDDEN');
    }
    const session = await this.db.query<{actor_id:string;actor_role:string}>(
      `SELECT actor_id, actor_role FROM public.auth_sessions
        WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
          AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
      [identity.sessionId, identity.actorId, identity.actorRole],
    );
    if (session.rows.length !== 1 ||
        session.rows[0].actor_id !== identity.actorId ||
        session.rows[0].actor_role !== identity.actorRole) {
      throw new ForbiddenException('FINANCE_DOCUMENT_SESSION_INVALID');
    }
    return {actorId:identity.actorId,actorRole:identity.actorRole,
      sessionId:identity.sessionId};
  }
}
