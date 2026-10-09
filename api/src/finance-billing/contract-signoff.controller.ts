import { BadRequestException, Controller, ForbiddenException, Param, Post, Req, Body } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import type { PoolClient } from 'pg';
import { createHash } from 'crypto';

type Actor = { actorId:string; actorRole:string; sessionId:string };
const validId=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const vnd=(v:unknown):bigint=>{
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new Error('CONTRACT_PRICE_INVALID');
 return BigInt(v);
};
/**
 * Staff verification of already signed paper/external contract (NOT a signing provider),
 * followed by independent director approval. Both endpoints are DISABLED by default.
 * Evidence is immutable and points at a single version of the canonical contract.
 */
@Controller('api/service-contract-signoff')
export class ContractSignoffController {
 constructor(private readonly db:DatabaseService){}
 private async actor(req:object, rolesKey:string):Promise<Actor>{
  if(process.env.TAMANCARE_CONTRACT_SIGNOFF_ENABLED!=='true')
   throw new ForbiddenException('CONTRACT_SIGNOFF_RELEASE_GATE_CLOSED');
  const id=readVerifiedFinanceIdentity(req);
  if(!id)throw new ForbiddenException('CONTRACT_VERIFIED_SESSION_REQUIRED');
  const roles=(process.env[rolesKey]||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!roles.length||roles.some(x=>!/^[A-Z][A-Z0-9_]{1,63}$/.test(x))||
      !roles.includes(id.actorRole))
   throw new ForbiddenException('CONTRACT_SIGNOFF_ROLE_DENIED');
  const rows=await this.db.query(
   `SELECT s.actor_id FROM public.auth_sessions s
    JOIN public.staff_actors a ON a.actor_id=s.actor_id
    WHERE s.session_id=$1 AND s.actor_id=$2 AND s.actor_role=$3
     AND s.revoked_at IS NULL AND s.expires_at>now()
     AND a.status='ACTIVE' AND a.primary_operational_role=$3 LIMIT 1`,
    [id.sessionId,id.actorId,id.actorRole]);
  if(rows.rows.length!==1)throw new ForbiddenException('CONTRACT_ACTOR_NOT_ACTIVE');
  return id;
 }
 private identifiers(contractId:string, versionText:string):number {
  const version=Number(versionText);
  if(!validId(contractId)||!/^[1-9][0-9]{0,7}$/.test(versionText)||
     !Number.isSafeInteger(version))
   throw new BadRequestException('CONTRACT_VERSION_INVALID');
  return version;
 }
 private async parent(client:PoolClient,contractId:string,version:number){
  const head=await client.query(
   `SELECT contract_id,resident_id FROM public.service_contract_records
    WHERE contract_id=$1 FOR UPDATE`,[contractId]);
  if(head.rows.length!==1)throw new BadRequestException('CONTRACT_NOT_FOUND');
  const versionRow=await client.query(
   `SELECT version,status,payload,effective_date
    FROM public.service_contract_versions
    WHERE contract_id=$1 AND version=$2 FOR UPDATE`,[contractId,version]);
  if(versionRow.rows.length!==1||versionRow.rows[0].status!=='DRAFT')
   throw new BadRequestException('CONTRACT_VERSION_NOT_DRAFT');
  return {residentId:head.rows[0].resident_id,contract:versionRow.rows[0]};
 }
 @Post(':contractId/versions/:version/verify-signature')
 async verifySignature(@Req() req:object,@Param('contractId') contractId:string,
     @Param('version') versionText:string,@Body() body:unknown) {
  const actor=await this.actor(req,'TAMANCARE_CONTRACT_SIGNATURE_VERIFY_ROLES');
  const version=this.identifiers(contractId,versionText);
  if(!body||typeof body!=='object'||Array.isArray(body))
   throw new BadRequestException('CONTRACT_SIGNATURE_EVIDENCE_REQUIRED');
  const b=body as Record<string,unknown>;
  if(Object.keys(b).sort().join('|')!==
     ['documentSha256','documentReference','signingMethod','signedAt'].sort().join('|')||
     typeof b.documentSha256!=='string'||!/^[0-9a-f]{64}$/.test(b.documentSha256)||
     typeof b.documentReference!=='string'||!/^[A-Za-z0-9_./:-]{8,200}$/.test(b.documentReference)||
     !['SIGNED_PAPER_ARCHIVED','EXTERNAL_VERIFIED'].includes(String(b.signingMethod))||
     typeof b.signedAt!=='string'||!Number.isFinite(Date.parse(b.signedAt))||
     Date.parse(b.signedAt)>Date.now())
   throw new BadRequestException('CONTRACT_SIGNATURE_EVIDENCE_INVALID');
  // This attests staff reviewed a signed document. Never claim cryptographic e-signature
  // or authenticate file bytes unless backed by a verified document store.
  return this.db.withTransaction(async client=>{
   await this.parent(client,contractId,version);
   await client.query(
    `INSERT INTO public.service_contract_signing_evidence
       (contract_id,version,document_sha256,document_reference,
        signing_method,verified_by,signed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)`,
    [contractId,version,b.documentSha256,b.documentReference,
     b.signingMethod,actor.actorId,b.signedAt]);
   return {contractId,version,signatureEvidenceRecorded:true,
     signedContractActivated:false,legalElectronicSignatureVerified:false};
  });
 }
 @Post(':contractId/versions/:version/approve')
 async approve(@Req() req:object,@Param('contractId') contractId:string,
    @Param('version') versionText:string,@Body() body:unknown){
  const actor=await this.actor(req,'TAMANCARE_CONTRACT_APPROVER_ROLES');
  const version=this.identifiers(contractId,versionText);
  if(!body||typeof body!=='object'||Array.isArray(body)||
     Object.keys(body as object).join('|')!=='approvalReason'||
     typeof (body as {approvalReason?:unknown}).approvalReason!=='string'||
     ((body as {approvalReason:string}).approvalReason.trim().length<10))
   throw new BadRequestException('CONTRACT_APPROVAL_REASON_REQUIRED');
  const approvalReason=(body as {approvalReason:string}).approvalReason.trim();
  if(approvalReason.length>2000)throw new BadRequestException('CONTRACT_APPROVAL_REASON_TOO_LONG');
  return this.db.withTransaction(async client=>{
   const {residentId,contract}=await this.parent(client,contractId,version);
   const evidence=await client.query(
    `SELECT verified_by,signed_at,document_sha256 FROM public.service_contract_signing_evidence
     WHERE contract_id=$1 AND version=$2`,[contractId,version]);
   if(evidence.rows.length!==1||evidence.rows[0].verified_by===actor.actorId)
     throw new ForbiddenException('CONTRACT_INDEPENDENT_SIGNATURE_VERIFICATION_REQUIRED');
   const content=contract.payload as Record<string,any>;
   const terms=content?.appendix, ops=content?.operationalRefs;
   if(!terms||!ops||!validId(ops.roomId)||!validId(ops.bedId)||
      typeof ops.careLevel!=='string')
     throw new BadRequestException('CONTRACT_CANONICAL_ROOM_CARE_TERMS_REQUIRED');
   const real=await client.query(
    `SELECT r.care_level, ac.approved_care_level,
            bed.bed_id, room.room_id
     FROM public.residents r
     JOIN public.bed_assignments ba ON ba.resident_id=r.resident_id AND ba.ended_at IS NULL
     JOIN public.accommodation_beds bed ON bed.bed_id=ba.bed_id
     JOIN public.accommodation_rooms room ON room.room_id=bed.room_id
     JOIN public.admission_cases adm ON adm.resident_id=r.resident_id
     JOIN public.admission_care_classifications ac ON ac.admission_case_id=adm.admission_case_id
       AND ac.approved_at IS NOT NULL AND ac.review_status IN ('APPROVED','OVERRIDDEN')
     WHERE r.resident_id=$1
     ORDER BY ac.approved_at DESC LIMIT 2`,[residentId]);
   if(real.rows.length!==1)throw new BadRequestException('CONTRACT_OPERATIONAL_RECORD_AMBIGUOUS');
   const row=real.rows[0];
   if(row.care_level!==row.approved_care_level||row.care_level!==ops.careLevel||
      row.bed_id!==ops.bedId||row.room_id!==ops.roomId)
     throw new BadRequestException('CONTRACT_CARE_BED_APPROVAL_MISMATCH');
   const services=terms.additionalServices;
   if(!Array.isArray(services))throw new BadRequestException('CONTRACT_SERVICES_INVALID');
   let total=vnd(terms.baseMonthlyFee);
   for(const service of services){
    if(!service || typeof service.name!=='string' || !service.name.trim())
     throw new BadRequestException('CONTRACT_SERVICE_INVALID');
    if(service.selected===true)total+=vnd(service.fee);
   }
   const discount=vnd(terms.discount);
   if(discount>total||total-discount!==vnd(terms.totalMonthlyFee))
     throw new BadRequestException('CONTRACT_FEE_RECONCILIATION_FAILED');
   // Prevent activating any unsigned/unapproved version and ensure only one ACTIVE.
   await client.query(
     `UPDATE public.service_contract_versions SET status='SUPERSEDED'
       WHERE contract_id=$1 AND status='ACTIVE'`,[contractId]);
   await client.query(
     `UPDATE public.service_contract_versions
        SET status='ACTIVE',signed_at=$3,approved_at=now(),approved_by=$4
       WHERE contract_id=$1 AND version=$2 AND status='DRAFT'`,
     [contractId,version,evidence.rows[0].signed_at,actor.actorId]);
   await client.query(
     `INSERT INTO public.service_contract_approval_decisions
       (contract_id,version,approved_by,approval_reason,approved_sha256,
        admission_care_level,room_id,bed_id,monthly_fee_vnd)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
     [contractId,version,actor.actorId,approvalReason,
      evidence.rows[0].document_sha256,row.care_level,row.room_id,row.bed_id,total.toString()-discount.toString()]);
   await client.query(
     `UPDATE public.service_contract_records
       SET status='ACTIVE',version=$2,payload=$3::jsonb,
           effective_date=$4,updated_at=now()
       WHERE contract_id=$1`,
     [contractId,version,JSON.stringify(contract.payload),contract.effective_date]);
   return {contractId,version,status:'ACTIVE',approvedBy:actor.actorId,
      approvedMonthlyVnd:(total-discount).toString()};
  });
 }
}
