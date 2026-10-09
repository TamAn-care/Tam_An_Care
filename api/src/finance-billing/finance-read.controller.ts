
import {
  Controller,
  Get,
  Param,
  Req,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { MonthlyOperatingResultService } from './monthly-operating-result.service';
import {
  readVerifiedFinanceIdentity,
} from '../security/verified-finance-identity';

/**
 * Development-only Finance read controller.
 *
 * Registered only as a guarded read surface on this development branch.
 * No monthly-result write operation is exposed.
 *
 * Default deny unless an approved read-role allowlist
 * has been set server-side.
 */
@Controller('api/finance-read')
export class FinanceReadController {
  constructor(
    private readonly db: DatabaseService,
    private readonly monthlyResult: MonthlyOperatingResultService,
  ) {}

  private async authorize(request: object): Promise<void> {
    const identity=readVerifiedFinanceIdentity(request);

    if (!identity) {
      throw new ForbiddenException(
        'FINANCE_VERIFIED_IDENTITY_REQUIRED',
      );
    }

    const roles=(process.env.TAMANCARE_FINANCE_READ_ROLES || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (
      roles.length === 0 ||
      roles.some(
        (role) => !/^[A-Z][A-Z0-9_]{1,63}$/.test(role),
      ) ||
      !roles.includes(identity.actorRole)
    ) {
      throw new ForbiddenException(
        'FINANCE_READ_ROLE_NOT_AUTHORIZED',
      );
    }

    // Finance-wide access requires explicit server-side approval.
    // Empty configuration denies every role.
    const centerwideRoles = (
      process.env.TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES || ''
    )
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);

    if (
      centerwideRoles.length === 0 ||
      centerwideRoles.some(
        (role) => !/^[A-Z][A-Z0-9_]{1,63}$/.test(role),
      ) ||
      !centerwideRoles.includes(identity.actorRole)
    ) {
      throw new ForbiddenException(
        'FINANCE_CENTERWIDE_SCOPE_NOT_AUTHORIZED',
      );
    }

    const session=await this.db.query<{
      actor_id: string;
      actor_role: string;
    }>(
      `SELECT actor_id, actor_role
       FROM auth_sessions
       WHERE session_id = $1
         AND actor_id = $2
         AND actor_role = $3
         AND revoked_at IS NULL
         AND expires_at > now()
       LIMIT 1`,
      [
        identity.sessionId,
        identity.actorId,
        identity.actorRole,
      ],
    );

    if (
      session.rows.length !== 1 ||
      session.rows[0].actor_id !== identity.actorId ||
      session.rows[0].actor_role !== identity.actorRole
    ) {
      throw new ForbiddenException(
        'FINANCE_SESSION_NOT_ACTIVE',
      );
    }
  }

  @Get('invoices/:invoiceId/balance')
  async getInvoiceBalance(
    @Req() request: object,
    @Param('invoiceId') invoiceId: string,
  ) {
    await this.authorize(request);

    if (
      typeof invoiceId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,120}$/.test(invoiceId)
    ) {
      throw new BadRequestException(
        'INVALID_FINANCE_INVOICE_ID',
      );
    }

    const result=await this.db.query<{
      invoice_id: string;
      resident_id: string;
      status: string;
      total_amount_vnd: string;
      allocated_amount_vnd: string;
      balance_vnd: string;
    }>(
      `SELECT
         i.invoice_id,
         i.resident_id,
         i.status,
         i.total_amount_vnd::text AS total_amount_vnd,
         COALESCE(
           SUM(a.amount_vnd),0
         )::text AS allocated_amount_vnd,
         (
           i.total_amount_vnd -
           COALESCE(SUM(a.amount_vnd),0)
         )::text AS balance_vnd
       FROM billing_invoices i
       LEFT JOIN billing_payment_allocations a
         ON a.invoice_id = i.invoice_id
       WHERE i.invoice_id = $1
       GROUP BY
         i.invoice_id,
         i.resident_id,
         i.status,
         i.total_amount_vnd`,
      [invoiceId],
    );

    if (result.rows.length !== 1) {
      throw new NotFoundException(
        'FINANCE_INVOICE_NOT_FOUND',
      );
    }

    return {
      source: 'POSTGRESQL',
      ...result.rows[0],
    };
  }

  // FINANCE_V2926_READ_API_SOURCE

  // Finance reads are scoped to explicitly approved
  // centerwide roles via the existing authorize() method.

  @Get('operating-result/month/:month')
  async getMonthlyOperatingResult(
    @Req() request: object,
    @Param('month') month: string,
  ) {
    await this.authorize(request);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('FINANCE_INVALID_OPERATING_MONTH');
    }
    return this.monthlyResult.read(month);
  }

  @Get('invoices/month/:month')
  async listInvoicesByMonth(
    @Req() request: object,
    @Param('month') month: string,
  ) {
    await this.authorize(request);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('FINANCE_INVALID_BILLING_MONTH');
    }

    const result = await this.db.query(
      `SELECT i.invoice_id, i.invoice_code,
              i.resident_id, i.contract_id,
              i.billing_month, i.status,
              i.total_amount_vnd::text AS total_amount_vnd,
              COALESCE(SUM(a.amount_vnd), 0)::text
                AS allocated_amount_vnd,
              (i.total_amount_vnd -
                 COALESCE(SUM(a.amount_vnd), 0))::text
                AS balance_vnd
         FROM billing_invoices i
         LEFT JOIN billing_payment_allocations a
           ON a.invoice_id = i.invoice_id
        WHERE i.billing_month = $1::date
        GROUP BY i.invoice_id, i.invoice_code,
                 i.resident_id, i.contract_id,
                 i.billing_month, i.status,
                 i.total_amount_vnd
        ORDER BY i.invoice_code, i.invoice_id
        LIMIT 500`,
      [month + '-01'],
    );
    return { source: 'POSTGRESQL', items: result.rows };
  }

  @Get('invoices/:invoiceId')
  async getInvoiceWithItems(
    @Req() request: object,
    @Param('invoiceId') invoiceId: string,
  ) {
    await this.authorize(request);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(invoiceId)) {
      throw new BadRequestException('FINANCE_INVALID_INVOICE_ID');
    }

    const invoice = await this.db.query(
      `SELECT i.invoice_id, i.invoice_code,
              i.resident_id, i.contract_id,
              i.billing_month, i.status,
              i.total_amount_vnd::text AS total_amount_vnd,
              COALESCE(SUM(a.amount_vnd), 0)::text
                AS allocated_amount_vnd,
              (i.total_amount_vnd -
                 COALESCE(SUM(a.amount_vnd), 0))::text
                AS balance_vnd
         FROM billing_invoices i
         LEFT JOIN billing_payment_allocations a
           ON a.invoice_id = i.invoice_id
        WHERE i.invoice_id = $1
        GROUP BY i.invoice_id, i.invoice_code,
                 i.resident_id, i.contract_id,
                 i.billing_month, i.status,
                 i.total_amount_vnd`,
      [invoiceId],
    );

    if (invoice.rows.length === 0) {
      throw new NotFoundException('FINANCE_INVOICE_NOT_FOUND');
    }

    const items = await this.db.query(
      `SELECT item_id, invoice_id, description,
              quantity::text AS quantity,
              unit_price_vnd::text AS unit_price_vnd,
              line_total_vnd::text AS line_total_vnd
         FROM billing_invoice_items
        WHERE invoice_id = $1
        ORDER BY item_id`,
      [invoiceId],
    );

    return {
      source: 'POSTGRESQL',
      invoice: invoice.rows[0],
      items: items.rows,
    };
  }


  /**
   * Link-integrity audit only: no assumption about monetary ledger columns.
   * Does not post revenue. Missing/multiple links require manual reconciliation.
   */
  @Get('invoices/:invoiceId/ledger-links')
  async getInvoiceLedgerLinks(
    @Req() request: object,
    @Param('invoiceId') invoiceId: string,
  ) {
    await this.authorize(request);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(invoiceId)) {
      throw new BadRequestException('FINANCE_INVALID_INVOICE_ID');
    }
    const invoice=await this.db.query(
      `SELECT invoice_id FROM public.billing_invoices WHERE invoice_id=$1`,
      [invoiceId],
    );
    if (invoice.rows.length!==1) throw new NotFoundException('FINANCE_INVOICE_NOT_FOUND');
    const result=await this.db.query(
      `SELECT l.source_domain,l.source_type,l.source_id,l.posting_kind,
              l.finance_entry_id,
              (e.finance_entry_id IS NOT NULL) AS entry_exists
         FROM public.finance_source_links l
         LEFT JOIN public.finance_entries e ON e.finance_entry_id=l.finance_entry_id
        WHERE l.source_domain='BILLING'
          AND l.source_type='INVOICE' AND l.source_id=$1
        ORDER BY l.posting_kind,l.finance_entry_id
        LIMIT 100`,
      [invoiceId],
    );
    const rows=result.rows as Array<{posting_kind:string;entry_exists:boolean}>;
    const revenue=rows.filter(row=>row.posting_kind==='REVENUE');
    // A link alone does NOT prove ledger type, recognition date or amount.
    // Never mark revenue reconciled before verifying the canonical event.
    const status=revenue.length===1 && revenue[0].entry_exists
      ? 'LINK_PRESENT_REVENUE_UNVERIFIED'
      : revenue.length===0 ? 'REVENUE_LINK_MISSING'
      : revenue.length>1 ? 'REVENUE_LINK_DUPLICATE'
      : 'REVENUE_LEDGER_ENTRY_MISSING';
    return {source:'POSTGRESQL',invoiceId,status,links:result.rows,
      revenuePostedAutomatically:false};
  }

  @Get('receipts')
  async listLatestReceipts(@Req() request: object) {
    await this.authorize(request);
    const result = await this.db.query(
      `SELECT receipt_id, receipt_code, resident_id,
              amount_vnd::text AS amount_vnd,
              received_date, status, external_reference,
              created_at
         FROM billing_receipts
        ORDER BY created_at DESC, receipt_id DESC
        LIMIT 100`,
      [],
    );
    return { source: 'POSTGRESQL', items: result.rows };
  }

  @Get('receipts/invoice/:invoiceId')
  async listReceiptsForInvoice(
    @Req() request: object,
    @Param('invoiceId') invoiceId: string,
  ) {
    await this.authorize(request);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(invoiceId)) {
      throw new BadRequestException('FINANCE_INVALID_INVOICE_ID');
    }

    const result = await this.db.query(
      `SELECT r.receipt_id, r.receipt_code,
              r.resident_id,
              r.amount_vnd::text AS amount_vnd,
              r.received_date, r.status,
              r.external_reference, r.created_at,
              COALESCE(SUM(a.amount_vnd), 0)::text
                AS amount_allocated_to_invoice_vnd
         FROM billing_receipts r
         JOIN billing_payment_allocations a
           ON a.receipt_id = r.receipt_id
        WHERE a.invoice_id = $1
        GROUP BY r.receipt_id, r.receipt_code,
                 r.resident_id, r.amount_vnd,
                 r.received_date, r.status,
                 r.external_reference, r.created_at
        ORDER BY r.created_at DESC, r.receipt_id DESC
        LIMIT 100`,
      [invoiceId],
    );

    return { source: 'POSTGRESQL', items: result.rows };
  }

}
