/**
 * V3.8.18.20 — nonregistered confidential document read authorization service.
 * No HTTP endpoint, no query to the finance document tables, no writes.
 * The metadata provided to authorizeMetadata is assumed to be obtained by a
 * future trusted backend query, never from caller JSON.
 */
import {ForbiddenException,Injectable} from '@nestjs/common';
import type {DatabaseService} from '../database/database.service';
import {readVerifiedFinanceIdentity} from '../security/verified-finance-identity';
import {assessFinanceDocumentRead,type DocumentReadMeta} from './finance-v381820-document-read-policy';
@Injectable()
export class FinanceDocumentReadBoundaryV381820 {
 constructor(private readonly db:DatabaseService){}
 async authorizeMetadata(request:object,serverLoadedDocument:DocumentReadMeta):Promise<{authorized:true}>{
  const identity=readVerifiedFinanceIdentity(request);
  if(!identity)throw new ForbiddenException('FINANCE_SESSION_REQUIRED');
  const financeRoles=(process.env.TAMANCARE_FINANCE_READ_ROLES||'').split(',').map(x=>x.trim()).filter(Boolean);
  const payrollRoles=(process.env.TAMANCARE_FINANCE_PAYROLL_READ_ROLES||'').split(',').map(x=>x.trim()).filter(Boolean);
  const session=await this.db.query<{actor_id:string;actor_role:string}>(`
 SELECT actor_id,actor_role FROM public.auth_sessions
 WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
 AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
 [identity.sessionId,identity.actorId,identity.actorRole]);
  if(session.rows.length!==1||session.rows[0].actor_id!==identity.actorId||
  session.rows[0].actor_role!==identity.actorRole)throw new ForbiddenException('SESSION_INVALID');
  const decision=assessFinanceDocumentRead({...identity,serverVerified:true,sessionActive:true},
   serverLoadedDocument,financeRoles,payrollRoles);
  if(!decision.authorized)throw new ForbiddenException(decision.reason);
  return{authorized:true};
 }
}
