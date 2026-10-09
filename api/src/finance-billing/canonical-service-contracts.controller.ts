import { Controller, Get, Param, Req, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';

/**
 * Shared canonical contract reader for Service Contracts and Finance.
 * One PostgreSQL source; never the browser cache or mock contracts.
 * Read only until signed version and amendments workflow is approved.
 */
@Controller('api/service-contracts')
export class CanonicalServiceContractsController {
  constructor(private readonly db:DatabaseService) {}
  private async authorize(request:object):Promise<void> {
    const identity=readVerifiedFinanceIdentity(request);
    if(!identity)throw new ForbiddenException('CONTRACT_VERIFIED_SESSION_REQUIRED');
    const roles=(process.env.TAMANCARE_CONTRACT_READ_ROLES||'')
      .split(',').map(x=>x.trim()).filter(Boolean);
    if(!roles.length||roles.some(x=>!/^[A-Z][A-Z0-9_]{1,63}$/.test(x))||
      !roles.includes(identity.actorRole))
      throw new ForbiddenException('CONTRACT_READ_ROLE_DENIED');
    const result=await this.db.query(
      `SELECT actor_id FROM public.auth_sessions
       WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
       AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
      [identity.sessionId,identity.actorId,identity.actorRole],
    );
    if(result.rows.length!==1)throw new ForbiddenException('CONTRACT_SESSION_NOT_ACTIVE');
  }
  @Get()
  async list(@Req() request:object) {
    await this.authorize(request);
    const result=await this.db.query(
      `SELECT c.contract_id AS "contractId",c.contract_code AS "contractCode",
         c.resident_id AS "residentId",v.status,v.effective_date AS "effectiveDate",
         v.version,v.payload,c.created_at AS "createdAt",c.updated_at AS "updatedAt"
       FROM public.service_contract_records c
       JOIN public.service_contract_versions v ON v.contract_id=c.contract_id
        AND v.status='ACTIVE' AND v.approved_at IS NOT NULL
        AND v.signed_at IS NOT NULL
       ORDER BY c.updated_at DESC LIMIT 100`,
    );
    return result.rows.map(row=>({
      ...row.payload,
      contractId:row.contractId,contractCode:row.contractCode,
      residentId:row.residentId,status:row.status,
      effectiveDate:row.effectiveDate,version:row.version,
      createdAt:row.createdAt,updatedAt:row.updatedAt,
      source:'VERIFIED_SERVER',
    }));
  }
  @Get(':contractId')
  async get(@Req() request:object,@Param('contractId') contractId:string) {
    await this.authorize(request);
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(contractId))
      throw new BadRequestException('CONTRACT_ID_INVALID');
    const result=await this.db.query(
      `SELECT c.contract_id,c.contract_code,c.resident_id,
         v.status,v.effective_date,v.version,v.payload,
         c.created_at,c.updated_at
       FROM public.service_contract_records c
       JOIN public.service_contract_versions v ON v.contract_id=c.contract_id
         AND v.status='ACTIVE' AND v.approved_at IS NOT NULL
         AND v.signed_at IS NOT NULL
       WHERE c.contract_id=$1 LIMIT 1`,
      [contractId],
    );
    if(result.rows.length!==1)throw new NotFoundException('CONTRACT_NOT_FOUND');
    const row=result.rows[0];
    // Return the canonical payload, never a second Finance copy.
    return {
      ...row.payload,
      contractId:row.contract_id,contractCode:row.contract_code,
      residentId:row.resident_id,status:row.status,
      effectiveDate:row.effective_date,version:row.version,
      createdAt:row.created_at,updatedAt:row.updated_at,
      source:'VERIFIED_SERVER',
    };
  }
}
