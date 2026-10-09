/**
 * TamAnCare monthly operating result — pure, no I/O or writes.
 * The caller MUST map and reconcile the canonical finance_entries ledger.
 * An invoice/receipt/allocation is never counted directly as revenue.
 *
 * No runtime registration, migration, seed, demo data, or production deployment.
 */
export type MonthlyLedgerKind = 'REVENUE' | 'EXPENSE';
export type MonthlyLedgerEntry = {
  entryId: string;
  kind: MonthlyLedgerKind;
  recognitionDate: string; // YYYY-MM-DD, business-recognition date, not cash date
  amountVnd: string; // nonnegative, whole VND
  posted: boolean;
  sourceVerified: boolean;
};
export type MonthlyResult = {
  month: string;
  state: 'READY' | 'CHUA_DU_DU_LIEU';
  revenueVnd: string | null;
  expenseVnd: string | null;
  profitVnd: string | null; // may be negative ONLY when READY
  revenueEntries: number;
  expenseEntries: number;
  reasons: string[];
};
const MAX_VND = 9999999999999999n;
function vnd(raw: string): bigint {
  if (typeof raw !== 'string' || !/^(0|[1-9]\\d*)(?:\\.0{1,2})?$/.test(raw)) {
    throw new Error('MONTHLY_FINANCE_INVALID_VND');
  }
  const value = BigInt(raw.split('.')[0]);
  if (value > MAX_VND) throw new Error('MONTHLY_FINANCE_AMOUNT_OVERFLOW');
  return value;
}
function validDate(raw: string): boolean {
  if (typeof raw !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 9999 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}
/**
 * ledgerCoverageComplete MUST come from an independently verified, bounded
 * canonical ledger query, not from a UI toggle or invoice count.
 * reconciliationComplete MUST cover unlinked/duplicated source postings.
 */
export function calculateMonthlyOperatingResult(input: {
  month: string;
  entries: readonly MonthlyLedgerEntry[];
  ledgerCoverageComplete: boolean;
  reconciliationComplete: boolean;
}): MonthlyResult {
  const { month, entries, ledgerCoverageComplete, reconciliationComplete } = input;
  if (typeof month !== 'string' || !/^\\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      Number(month.slice(0, 4)) < 1900) {
    throw new Error('MONTHLY_FINANCE_INVALID_MONTH');
  }
  if (!Array.isArray(entries)) throw new Error('MONTHLY_FINANCE_INVALID_ENTRIES');
  const seen = new Set<string>();
  const reasons: string[] = [];
  if (!ledgerCoverageComplete) reasons.push('LEDGER_COVERAGE_UNVERIFIED');
  if (!reconciliationComplete) reasons.push('SOURCE_RECONCILIATION_PENDING');
  let revenue = 0n, expense = 0n, revenueEntries = 0, expenseEntries = 0;
  for (const entry of entries) {
    if (!entry || typeof entry.entryId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(entry.entryId) ||
        seen.has(entry.entryId)) {
      throw new Error('MONTHLY_FINANCE_DUPLICATE_OR_INVALID_ENTRY');
    }
    seen.add(entry.entryId);
    if (entry.kind !== 'REVENUE' && entry.kind !== 'EXPENSE') {
      throw new Error('MONTHLY_FINANCE_UNKNOWN_LEDGER_KIND');
    }
    if (!validDate(entry.recognitionDate)) {
      throw new Error('MONTHLY_FINANCE_INVALID_RECOGNITION_DATE');
    }
    const amount = vnd(entry.amountVnd);
    if (entry.recognitionDate.slice(0, 7) !== month) {
      throw new Error('MONTHLY_FINANCE_ENTRY_OUTSIDE_MONTH');
    }
    if (entry.posted !== true || entry.sourceVerified !== true) {
      if (!reasons.includes('UNVERIFIED_LEDGER_ENTRY')) reasons.push('UNVERIFIED_LEDGER_ENTRY');
      continue;
    }
    if (entry.kind === 'REVENUE') { revenue += amount; revenueEntries++; }
    else { expense += amount; expenseEntries++; }
    if (revenue > MAX_VND || expense > MAX_VND) {
      throw new Error('MONTHLY_FINANCE_TOTAL_OVERFLOW');
    }
  }
  if (reasons.length) return {
    month, state: 'CHUA_DU_DU_LIEU', revenueVnd: null, expenseVnd: null,
    profitVnd: null, revenueEntries, expenseEntries, reasons,
  };
  return {
    month, state: 'READY', revenueVnd: revenue.toString(),
    expenseVnd: expense.toString(), profitVnd: (revenue - expense).toString(),
    revenueEntries, expenseEntries, reasons: [],
  };
}
