import { Body, Controller, ForbiddenException, Post, Req, BadRequestException, ConflictException, UnprocessableEntityException, Param } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import { FinanceBillingService } from './finance-billing.service';
import { FamilyMealBillingService } from './family-meal-billing.service';

/** Protected finance mutation. No environment default role and no client-trusted identity. */
@Controller('api/finance-write')
export class FinanceWriteController {
  constructor(private readonly db: DatabaseService, private readonly billing: FinanceBillingService, private readonly familyMealBilling: FamilyMealBillingService) {}

  private async authorize(request: object): Promise<string> {
    // Block write paths until cross-module contract/ledger/runtime acceptance.
    if (process.env.TAMANCARE_FINANCE_WRITE_ENABLED !== 'true') {
      throw new ForbiddenException('FINANCE_WRITE_RELEASE_GATE_CLOSED');
    }
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
    try {
      return await this.billing.allocatePayment({
        receiptId:v.receiptId as string,invoiceId:v.invoiceId as string,
        allocationId:v.allocationId as string,amountVnd:v.amountVnd as string,
        operationKey:v.operationKey as string,actorId,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';

      const validationErrors = new Set([
        'FINANCE_CROSS_RESIDENT_FORBIDDEN',
        'CROSS_RESIDENT_ALLOCATION_FORBIDDEN',
        'FINANCE_RECEIPT_NOT_CONFIRMED',
        'FINANCE_INVOICE_NOT_PAYABLE',
        'FINANCE_INVALID_INTEGER_VND',
        'FINANCE_VND_LIMIT',
        'INVALID_VND_AMOUNT',
        'VND_AMOUNT_OUT_OF_RANGE',
        'FINANCE_ZERO_ALLOCATION',
        'INVALID_DOCUMENT_ID',
        'FINANCE_DOCUMENT_NOT_FOUND',
      ]);

      const conflictErrors = new Set([
        'FINANCE_ALLOCATION_OUT_OF_BOUNDS',
        'RECEIPT_BALANCE_EXCEEDED',
        'INVOICE_BALANCE_EXCEEDED',
        'FINANCE_IDEMPOTENCY_CONFLICT',
        'FINANCE_OPERATION_INCOMPLETE',
      ]);

      if (validationErrors.has(code)) {
        throw new UnprocessableEntityException(code);
      }

      if (conflictErrors.has(code)) {
        throw new ConflictException(code);
      }

      // Unknown errors remain server failures.
      throw error;
    }
  }

  @Post('invoices/drafts/family-meals')
  async generateFamilyMealDraft(@Req() request: object, @Body() body: unknown) {
    const actorId = await this.authorize(request);
    const identity = readVerifiedFinanceIdentity(request)!;
    const draftRoles = (process.env.TAMANCARE_FINANCE_BILLING_DRAFT_ROLES || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!draftRoles.length || draftRoles.some(x => !/^[A-Z][A-Z0-9_]{1,63}$/.test(x)) || !draftRoles.includes(identity.actorRole)) throw new ForbiddenException('FINANCE_BILLING_DRAFT_PERMISSION_DENIED');
    const activeActor = await this.db.query(`SELECT 1 FROM public.staff_actors WHERE actor_id=$1 AND status='ACTIVE' AND primary_operational_role=$2`, [actorId,identity.actorRole]);
    if (activeActor.rowCount !== 1) throw new ForbiddenException('FINANCE_ACTIVE_ACTOR_REQUIRED');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('FAMILY_MEAL_BILLING_REQUEST_INVALID');
    const input = body as Record<string, unknown>;
    if (Object.keys(input).sort().join('|') !== 'billingMonth|residentId' || typeof input.residentId !== 'string' || typeof input.billingMonth !== 'string') throw new BadRequestException('FAMILY_MEAL_BILLING_REQUEST_INVALID');
    return this.familyMealBilling.generateDraft({ residentId: input.residentId, billingMonth: input.billingMonth, actorId });
  }

  private async authorizeInvoiceAction(request: object, action: 'REVIEW'|'APPROVE'|'ISSUE'): Promise<{actorId:string;actorRole:string}> {
    const actorId = await this.authorize(request);
    const identity = readVerifiedFinanceIdentity(request)!;
    const roles = (process.env[`TAMANCARE_FINANCE_INVOICE_${action}_ROLES`] || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!roles.length || roles.some(x => !/^[A-Z][A-Z0-9_]{1,63}$/.test(x)) || !roles.includes(identity.actorRole)) throw new ForbiddenException(`FINANCE_INVOICE_${action}_PERMISSION_DENIED`);
    const activeActor = await this.db.query(`SELECT 1 FROM public.staff_actors WHERE actor_id=$1 AND status='ACTIVE' AND primary_operational_role=$2`, [actorId,identity.actorRole]);
    if (activeActor.rowCount !== 1) throw new ForbiddenException('FINANCE_ACTIVE_ACTOR_REQUIRED');
    return {actorId,actorRole:identity.actorRole};
  }

  private actionReason(body: unknown): string {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('FINANCE_INVOICE_ACTION_INVALID');
    const value = body as Record<string, unknown>;
    if (Object.keys(value).join('|') !== 'reason' || typeof value.reason !== 'string' || value.reason.trim().length < 5 || value.reason.length > 1000) throw new BadRequestException('FINANCE_INVOICE_ACTION_INVALID');
    return value.reason.trim();
  }

  @Post('invoices/:invoiceId/review')
  async reviewFamilyMealInvoice(@Req() request: object, @Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    const identity = await this.authorizeInvoiceAction(request,'REVIEW');
    return this.familyMealBilling.reviewInvoice({invoiceId,...identity,reason:this.actionReason(body)});
  }

  @Post('invoices/:invoiceId/approve')
  async approveFamilyMealInvoice(@Req() request: object, @Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    const identity = await this.authorizeInvoiceAction(request,'APPROVE');
    return this.familyMealBilling.approveInvoice({invoiceId,...identity,reason:this.actionReason(body)});
  }

  @Post('invoices/:invoiceId/issue')
  async issueFamilyMealInvoice(@Req() request: object, @Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    const identity = await this.authorizeInvoiceAction(request,'ISSUE');
    return this.familyMealBilling.issueInvoice({invoiceId,...identity,reason:this.actionReason(body)});
  }
}
