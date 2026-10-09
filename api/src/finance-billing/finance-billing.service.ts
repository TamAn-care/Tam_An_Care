import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { PoolClient } from 'pg';

/**
 * Finance billing persistence foundation.
 *
 * NOT wired to any public controller.
 * Caller identity MUST come from a verified server-side session.
 * Does not generate invoices, post ledger entries, or create
 * demonstration/business records automatically.
 *
 * Each successful allocation is written transactionally.
 */
@Injectable()
export class FinanceBillingService {
  constructor(private readonly db: DatabaseService) {}

  private readonly maxVnd = 9999999999999999n;

  private parseVnd(value: unknown): bigint {
    const s = String(value);
    if (!/^(0|[1-9]\d*)(?:\.00?)?$/.test(s)) {
      throw new Error('INVALID_VND_AMOUNT');
    }
    const n = BigInt(s.split('.')[0]);
    if (n < 0n || n > this.maxVnd) {
      throw new Error('VND_AMOUNT_OUT_OF_RANGE');
    }
    return n;
  }

  private validId(value: unknown): string {
    if (
      typeof value !== 'string' ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(value)
    ) {
      throw new Error('INVALID_DOCUMENT_ID');
    }
    return value;
  }

  async getInvoiceBalance(invoiceId: string) {
    const id = this.validId(invoiceId);
    const result = await this.db.getPool().query(
      `SELECT i.invoice_id, i.resident_id,
              i.status, i.total_amount_vnd,
              COALESCE(SUM(a.amount_vnd),0) AS allocated_vnd
       FROM public.billing_invoices i
       LEFT JOIN public.billing_payment_allocations a
         ON a.invoice_id = i.invoice_id
       WHERE i.invoice_id = $1
       GROUP BY i.invoice_id, i.resident_id,
                i.status, i.total_amount_vnd`,
      [id],
    );

    if (!result.rows.length) return null;
    const row = result.rows[0];

    const total = this.parseVnd(row.total_amount_vnd);
    const allocated = this.parseVnd(row.allocated_vnd);
    if (allocated > total) {
      throw new Error('INVOICE_ALLOCATION_CORRUPTION');
    }

    return {
      invoiceId: row.invoice_id as string,
      status: row.status as string,
      totalVnd: total.toString(),
      allocatedVnd: allocated.toString(),
      outstandingVnd: (total - allocated).toString(),
    };
  }

  /**
   * Internal only: future controller must validate actor RBAC
   * and persistent idempotency before invoking this method.
   *
   * This foundation deliberately refuses to make mutations
   * until its authenticated-operation integration is complete.
   */
  async allocatePayment(_input: {
    receiptId: string;
    invoiceId: string;
    allocationId: string;
    amountVnd: string;
    actorId: string;
    operationKey: string;
  }): Promise<never> {
    throw new Error('FINANCE_MUTATION_NOT_YET_AUTHORIZED');
  }

  /**
   * For the next integration gate: ensures lock order is
   * deterministic when the real mutation is implemented.
   * Does not perform writes.
   */
  async inspectLockedDocuments(
    client: PoolClient,
    receiptId: string,
    invoiceId: string,
  ) {
    const rid = this.validId(receiptId);
    const iid = this.validId(invoiceId);

    // All allocation operations must lock both parent
    // documents in the same order.
    const receipt = await client.query(
      `SELECT receipt_id,resident_id,status,amount_vnd
       FROM public.billing_receipts
       WHERE receipt_id=$1 FOR UPDATE`,
      [rid],
    );

    const invoice = await client.query(
      `SELECT invoice_id,resident_id,status,total_amount_vnd
       FROM public.billing_invoices
       WHERE invoice_id=$1 FOR UPDATE`,
      [iid],
    );

    if (receipt.rows.length !== 1 ||
        invoice.rows.length !== 1) {
      throw new Error('FINANCE_DOCUMENT_NOT_FOUND');
    }

    if (receipt.rows[0].resident_id !==
        invoice.rows[0].resident_id) {
      throw new Error('CROSS_RESIDENT_ALLOCATION_FORBIDDEN');
    }

    return {
      receipt: receipt.rows[0],
      invoice: invoice.rows[0],
    };
  }
}
