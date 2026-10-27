import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';

export type IssuedPaymentNotice = {
  invoice_id: string;
  invoice_code: string | null;
  resident_id: string;
  contract_id: string;
  billing_month: string;
  status: 'ISSUED' | 'PARTIAL' | 'PAID';
  total_amount_vnd: string;
  allocated_amount_vnd: string;
  balance_vnd: string;
  source_snapshot: Record<string, unknown>;
  source_snapshot_sha256: string;
  issued_at: string;
};

function validMoney(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
}

export async function fetchIssuedPaymentNotice(
  actor: HumanActorSession,
  residentId: string,
  month: string,
): Promise<IssuedPaymentNotice[]> {
  const result = await apiRequest<{
    source: string;
    residentId: string;
    billingMonth: string;
    notices: IssuedPaymentNotice[];
  }>(`/api/finance-read/residents/${encodeURIComponent(residentId)}/payment-notices/${month}`, { actor });
  if (result.source !== 'POSTGRESQL' || result.residentId !== residentId || result.billingMonth !== month || !Array.isArray(result.notices)) {
    throw new Error('FINANCE_PAYMENT_NOTICE_RESPONSE_INVALID');
  }
  for (const row of result.notices) {
    if (row.resident_id !== residentId || row.billing_month !== month || !['ISSUED', 'PARTIAL', 'PAID'].includes(row.status) ||
      !validMoney(row.total_amount_vnd) || !validMoney(row.allocated_amount_vnd) || !validMoney(row.balance_vnd) ||
      !row.source_snapshot || typeof row.source_snapshot !== 'object' || !/^[a-f0-9]{64}$/i.test(row.source_snapshot_sha256)) {
      throw new Error('FINANCE_PAYMENT_NOTICE_SNAPSHOT_INVALID');
    }
    const policy = row.source_snapshot.residentMealPolicy as Record<string, unknown> | undefined;
    const invoice = row.source_snapshot.invoice as Record<string, unknown> | undefined;
    if (!invoice || invoice.totalAmountVnd !== row.total_amount_vnd || BigInt(row.allocated_amount_vnd) > BigInt(row.total_amount_vnd) ||
      BigInt(row.balance_vnd) !== BigInt(row.total_amount_vnd) - BigInt(row.allocated_amount_vnd)) {
      throw new Error('FINANCE_PAYMENT_NOTICE_TOTAL_MISMATCH');
    }
    if (policy?.includedInContractPackage !== true || policy.separatelyBillable !== false ||
      row.source_snapshot.schemaVersion !== 'FINANCE_INVOICE_SNAPSHOT_V1') {
      throw new Error('FINANCE_PAYMENT_NOTICE_RESIDENT_MEAL_POLICY_INVALID');
    }
  }
  return result.notices;
}
