import { Body, Controller, ForbiddenException, Post, Req, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';

/**
 * Shared contract DRAFT staging only. No signed or active contract can be
 * constructed through this endpoint. Never migrates frontend mock/localStorage.
 */
@Controller('api/service-contract-drafts')
export class CanonicalContractDraftController {
 constructor(private readonly db:DatabaseService){}
 @Post()
 async create(@Req() request:object,@Body() input:unknown) {
  // Separate release gate, disabled until runtime source approval.
  if(process.env.TAMANCARE_CONTRACT_DRAFT_WRITE_ENABLED!=='true')
   throw new ForbiddenException('CONTRACT_DRAFT_WRITE_NOT_ENABLED');
  const identity=readVerifiedFinanceIdentity(request);
  if(!identity)throw new ForbiddenException('CONTRACT_VERIFIED_IDENTITY_REQUIRED');
  const roles=(process.env.TAMANCARE_CONTRACT_DRAFT_WRITE_ROLES||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!roles.length||roles.some(role=>!/^[A-Z][A-Z0-9_]{1,63}$/.test(role))||
     !roles.includes(identity.actorRole))
   throw new ForbiddenException('CONTRACT_DRAFT_ROLE_DENIED');
  const active=await this.db.query(
   `SELECT actor_id FROM public.auth_sessions
    WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
    AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
   [identity.sessionId,identity.actorId,identity.actorRole]);
  if(active.rows.length!==1)throw new ForbiddenException('CONTRACT_SESSION_INVALID');
  if(!input||typeof input!=='object'||Array.isArray(input))
   throw new BadRequestException('CONTRACT_INVALID_DRAFT');
  const v=input as Record<string,unknown>;
  const id=(x:unknown)=>typeof x==='string' && /^[A-Za-z0-9_-]{1,160}$/.test(x);
  if(!id(v.contractId)||!id(v.residentId)||
     typeof v.contractCode!=='string'||v.contractCode.length<3||
     v.contractCode.length>160||typeof v.payload!=='object'||
     v.payload===null||Array.isArray(v.payload)||
     Object.keys(v).sort().join('|')!==['contractId','residentId','contractCode','payload'].sort().join('|'))
   throw new BadRequestException('CONTRACT_DRAFT_FIELDS_INVALID');
  const payload=v.payload as Record<string,unknown>;
  if(payload.source==='MOCK'||payload.source==='LOCAL_STORAGE'||
     JSON.stringify(payload).length>50000)
   throw new BadRequestException('CONTRACT_UNTRUSTED_OR_OVERSIZED_PAYLOAD');
  return this.db.withTransaction(async client=>{
   const resident=await client.query(
    'SELECT resident_id FROM public.residents WHERE resident_id=$1 FOR KEY SHARE',[v.residentId]);
   if(resident.rows.length!==1)throw new BadRequestException('CONTRACT_RESIDENT_NOT_FOUND');
   await client.query(
    `INSERT INTO public.service_contract_records
     (contract_id,contract_code,resident_id,status,payload)
     VALUES($1,$2,$3,'DRAFT',$4::jsonb)`,
    [v.contractId,v.contractCode,v.residentId,JSON.stringify(payload)]);
   await client.query(
    `INSERT INTO public.service_contract_versions
     (contract_id,version,payload,status,effective_date)
     VALUES($1,1,$2::jsonb,'DRAFT',CURRENT_DATE)`,
    [v.contractId,JSON.stringify(payload)]);
   return {contractId:v.contractId,status:'DRAFT',version:1,source:'VERIFIED_SERVER',
      signed:false,approved:false};
  });
 }
}
