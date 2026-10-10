/**
 * V3.8.18.17 — HTTP-shaped manual Finance command contract.
 * Never receives actorId/actorRole; real server must authenticate through
 * readVerifiedFinanceIdentity and check live unrevoked session.
 * Not registered as an endpoint. No database writes / migrations.
 */
import {BadRequestException,ForbiddenException,Injectable} from '@nestjs/common';
import type {DatabaseService} from '../database/database.service';
import {readVerifiedFinanceIdentity} from '../security/verified-finance-identity';
import {assessAuthenticatedManualCommand,type ClientManualCommand,type ServerIdentity} from './finance-v381816-authenticated-manual-boundary';
import type {ManualDocument} from './finance-v381813-manual-workflow';
const ID=/^[A-Za-z0-9_-]{1,160}$/;
const perms:Record<string,readonly string[]>={
 SUBMIT:['FINANCE_MAKER','FINANCE_MANAGER'],REVIEW:['FINANCE_REVIEWER','FINANCE_MANAGER'],
 APPROVE:['FINANCE_APPROVER','DIRECTOR'],REJECT:['FINANCE_REVIEWER','FINANCE_MANAGER','FINANCE_APPROVER','DIRECTOR']
};
@Injectable()
export class FinanceManualHttpCommandService {
 constructor(private readonly db:DatabaseService){}
 async preview(request:object,document:ManualDocument,body:unknown):Promise<{status:string;postingEnabled:false;databaseWriteEnabled:false;reasons:string[]}>{
  // All mutation-related switches are deliberately absent.
  if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('INVALID_BODY');
  const v=body as Record<string,unknown>;
  if(Object.keys(v).sort().join('|')!=='action|expectedRevision|reason'||
     typeof v.action!=='string'||!Object.prototype.hasOwnProperty.call(perms,v.action)||
     !Number.isSafeInteger(v.expectedRevision)||typeof v.reason!=='string')
   throw new BadRequestException('INVALID_FIELDS');
  const verified=readVerifiedFinanceIdentity(request);
  if(!verified||!ID.test(verified.actorId)||!ID.test(verified.sessionId)||
     !perms[v.action].includes(verified.actorRole))throw new ForbiddenException('FINANCE_ACCESS_DENIED');
  const s=await this.db.query<{actor_id:string;actor_role:string}>(`
 SELECT actor_id,actor_role FROM public.auth_sessions
 WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
 AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
 [verified.sessionId,verified.actorId,verified.actorRole]);
  if(s.rows.length!==1||s.rows[0].actor_id!==verified.actorId||
     s.rows[0].actor_role!==verified.actorRole)throw new ForbiddenException('SESSION_REVOKED');
  // Preview remains non-authoritative: no database row lock or persisted
  // idempotency check. Future write service must recheck in one transaction.
  const identity:ServerIdentity={actorId:verified.actorId,actorRole:verified.actorRole,
   sessionId:verified.sessionId,verifiedFromServer:true};
  const cmd=v as unknown as ClientManualCommand;
  const decision=assessAuthenticatedManualCommand(identity,cmd,document,false);
  return{status:decision.status,postingEnabled:false,databaseWriteEnabled:false,
   reasons:decision.errors};
 }
}
