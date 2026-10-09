import { randomUUID, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

/**
 * Internal transaction engine. NOT a controller or a public API.
 *
 * IMPORTANT:
 * - The future caller must obtain actor identity and permissions
 *   from a verified backend session.
 * - Schema migrations must be deployed safely before use.
 * - Do not call from browser-supplied role or actor headers.
 * - No demo data or automatic bootstrap.
 */
export interface TrustedFinanceContext {
  actorId: string;
  financeWriteAuthorized: boolean;
}

export interface AllocatePaymentInput {
  operationKey: string;
  receiptId: string;
  invoiceId: string;
  amountVnd: string;
}

export class FinancePaymentAllocationEngine {
  constructor(private readonly pool: Pool) {}

  private id(v: string): string {
    if (typeof v !== 'string' ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(v)) {
      throw new Error('INVALID_FINANCE_ID');
    }
    return v;
  }

  private money(v: unknown): bigint {
    const text = String(v);
    if (!/^(0|[1-9]\d*)(?:\.0{1,2})?$/.test(text)) {
      throw new Error('INVALID_VND');
    }
    const n = BigInt(text.split('.')[0]);
    if (n > 9999999999999999n) {
      throw new Error('VND_OUT_OF_RANGE');
    }
    return n;
  }

  private async balance(
    client: PoolClient,
    column: 'receipt_id' | 'invoice_id',
    id: string,
  ): Promise<bigint> {
    const result = await client.query(
      `SELECT COALESCE(SUM(amount_vnd),0)::text AS allocated
       FROM public.billing_payment_allocations
       WHERE ${column}=$1`,
      [id],
    );
    return this.money(result.rows[0].allocated);
  }

  async allocate(
    input: AllocatePaymentInput,
    context: TrustedFinanceContext,
  ): Promise<{ allocationId: string; replayed: boolean }> {
    if (!context ||
        context.financeWriteAuthorized !== true ||
        !this.id(context.actorId)) {
      throw new Error('FINANCE_AUTHORIZATION_REQUIRED');
    }

    const operationKey = this.id(input.operationKey);
    const receiptId = this.id(input.receiptId);
    const invoiceId = this.id(input.invoiceId);
    const amount = this.money(input.amountVnd);

    if (amount <= 0n) {
      throw new Error('ALLOCATION_MUST_BE_POSITIVE');
    }

    const normalized = {
      operationType: 'ALLOCATE_PAYMENT',
      receiptId, invoiceId,
      amountVnd: amount.toString(),
    };
    const requestHash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');

    const client = await this.pool.connect();
    let transactionActive = false;

    try {
      await client.query('BEGIN');
      transactionActive = true;

      // Lock the operation key before its idempotency lookup.
      await client.query(
        `SELECT pg_advisory_xact_lock(
           hashtextextended($1,0)
         )`,
        [operationKey],
      );

      const previous = await client.query(
        `SELECT operation_type, request_hash, actor_id,
                status, result_payload
         FROM public.finance_operation_idempotency
         WHERE operation_key=$1 FOR UPDATE`,
        [operationKey],
      );

      if (previous.rows.length) {
        const row = previous.rows[0];
        if (row.operation_type !== 'ALLOCATE_PAYMENT' ||
            row.request_hash !== requestHash ||
            row.actor_id !== context.actorId) {
          throw new Error('IDEMPOTENCY_CONFLICT');
        }
        if (row.status !== 'COMPLETED' ||
            typeof row.result_payload?.allocationId !== 'string') {
          throw new Error('INCOMPLETE_IDEMPOTENT_OPERATION');
        }
        await client.query('COMMIT');
        transactionActive = false;
        return {
          allocationId: row.result_payload.allocationId,
          replayed: true,
        };
      }

      // Every allocation locks parent documents in this order:
      // receipt first, invoice second.
      const receipt = await client.query(
        `SELECT receipt_id, resident_id, amount_vnd, status
         FROM public.billing_receipts
         WHERE receipt_id=$1 FOR UPDATE`,
        [receiptId],
      );

      const invoice = await client.query(
        `SELECT invoice_id, resident_id, total_amount_vnd,
                status
         FROM public.billing_invoices
         WHERE invoice_id=$1 FOR UPDATE`,
        [invoiceId],
      );

      if (receipt.rows.length !== 1 ||
          invoice.rows.length !== 1) {
        throw new Error('FINANCE_DOCUMENT_NOT_FOUND');
      }

      const r = receipt.rows[0];
      const i = invoice.rows[0];

      if (r.resident_id !== i.resident_id) {
        throw new Error('CROSS_RESIDENT_ALLOCATION_FORBIDDEN');
      }

      // Explicitly fail closed until business status mappings
      // are validated against the actual billing workflow.
      const receiptStatus = String(r.status);
      const invoiceStatus = String(i.status);

      if (!['CONFIRMED'].includes(receiptStatus)) {
        throw new Error('RECEIPT_STATUS_NOT_ELIGIBLE');
      }
      if (!['ISSUED', 'PARTIAL'].includes(invoiceStatus)) {
        throw new Error('INVOICE_STATUS_NOT_ELIGIBLE');
      }

      const receiptTotal = this.money(r.amount_vnd);
      const invoiceTotal = this.money(i.total_amount_vnd);

      const receiptAllocated = await this.balance(
        client, 'receipt_id', receiptId,
      );
      const invoiceAllocated = await this.balance(
        client, 'invoice_id', invoiceId,
      );

      if (receiptAllocated > receiptTotal ||
          invoiceAllocated > invoiceTotal) {
        throw new Error('EXISTING_ALLOCATION_CORRUPTION');
      }

      if (amount > receiptTotal - receiptAllocated) {
        throw new Error('RECEIPT_BALANCE_EXCEEDED');
      }
      if (amount > invoiceTotal - invoiceAllocated) {
        throw new Error('INVOICE_BALANCE_EXCEEDED');
      }

      const allocationId = randomUUID();

      await client.query(
        `INSERT INTO public.finance_operation_idempotency
           (operation_key, operation_type, request_hash, actor_id)
         VALUES ($1,'ALLOCATE_PAYMENT',$2,$3)`,
        [operationKey, requestHash, context.actorId],
      );

      await client.query(
        `INSERT INTO public.billing_payment_allocations
           (allocation_id, receipt_id, invoice_id, amount_vnd)
         VALUES ($1,$2,$3,$4::numeric)`,
        [allocationId, receiptId, invoiceId, amount.toString()],
      );

      await client.query(
        `INSERT INTO public.finance_operation_audit
           (operation_key,actor_id,action,details)
         VALUES ($1,$2,'ALLOCATE_PAYMENT',$3::jsonb)`,
        [
          operationKey,
          context.actorId,
          JSON.stringify({
            receiptId,
            invoiceId,
            allocationId,
            amountVnd: amount.toString(),
          }),
        ],
      );

      await client.query(
        `UPDATE public.finance_operation_idempotency
         SET status='COMPLETED',
             completed_at=now(),
             result_payload=$2::jsonb
         WHERE operation_key=$1`,
        [
          operationKey,
          JSON.stringify({ allocationId }),
        ],
      );

      await client.query('COMMIT');
      transactionActive = false;

      return { allocationId, replayed: false };
    } catch (error) {
      if (transactionActive) {
        try {
          await client.query('ROLLBACK');
        } catch {
          throw new Error('FINANCE_ROLLBACK_FAILED');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
