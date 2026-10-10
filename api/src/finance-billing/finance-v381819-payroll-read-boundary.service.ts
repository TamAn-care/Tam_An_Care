/** V3.8.18.19: Protected payroll-read service boundary, not registered in Nest. */
import {ForbiddenException,Injectable} from '@nestjs/common';
import type {DatabaseService} from '../database/database.service';
import {readVerifiedFinanceIdentity} from '../security/verified-finance-identity';
import {authorizePayrollRead} from './finance-v381818-payroll-confidentiality';
const ID=/^[A-Za-z0-9_-]{1,160}$/;
@Injectable()
export class FinancePayrollReadBoundary {
 constructor(private readonly db:DatabaseService){}
 async authorizeRead(request:object,staffActorId:string):Promise<{authorized:true;actorId:string}>{
  const principal=readVerifiedFinanceIdentity(request);
  if(!principal||!ID.test(staffActorId))throw new ForbiddenException('PAYROLL_VERIFIED_IDENTITY_REQUIRED');
  const allowed=(process.env.TAMANCARE_FINANCE_PAYROLL_READ_ROLES||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!allowed.length)throw new ForbiddenException('PAYROLL_READ_ALLOWLIST_CLOSED');
  const active=await this.db.query<{actor_id:string;actor_role:string}>(`
 SELECT actor_id,actor_role FROM public.auth_sessions
 WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
 AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
  [principal.sessionId,principal.actorId,principal.actorRole]);
  if(active.rows.length!==1||active.rows[0].actor_id!==principal.actorId||
  active.rows[0].actor_role!==principal.actorRole)
    throw new ForbiddenException('PAYROLL_SESSION_INVALID');
  const d=authorizePayrollRead({...principal,serverVerified:true,sessionActive:true},
   {staffActorId,isPayroll:true},allowed,false);
  if(!d.allowed)throw new ForbiddenException(d.reason);
  return {authorized:true,actorId:principal.actorId};
 }
}
