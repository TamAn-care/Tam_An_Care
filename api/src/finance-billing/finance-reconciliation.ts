/**
 * Finance ledger/billing reconciliation (pure, READ-ONLY).
 * This module does not persist, create invoices, or automatically recognize revenue.
 * Inputs must come from independently verified, authorized database reads.
 */
export type FinanceReconciliationIssueCode =
  | 'INVOICE_TOTAL_MISMATCH'
  | 'INVOICE_OVERALLOCATED'
  | 'RECEIPT_OVERALLOCATED'
  | 'MISSING_LEDGER_REVENUE'
  | 'DUPLICATE_LEDGER_REVENUE'
  | 'LEDGER_REVENUE_MISMATCH'
  | 'REVENUE_SOURCE_UNVERIFIED';

export interface InvoiceSnapshot {
  invoiceId: string;
  totalVnd: string;
  itemLineAmountsVnd: string[];
  allocatedVnd: string;
  status: string;
  // Explicit count and amount from *canonical* finance_entries REVENUE source.
  ledgerRevenueMatches: number;
  ledgerRevenueVnd: string | null;
  canonicalSourceVerified: boolean;
}
export interface ReceiptSnapshot {
  receiptId: string;
  amountVnd: string;
  allocatedVnd: string;
}
export interface ReconciliationIssue {
  code: FinanceReconciliationIssueCode;
  documentId: string;
}
export interface ReconciliationResult {
  valid: boolean;
  issues: ReconciliationIssue[];
  invoicesChecked: number;
  receiptsChecked: number;
}

function vnd(input: string): bigint {
  if (typeof input !== 'string' ||
      !/^(0|[1-9]\d*)(?:\.0{1,2})?$/.test(input)) {
    throw new Error('FINANCE_RECONCILIATION_INVALID_VND');
  }
  return BigInt(input.split('.')[0]);
}
function id(input: string): string {
  if (typeof input !== 'string' ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(input)) {
    throw new Error('FINANCE_RECONCILIATION_INVALID_ID');
  }
  return input;
}

/** No inferred booking or revenue event; fail closed on unverified source. */
export function reconcileFinanceSnapshots(
  invoices: readonly InvoiceSnapshot[],
  receipts: readonly ReceiptSnapshot[],
): ReconciliationResult {
  const issues: ReconciliationIssue[] = [];
  const seenInvoices = new Set<string>();
  const seenReceipts = new Set<string>();
  const add = (code: FinanceReconciliationIssueCode, documentId: string) =>
    issues.push({ code, documentId });
  for (const invoice of invoices) {
    const key = id(invoice.invoiceId);
    if (seenInvoices.has(key)) throw new Error('FINANCE_DUPLICATE_INVOICE_INPUT');
    seenInvoices.add(key);
    const total = vnd(invoice.totalVnd);
    const allocated = vnd(invoice.allocatedVnd);
    const lineTotal = invoice.itemLineAmountsVnd.reduce(
      (sum, amount) => sum + vnd(amount), 0n,
    );
    if (lineTotal !== total) add('INVOICE_TOTAL_MISMATCH', key);
    if (allocated > total) add('INVOICE_OVERALLOCATED', key);
    if (!Number.isSafeInteger(invoice.ledgerRevenueMatches) ||
        invoice.ledgerRevenueMatches < 0) {
      throw new Error('FINANCE_LEDGER_MATCH_COUNT_INVALID');
    }
    if (!invoice.canonicalSourceVerified) {
      add('REVENUE_SOURCE_UNVERIFIED', key);
      continue;
    }
    // No ledger revenue required for draft, voided or pre-issue invoices.
    const expected = ['ISSUED', 'PARTIAL', 'PAID'].includes(invoice.status);
    if (expected && invoice.ledgerRevenueMatches === 0) {
      add('MISSING_LEDGER_REVENUE', key);
    } else if (invoice.ledgerRevenueMatches > 1) {
      add('DUPLICATE_LEDGER_REVENUE', key);
    } else if (expected && invoice.ledgerRevenueMatches === 1 &&
               (invoice.ledgerRevenueVnd === null ||
                vnd(invoice.ledgerRevenueVnd) !== total)) {
      add('LEDGER_REVENUE_MISMATCH', key);
    } else if (!expected && invoice.ledgerRevenueMatches > 0) {
      add('REVENUE_SOURCE_UNVERIFIED', key);
    }
  }
  for (const receipt of receipts) {
    const key = id(receipt.receiptId);
    if (seenReceipts.has(key)) throw new Error('FINANCE_DUPLICATE_RECEIPT_INPUT');
    seenReceipts.add(key);
    if (vnd(receipt.allocatedVnd) > vnd(receipt.amountVnd)) {
      add('RECEIPT_OVERALLOCATED', key);
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    invoicesChecked: invoices.length,
    receiptsChecked: receipts.length,
  };
}
