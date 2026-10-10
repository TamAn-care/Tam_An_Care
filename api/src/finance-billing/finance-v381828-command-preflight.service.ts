/**
 * V3.8.18.28 — read-only preparation for authenticated Finance HTTP commands.
 * NOT a route and NOT a write service. Reads only existing public.auth_sessions
 * and requires a future trusted document store plus row lock for real updates.
 */
import {BadRequestException,ForbiddenException,Injectable} from '@nestjs/common';
import type {DatabaseService} from '../database/database.service';
import {readVerifiedFinanceIdentity} from '../security/verified-finance-identity';
import {assessAuthenticatedManualCommand,type ClientManualCommand,type ServerIdentity} from './finance-v381816-authenticated-manual-boundary';
import type {ManualDocument} from './finance-v381813-manual-workflow';
const ACTIONS=new Set(['SUBMIT','REVIEW','APPROVE','REJECT']);
@Injectable()
export class FinanceManualCommandPreflightV381828 {
 constructor(private readonly db:DatabaseService){}
 async inspect(request:object,command:unknown,serverDocument:ManualDocument|null,
   originAlreadyClaimed:boolean):Promise<{status:'DENIED'|'CANDIDATE_ONLY';reasons:string[];postingEnabled:false;databaseWriteEnabled:false}>{
  const identity=readVerifiedFinanceIdentity(request);
  if(!identity)throw new ForbiddenException('VERIFIED_SESSION_REQUIRED');
  if(!command||typeof command!=='object'||Array.isArray(command))
   throw new BadRequestException('INVALID_COMMAND');
  const v=command as Record<string,unknown>;
  if(Object.keys(v).sort().join('|')!=='action|expectedRevision|reason'||
   typeof v.action!=='string'||!ACTIONS.has(v.action)||
   !Number.isSafeInteger(v.expectedRevision)||typeof v.reason!=='string')
   throw new BadRequestException('INVALID_COMMAND_FIELDS');
  if(!serverDocument||originAlreadyClaimed!==false)
   throw new ForbiddenException('SERVER_DOCUMENT_OR_ORIGIN_UNVERIFIED');
  const s=await this.db.query<{actor_id:string;actor_role:string}>(`
SELECT actor_id,actor_role FROM public.auth_sessions
WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
 [identity.sessionId,identity.actorId,identity.actorRole]);
  if(s.rows.length!==1||s.rows[0].actor_id!==identity.actorId||
  s.rows[0].actor_role!==identity.actorRole)
   throw new ForbiddenException('SESSION_INACTIVE');
  const principal:ServerIdentity={...identity,verifiedFromServer:true};
  const assessment=assessAuthenticatedManualCommand(principal,v as unknown as ClientManualCommand,
   serverDocument,false);
  return{status:assessment.status,reasons:assessment.errors,postingEnabled:false,databaseWriteEnabled:false};
 }
}
