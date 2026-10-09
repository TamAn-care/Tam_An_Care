import { Body, Controller, ForbiddenException, Post, Req, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import { FinanceBillingService } from './finance-billing.service';

/** Protected finance mutation. No environment default role and no client-trusted identity. */
@Controller('api/finance-write')
export class FinanceWriteController {
  constructor(private readonly db: DatabaseService, private readonly billing: FinanceBillingService) {}

  private async authorize(request: object): Promise<string> {
    const identity=readVerifiedFinanceIdentity(request);
    if (!identity) throw new ForbiddenException('FINANCE_VERIFIED_IDENTITY_REQUIRED');
    const roles=(process.env.TAMANCARE_FINANCE_WRITE_ROLES||'').split(',').map(x=>x.trim()).filter(Boolean);
    if (!roles.length || roles.some(x=>!/^[A-Z][A-Z0-9_]{1,63}$/.test(x)) ||
        !roles.includes(identity.actorRole)) throw new ForbiddenException('FINANCE_WRITE_ROLE_DENIED');
    const s=await this.db.query(
      `SELECT actor_id,actor_role FROM public.auth_sessions
        WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3
        AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
      [identity.sessionId,identity.actorId,identity.actorRole]);
    if (s.rows.length!==1) throw new ForbiddenException('FINANCE_SESSION_NOT_ACTIVE');
    return identity.actorId;
  }

  @Post('allocations')
  async allocate(@Req() request: object, @Body() body: unknown) {
    const actorId=await this.authorize(request);
    if (!body || typeof body!=='object' || Array.isArray(body))
      throw new BadRequestException('FINANCE_INVALID_ALLOCATION_REQUEST');
    const v=body as Record<string,unknown>;
    const keys=['receiptId','invoiceId','allocationId','amountVnd','operationKey'];
    if (Object.keys(v).sort().join('|')!==keys.slice().sort().join('|') ||
        keys.some(k=>typeof v[k]!=='string'))
      throw new BadRequestException('FINANCE_INVALID_ALLOCATION_FIELDS');
    return this.billing.allocatePayment({
      receiptId:v.receiptId as string,invoiceId:v.invoiceId as string,
      allocationId:v.allocationId as string,amountVnd:v.amountVnd as string,
      operationKey:v.operationKey as string,actorId,
    });
  }
}
