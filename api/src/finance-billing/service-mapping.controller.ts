import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import { hasServiceMappingCapability, type ServiceMappingCapability } from './service-mapping-rbac';

const domains=['ROOM_TYPE','CARE_LEVEL','MEAL_PLAN','MEAL_CHARGE_TYPE'] as const;
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const validDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(`${v}T00:00:00Z`))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;
type Identity={actorId:string;actorRole:string;sessionId:string};

@Controller('api/finance/service-mappings')
export class ServiceMappingController {
  constructor(private readonly db:DatabaseService){}
  private async actor(req:object,cap:ServiceMappingCapability):Promise<Identity>{
    const identity=readVerifiedFinanceIdentity(req);
    if(!identity||!hasServiceMappingCapability(identity.actorRole,cap))throw new ForbiddenException('SERVICE_MAPPING_CAPABILITY_NOT_GRANTED');
    const active=await this.db.query(`SELECT 1 FROM public.auth_sessions s JOIN public.staff_actors a ON a.actor_id=s.actor_id
      WHERE s.session_id=$1 AND s.actor_id=$2 AND s.actor_role=$3 AND s.revoked_at IS NULL AND s.expires_at>now()
        AND a.status='ACTIVE' AND a.primary_operational_role=$3 LIMIT 1`,[identity.sessionId,identity.actorId,identity.actorRole]);
    if(active.rows.length!==1)throw new ForbiddenException('FINANCE_SESSION_NOT_ACTIVE');
    return identity;
  }
  private version(text:string):number{const v=Number(text);if(!/^[1-9][0-9]{0,7}$/.test(text)||!Number.isSafeInteger(v))throw new BadRequestException('SERVICE_MAPPING_VERSION_INVALID');return v;}
  @Get()
  async list(@Req() req:object){
    const actor=await this.actor(req,'VIEW');
    const showDrafts=actor.actorRole==='ADMIN'||actor.actorRole==='SUPERVISOR';
    const q=await this.db.query(`SELECT m.mapping_id AS "mappingId",m.version,m.source_domain AS "sourceDomain",m.source_entity_id AS "sourceEntityId",
      m.service_code AS "serviceCode",m.service_scope AS "serviceScope",m.price_list_id AS "priceListId",m.price_list_version AS "priceListVersion",
      m.effective_from AS "effectiveFrom",COALESCE(LEAST(m.effective_to,m.superseded_effective_from-1),m.effective_to) AS "effectiveTo",m.status,m.created_by AS "createdBy",m.submitted_by AS "submittedBy",
      m.decided_by AS "decidedBy",m.decided_at AS "decidedAt",m.change_reason AS "changeReason",m.source_evidence_ref AS "sourceEvidenceRef",
      v.status AS "priceVersionStatus"
      FROM public.finance_service_code_mappings m JOIN public.service_price_list_versions v
        ON v.price_list_id=m.price_list_id AND v.version=m.price_list_version
      WHERE ($1::boolean OR m.status IN ('APPROVED','SUPERSEDED'))
      ORDER BY m.source_domain,m.source_entity_id,m.effective_from DESC,m.version DESC LIMIT 1000`,[showDrafts]);
    return q.rows;
  }
  @Get('resolve/:sourceDomain/:sourceEntityId')
  async resolve(@Req() req:object,@Param('sourceDomain') domain:string,@Param('sourceEntityId') sourceId:string,@Query('serviceDate') serviceDate:string){
    await this.actor(req,'VIEW');
    if(!domains.includes(domain as typeof domains[number])||!validId(sourceId)||!validDate(serviceDate))throw new BadRequestException('BILLING_PRICE_SOURCE_UNVERIFIED');
    const scope=domain==='ROOM_TYPE'?'ROOM':domain==='CARE_LEVEL'?'CARE':'MEAL';
    const r=await this.db.query(`SELECT m.mapping_id AS "mappingId",m.version AS "mappingVersion",m.source_domain AS "sourceDomain",
      m.source_entity_id AS "sourceEntityId",m.service_code AS "serviceCode",m.service_scope AS "serviceScope",
      m.effective_from AS "mappingEffectiveFrom",m.effective_to AS "mappingEffectiveTo",
      m.superseded_effective_from AS "supersededEffectiveFrom",m.source_evidence_ref AS "sourceEvidenceRef",
      v.price_list_id AS "priceListId",v.version AS "priceListVersion",v.status AS "priceListStatus",
      v.effective_from AS "priceEffectiveFrom",v.effective_to AS "priceEffectiveTo",item->>'amountVnd' AS "unitPriceVnd",item->>'unit' AS unit
      FROM public.finance_service_code_mappings m
      JOIN public.service_price_list_versions v ON v.price_list_id=m.price_list_id AND v.version=m.price_list_version
      CROSS JOIN LATERAL jsonb_array_elements(v.items) item
      WHERE m.source_domain=$1 AND m.source_entity_id=$2 AND m.service_scope=$3
        AND m.status IN ('APPROVED','SUPERSEDED') AND v.status IN ('APPROVED','SUPERSEDED')
        AND m.effective_from<=$4::date AND (m.effective_to IS NULL OR m.effective_to >= $4::date)
        AND (m.superseded_effective_from IS NULL OR m.superseded_effective_from>$4::date)
        AND v.effective_from<=$4::date AND (v.effective_to IS NULL OR v.effective_to >= $4::date)
        AND item->>'serviceCode'=m.service_code AND item->>'scope'=m.service_scope`,[domain,sourceId,scope,serviceDate]);
    if(r.rows.length!==1)throw new ConflictException(r.rows.length?'BILLING_PRICE_SOURCE_AMBIGUOUS':'BILLING_PRICE_SOURCE_UNVERIFIED');
    return {source:'APPROVED_MAPPING_AND_PRICE_VERSION',...r.rows[0],serviceDate};
  }
  @Post()
  async createDraft(@Req() req:object,@Body() body:unknown){
    const actor=await this.actor(req,'EDIT_DRAFT');
    if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('SERVICE_MAPPING_DRAFT_INVALID');
    const b=body as Record<string,unknown>;
    const required='changeReason|effectiveFrom|effectiveTo|priceListId|priceListVersion|serviceCode|sourceDomain|sourceEntityId|sourceEvidenceRef';
    const keys=Object.keys(b).sort().join('|');
    const withMappingId=[...required.split('|'),'mappingId'].sort().join('|');
    if((keys!==required&&keys!==withMappingId)||(b.mappingId!==undefined&&!validId(b.mappingId))||!domains.includes(b.sourceDomain as typeof domains[number])||!validId(b.sourceEntityId)||
      typeof b.serviceCode!=='string'||!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(b.serviceCode)||!validId(b.priceListId)||
      !Number.isSafeInteger(b.priceListVersion)||Number(b.priceListVersion)<1||!validDate(b.effectiveFrom)||
      (b.effectiveTo!==null&&!validDate(b.effectiveTo))||(b.effectiveTo!==null&&String(b.effectiveTo)<b.effectiveFrom)||
      typeof b.changeReason!=='string'||b.changeReason.trim().length<5||b.changeReason.length>1000||
      (b.sourceEvidenceRef!==null&&(typeof b.sourceEvidenceRef!=='string'||b.sourceEvidenceRef.trim().length<8||b.sourceEvidenceRef.length>200)))
      throw new BadRequestException('SERVICE_MAPPING_DRAFT_INVALID');
    const scope=b.sourceDomain==='ROOM_TYPE'?'ROOM':b.sourceDomain==='CARE_LEVEL'?'CARE':'MEAL';
    const sourceEvidenceRef=(typeof b.sourceEvidenceRef==='string'&&b.sourceEvidenceRef.trim())?b.sourceEvidenceRef.trim():
      b.sourceDomain==='ROOM_TYPE'?`public.accommodation_rooms.room_type:${String(b.sourceEntityId)}`:
      b.sourceDomain==='CARE_LEVEL'?`public.admission_care_classifications.approved_care_level:${String(b.sourceEntityId)}`:null;
    const requestedMappingId=typeof b.mappingId==='string'?b.mappingId:null;
    const mappingId=requestedMappingId??`map_${randomUUID().replaceAll('-','')}`;
    return this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      if(b.sourceDomain==='ROOM_TYPE'){
        const source=await c.query(`SELECT 1 FROM public.accommodation_rooms WHERE room_type=$1 LIMIT 1`,[b.sourceEntityId]);
        if(source.rows.length!==1)throw new BadRequestException('FINANCE_ROOM_TYPE_SOURCE_UNVERIFIED');
      }else if(b.sourceDomain==='CARE_LEVEL'){
        const source=await c.query(`SELECT 1 FROM public.residents WHERE care_level=$1
          UNION ALL SELECT 1 FROM public.admission_care_classifications WHERE approved_care_level=$1 AND review_status IN ('APPROVED','OVERRIDDEN') LIMIT 1`,[b.sourceEntityId]);
        if(source.rows.length!==1)throw new BadRequestException('FINANCE_CARE_LEVEL_SOURCE_UNVERIFIED');
      }else{
        // No canonical meal-plan/meal-charge source table has been established; never accept a caller-invented meal key.
        throw new BadRequestException('FINANCE_MEAL_SOURCE_UNVERIFIED');
      }
      const prior=await c.query(`SELECT source_domain,source_entity_id,service_scope,status,version
        FROM public.finance_service_code_mappings WHERE mapping_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE`,[mappingId]);
      let version=1;
      if(prior.rows.length){
        const row=prior.rows[0];
        if(row.source_domain!==b.sourceDomain||row.source_entity_id!==b.sourceEntityId||row.service_scope!==scope||!['APPROVED','SUPERSEDED','REJECTED'].includes(row.status))
          throw new BadRequestException('SERVICE_MAPPING_VERSION_SOURCE_MISMATCH');
        const next=await c.query(`SELECT max(version)+1 AS version FROM public.finance_service_code_mappings WHERE mapping_id=$1`,[mappingId]);
        version=Number(next.rows[0].version);
      }
      const r=await c.query(`INSERT INTO public.finance_service_code_mappings(mapping_id,version,source_domain,source_entity_id,service_code,service_scope,
        price_list_id,price_list_version,effective_from,effective_to,status,created_by,source_evidence_ref,change_reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'DRAFT',$11,$12,$13)
        RETURNING mapping_id AS "mappingId",version,status`,[mappingId,version,b.sourceDomain,b.sourceEntityId,b.serviceCode,scope,b.priceListId,b.priceListVersion,b.effectiveFrom,b.effectiveTo,actor.actorId,sourceEvidenceRef,String(b.changeReason).trim()]);
      return r.rows[0];
    });
  }
  @Post(':mappingId/versions/:version/submit')
  async submit(@Req() req:object,@Param('mappingId') id:string,@Param('version') vt:string){
    const actor=await this.actor(req,'SUBMIT');const version=this.version(vt);if(!validId(id))throw new BadRequestException('SERVICE_MAPPING_ID_INVALID');
    const r=await this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      return c.query(`UPDATE public.finance_service_code_mappings SET status='PENDING_APPROVAL',submitted_by=$3,submitted_at=now()
        WHERE mapping_id=$1 AND version=$2 AND status='DRAFT' AND created_by<>$3 RETURNING status`,[id,version,actor.actorId]);
    });
    if(r.rows.length!==1)throw new BadRequestException('SERVICE_MAPPING_NOT_SUBMITTABLE');return {mappingId:id,version,status:'PENDING_APPROVAL'};
  }
  @Post(':mappingId/versions/:version/approve')
  async approve(@Req() req:object,@Param('mappingId') id:string,@Param('version') vt:string,@Body() body:unknown){return this.decide(req,id,vt,body,true);}
  @Post(':mappingId/versions/:version/reject')
  async reject(@Req() req:object,@Param('mappingId') id:string,@Param('version') vt:string,@Body() body:unknown){return this.decide(req,id,vt,body,false);}
  private async decide(req:object,id:string,vt:string,body:unknown,approve:boolean){
    const actor=await this.actor(req,'APPROVE');const version=this.version(vt);
    if(!validId(id)||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body as object).sort().join('|')!=='reason'||typeof (body as {reason?:unknown}).reason!=='string'||(body as {reason:string}).reason.trim().length<5||(body as {reason:string}).reason.length>1000)throw new BadRequestException('SERVICE_MAPPING_DECISION_INVALID');
    const r=await this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      return c.query(`UPDATE public.finance_service_code_mappings SET status=$4,decided_by=$3,decided_at=now(),decision_reason=$5
        WHERE mapping_id=$1 AND version=$2 AND status='PENDING_APPROVAL' AND created_by<>$3 AND submitted_by<>$3 RETURNING status`,[id,version,actor.actorId,approve?'APPROVED':'REJECTED',(body as {reason:string}).reason.trim()]);
    });
    if(r.rows.length!==1)throw new BadRequestException('SERVICE_MAPPING_NOT_DECIDABLE');return {mappingId:id,version,status:r.rows[0].status};
  }
  @Post(':mappingId/versions/:version/supersede')
  async supersede(@Req() req:object,@Param('mappingId') id:string,@Param('version') vt:string,@Body() body:unknown){
    const actor=await this.actor(req,'SUPERSEDE');const version=this.version(vt);
    if(!validId(id)||!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('SERVICE_MAPPING_SUPERSEDE_INVALID');
    const b=body as Record<string,unknown>;
    if(Object.keys(b).sort().join('|')!=='effectiveFrom|reason'||!validDate(b.effectiveFrom)||typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>1000)throw new BadRequestException('SERVICE_MAPPING_SUPERSEDE_INVALID');
    const r=await this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      return c.query(`UPDATE public.finance_service_code_mappings SET status='SUPERSEDED',superseded_effective_from=$3,decided_by=$4,decided_at=now(),decision_reason=$5
        WHERE mapping_id=$1 AND version=$2 AND status='APPROVED' AND $3::date>effective_from
          AND (effective_to IS NULL OR $3::date<=effective_to+1) RETURNING status`,[id,version,b.effectiveFrom,actor.actorId,String(b.reason).trim()]);
    });
    if(r.rows.length!==1)throw new BadRequestException('SERVICE_MAPPING_NOT_SUPERSEDDABLE');const until=new Date(`${String(b.effectiveFrom)}T00:00:00Z`);until.setUTCDate(until.getUTCDate()-1);return {mappingId:id,version,status:'SUPERSEDED',effectiveUntil:until.toISOString().slice(0,10)};
  }
}
