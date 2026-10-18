import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import { canViewUnapprovedPricing, hasPricingCapability, type PricingCapability } from './finance-rbac-policy';

type Identity={actorId:string;actorRole:string;sessionId:string};
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const isoDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(`${v}T00:00:00Z`))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;
const validItems=(v:unknown):v is Array<Record<string,string>>=>Array.isArray(v)&&v.length>0&&v.length<=500&&v.every(i=>i&&typeof i==='object'&&!Array.isArray(i)&&Object.keys(i).sort().join('|')==='amountVnd|name|scope|serviceCode|unit'&&
  typeof i.serviceCode==='string'&&/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(i.serviceCode)&&typeof i.name==='string'&&i.name.trim().length>0&&
  ['MONTH','DAY','MEAL','SERVICE','HOUR','VISIT'].includes(i.unit)&&['ROOM','CARE','MEAL','SERVICE','SURCHARGE','PACKAGE'].includes(i.scope)&&
  typeof i.amountVnd==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(i.amountVnd));

/** Price mutations are locked unless deployment configuration grants each capability. */
@Controller('api/finance/service-prices')
export class ServicePricingController {
  constructor(private readonly db:DatabaseService){}
  private async actor(req:object,capability:PricingCapability) :Promise<Identity>{
    const identity=readVerifiedFinanceIdentity(req);
    if(!identity)throw new ForbiddenException('FINANCE_VERIFIED_SESSION_REQUIRED');
    if(!hasPricingCapability(identity.actorRole,capability))
      throw new ForbiddenException('PRICING_CAPABILITY_NOT_GRANTED');
    const active=await this.db.query(`SELECT 1 FROM public.auth_sessions s JOIN public.staff_actors a ON a.actor_id=s.actor_id
      WHERE s.session_id=$1 AND s.actor_id=$2 AND s.actor_role=$3 AND s.revoked_at IS NULL AND s.expires_at>now()
      AND a.status='ACTIVE' AND a.primary_operational_role=$3 LIMIT 1`,[identity.sessionId,identity.actorId,identity.actorRole]);
    if(active.rows.length!==1)throw new ForbiddenException('FINANCE_SESSION_NOT_ACTIVE');
    return identity;
  }
  @Get()
  async list(@Req() req:object){
    const actor=await this.actor(req,'VIEW');
    const r=await this.db.query(`SELECT l.price_list_id AS "priceListId",l.code,v.version,v.status,v.effective_from AS "effectiveFrom",v.effective_to AS "effectiveTo",v.items,v.created_at AS "createdAt"
      FROM public.service_price_lists l JOIN public.service_price_list_versions v USING(price_list_id)
      WHERE v.status='APPROVED' OR ($1::boolean AND v.status IN ('DRAFT','PENDING_APPROVAL')) ORDER BY l.code,v.version DESC LIMIT 500`,
      [canViewUnapprovedPricing(actor.actorRole)]);
    return r.rows;
  }
  @Post()
  async createDraft(@Req() req:object,@Body() body:unknown){
    const actor=await this.actor(req,'EDIT_DRAFT');
    if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('PRICING_DRAFT_INVALID');
    const b=body as Record<string,unknown>;
    if(Object.keys(b).sort().join('|')!=='code|effectiveFrom|effectiveTo|items|name'||typeof b.code!=='string'||!/^[A-Za-z0-9_-]{2,80}$/.test(b.code)||typeof b.name!=='string'||b.name.trim().length<2||!isoDate(b.effectiveFrom)||(b.effectiveTo!==null&&!isoDate(b.effectiveTo))||!validItems(b.items)||(b.effectiveTo!==null&&String(b.effectiveTo)<b.effectiveFrom))throw new BadRequestException('PRICING_DRAFT_INVALID');
    const listId=`price_${randomUUID().replaceAll('-','')}`;
    return this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      await c.query(`INSERT INTO public.service_price_lists(price_list_id,code,name,created_by) VALUES($1,$2,$3,$4)`,[listId,b.code,b.name,actor.actorId]);
      await c.query(`INSERT INTO public.service_price_list_versions(price_list_id,version,status,effective_from,effective_to,items,created_by) VALUES($1,1,'DRAFT',$2,$3,$4::jsonb,$5)`,[listId,b.effectiveFrom,b.effectiveTo,JSON.stringify(b.items),actor.actorId]);
      return {priceListId:listId,version:1,status:'DRAFT'};
    });
  }
  @Post(':priceListId/versions')
  async copyVersion(@Req() req:object,@Param('priceListId') listId:string,@Body() body:unknown){
    const actor=await this.actor(req,'EDIT_DRAFT');
    if(!validId(listId)||!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('PRICING_COPY_INVALID');
    const b=body as Record<string,unknown>;
    const source=Number(b.sourceVersion);
    if(Object.keys(b).sort().join('|')!=='effectiveFrom|effectiveTo|sourceVersion'||!Number.isSafeInteger(source)||source<1||!isoDate(b.effectiveFrom)||(b.effectiveTo!==null&&!isoDate(b.effectiveTo))||(b.effectiveTo!==null&&String(b.effectiveTo)<b.effectiveFrom))throw new BadRequestException('PRICING_COPY_INVALID');
    return this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      const parent=await c.query(`SELECT price_list_id FROM public.service_price_lists WHERE price_list_id=$1 FOR UPDATE`,[listId]);
      if(parent.rows.length!==1)throw new BadRequestException('PRICE_LIST_NOT_FOUND');
      const previous=await c.query(`SELECT status,items FROM public.service_price_list_versions WHERE price_list_id=$1 AND version=$2`,[listId,source]);
      if(previous.rows.length!==1||!['APPROVED','REJECTED','SUPERSEDED'].includes(previous.rows[0].status))throw new BadRequestException('PRICING_SOURCE_VERSION_NOT_COPYABLE');
      const next=await c.query(`SELECT COALESCE(max(version),0)+1 AS version FROM public.service_price_list_versions WHERE price_list_id=$1`,[listId]);
      const version=Number(next.rows[0].version);
      await c.query(`INSERT INTO public.service_price_list_versions(price_list_id,version,status,effective_from,effective_to,items,created_by) VALUES($1,$2,'DRAFT',$3,$4,$5::jsonb,$6)`,[listId,version,b.effectiveFrom,b.effectiveTo,JSON.stringify(previous.rows[0].items),actor.actorId]);
      return {priceListId:listId,version,status:'DRAFT',copiedFromVersion:source};
    });
  }
  @Post(':priceListId/versions/:version/submit')
  async submit(@Req() req:object,@Param('priceListId') listId:string,@Param('version') versionText:string){
    const actor=await this.actor(req,'SUBMIT'); const version=this.version(listId,versionText);
    const r=await this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      return c.query(`UPDATE public.service_price_list_versions SET status='PENDING_APPROVAL',submitted_by=$3,submitted_at=now() WHERE price_list_id=$1 AND version=$2 AND status='DRAFT' AND created_by<>$3 RETURNING status`,[listId,version,actor.actorId]);
    });
    if(r.rows.length!==1)throw new BadRequestException('PRICING_DRAFT_NOT_SUBMITTABLE'); return {priceListId:listId,version,status:'PENDING_APPROVAL'};
  }
  @Patch(':priceListId/versions/:version')
  async editDraft(@Req() req:object,@Param('priceListId') listId:string,@Param('version') versionText:string,@Body() body:unknown){
    const actor=await this.actor(req,'EDIT_DRAFT'); const version=this.version(listId,versionText);
    if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('PRICING_DRAFT_INVALID');
    const b=body as Record<string,unknown>;
    if(Object.keys(b).sort().join('|')!=='effectiveFrom|effectiveTo|items'||!isoDate(b.effectiveFrom)||(b.effectiveTo!==null&&!isoDate(b.effectiveTo))||!validItems(b.items)||(b.effectiveTo!==null&&String(b.effectiveTo)<b.effectiveFrom))throw new BadRequestException('PRICING_DRAFT_INVALID');
    const r=await this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      return c.query(`UPDATE public.service_price_list_versions SET effective_from=$3,effective_to=$4,items=$5::jsonb,edited_by=$6,edited_at=now() WHERE price_list_id=$1 AND version=$2 AND status='DRAFT' AND created_by=$6 RETURNING status`,[listId,version,b.effectiveFrom,b.effectiveTo,JSON.stringify(b.items),actor.actorId]);
    });
    if(r.rows.length!==1)throw new BadRequestException('PRICING_DRAFT_NOT_EDITABLE');return {priceListId:listId,version,status:'DRAFT'};
  }
  @Post(':priceListId/versions/:version/approve')
  async approve(@Req() req:object,@Param('priceListId') listId:string,@Param('version') versionText:string,@Body() body:unknown){return this.decide(req,listId,versionText,body,true);}
  @Post(':priceListId/versions/:version/reject')
  async reject(@Req() req:object,@Param('priceListId') listId:string,@Param('version') versionText:string,@Body() body:unknown){return this.decide(req,listId,versionText,body,false);}
  private version(listId:string,text:string){const n=Number(text);if(!validId(listId)||!/^[1-9][0-9]{0,7}$/.test(text)||!Number.isSafeInteger(n))throw new BadRequestException('PRICING_VERSION_INVALID');return n;}
  private async decide(req:object,listId:string,text:string,body:unknown,approve:boolean){
    const actor=await this.actor(req,'APPROVE'); const version=this.version(listId,text);
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body as object).join('|')!=='reason'||typeof (body as {reason?:unknown}).reason!=='string'||(body as {reason:string}).reason.trim().length<5||(body as {reason:string}).reason.length>1000)throw new BadRequestException('PRICING_DECISION_REASON_REQUIRED');
    const status=approve?'APPROVED':'REJECTED';
    const r=await this.db.withTransaction(async c=>{
      await c.query(`SELECT set_config('taman.finance_actor_role',$1,true)`,[actor.actorRole]);
      return c.query(`UPDATE public.service_price_list_versions SET status=$4,decided_by=$3,decided_at=now(),decision_reason=$5 WHERE price_list_id=$1 AND version=$2 AND status='PENDING_APPROVAL' AND submitted_by<>$3 AND created_by<>$3 RETURNING status`,[listId,version,actor.actorId,status,(body as {reason:string}).reason.trim()]);
    });
    if(r.rows.length!==1)throw new BadRequestException('PRICING_VERSION_NOT_DECIDABLE');return {priceListId:listId,version,status};
  }
}
