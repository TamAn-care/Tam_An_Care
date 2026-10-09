import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { PoolClient } from 'pg';
import { createHash } from 'crypto';
import { validateFinanceCommand } from './finance-command-policy';

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
   * INTERNAL ONLY — not registered with any write HTTP route.
   * Caller MUST verify server-issued identity, active session and write RBAC.
   * The operation is atomic, idempotent, auditable, and fails closed.
   * Payment settlement DOES NOT create revenue or finance_entries.
   */
  async allocatePayment(input: {
    receiptId: string;
    invoiceId: string;
    allocationId: string;
    amountVnd: string;
    actorId: string;
    operationKey: string;
  }): Promise<{ allocationId: string; replayed: boolean }> {
    const receiptId=this.validId(input.receiptId);
    const invoiceId=this.validId(input.invoiceId);
    const allocationId=this.validId(input.allocationId);
    const actorId=this.validId(input.actorId);
    const operationKey=this.validId(input.operationKey);
    const amountVnd=this.parseVnd(input.amountVnd);
    if (amountVnd === 0n) throw new Error('FINANCE_ZERO_ALLOCATION');
    const canonical = JSON.stringify({
      kind:'ALLOCATE_RECEIPT',receiptId,invoiceId,allocationId,
      amountVnd:amountVnd.toString(),actorId,
    });
    const hash=createHash('sha256').update(canonical).digest('hex');
    return this.db.withTransaction(async (client) => {
      const inserted=await client.query(
        `INSERT INTO public.finance_operation_idempotency
          (operation_key,operation_type,request_hash,actor_id,status)
         VALUES ($1,'ALLOCATE_RECEIPT',$2,$3,'IN_PROGRESS')
         ON CONFLICT (operation_key) DO NOTHING RETURNING operation_key`,
        [operationKey,hash,actorId],
      );
      if (inserted.rowCount === 0) {
        const old=await client.query(
          `SELECT operation_type,request_hash,actor_id,status,result_payload
           FROM public.finance_operation_idempotency
           WHERE operation_key=$1 FOR UPDATE`, [operationKey],
        );
        const row=old.rows[0];
        if (!row || row.operation_type!=='ALLOCATE_RECEIPT' ||
          row.request_hash!==hash || row.actor_id!==actorId) {
          throw new Error('FINANCE_IDEMPOTENCY_CONFLICT');
        }
        if (row.status !== 'COMPLETED' ||
          row.result_payload?.allocationId !== allocationId) {
          throw new Error('FINANCE_OPERATION_INCOMPLETE');
        }
        return {allocationId,replayed:true};
      }
      const {receipt,invoice}=await this.inspectLockedDocuments(
        client,receiptId,invoiceId,
      );
      const usedReceipt=await client.query(
        `SELECT COALESCE(SUM(amount_vnd),0)::text AS used
         FROM public.billing_payment_allocations WHERE receipt_id=$1`,
        [receiptId],
      );
      const usedInvoice=await client.query(
        `SELECT COALESCE(SUM(amount_vnd),0)::text AS used
         FROM public.billing_payment_allocations WHERE invoice_id=$1`,
        [invoiceId],
      );
      const receiptRemaining=this.parseVnd(receipt.amount_vnd) -
        this.parseVnd(usedReceipt.rows[0].used);
      const invoiceRemaining=this.parseVnd(invoice.total_amount_vnd) -
        this.parseVnd(usedInvoice.rows[0].used);
      if (receiptRemaining < 0n || invoiceRemaining < 0n) {
        throw new Error('FINANCE_ALLOCATION_CORRUPTION');
      }
      validateFinanceCommand({
        kind:'ALLOCATE_RECEIPT',receiptStatus:receipt.status,
        invoiceStatus:invoice.status,sameResident:true,
        amountVnd:amountVnd.toString(),
        receiptRemainingVnd:receiptRemaining.toString(),
        invoiceRemainingVnd:invoiceRemaining.toString(),
      });
      await client.query(
        `INSERT INTO public.billing_payment_allocations
          (allocation_id,receipt_id,invoice_id,amount_vnd)
         VALUES ($1,$2,$3,$4)`,
        [allocationId,receiptId,invoiceId,amountVnd.toString()],
      );
      await client.query(
        `UPDATE public.finance_operation_idempotency
         SET status='COMPLETED',completed_at=now(),
             result_payload=jsonb_build_object('allocationId',$2)
         WHERE operation_key=$1`,[operationKey,allocationId],
      );
      await client.query(
        `INSERT INTO public.finance_operation_audit
          (operation_key,actor_id,action,details)
         VALUES ($1,$2,'ALLOCATE_RECEIPT',$3::jsonb)`,
        [operationKey,actorId,JSON.stringify({
          receiptId,invoiceId,allocationId,amountVnd:amountVnd.toString(),
        })],
      );
      return {allocationId,replayed:false};
    });
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
