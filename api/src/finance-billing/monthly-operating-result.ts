/**
 * Pure monthly P&L arithmetic over verified, posted canonical ledger rows.
 * No I/O, schema mutation, inferred operational metrics, or cash-to-revenue mapping.
 */
export type MonthlyLedgerKind =
  | 'REVENUE'
  | 'DIRECT_COST'
  | 'PAYROLL'
  | 'OPERATING_EXPENSE'
  | 'DEPRECIATION'
  | 'INTEREST'
  | 'TAX';

export type MonthlyLedgerEntry = {
  entryId: string;
  kind: MonthlyLedgerKind;
  recognitionDate: string;
  amountVnd: string;
  posted: boolean;
  sourceVerified: boolean;
};

export type MonthlyResult = {
  month: string;
  state: 'READY' | 'CHUA_DU_DU_LIEU';
  reconciliationStatus: 'DA_DOI_SOAT' | 'CHUA_DOI_SOAT';
  revenueVnd: string | null;
  directCostVnd: string | null;
  grossProfitVnd: string | null;
  payrollVnd: string | null;
  operatingExpenseVnd: string | null;
  ebitdaVnd: string | null;
  depreciationVnd: string | null;
  interestVnd: string | null;
  profitBeforeTaxVnd: string | null;
  taxVnd: string | null;
  netProfitVnd: string | null;
  netMarginPercent: string | null;
  expenseVnd: string | null;
  profitVnd: string | null;
  revenueEntries: number;
  expenseEntries: number;
  groupEntries: Record<MonthlyLedgerKind, number>;
  residentCount: number | null;
  bedOccupancyPercent: string | null;
  revenuePerResidentVnd: string | null;
  expensePerResidentVnd: string | null;
  breakEvenRevenueVnd: string | null;
  reasons: string[];
};

const KINDS: readonly MonthlyLedgerKind[] = [
  'REVENUE',
  'DIRECT_COST',
  'PAYROLL',
  'OPERATING_EXPENSE',
  'DEPRECIATION',
  'INTEREST',
  'TAX',
];
const MAX_VND = 9999999999999999n;

function parseVnd(raw: string): bigint {
  // PostgreSQL numeric may serialize whole VND as "123.00"; fractions remain invalid.
  if (typeof raw !== 'string' || !/^(0|[1-9]\d*)(?:\.0+)?$/.test(raw)) {
    throw new Error('MONTHLY_FINANCE_INVALID_VND');
  }
  const value = BigInt(raw.split('.')[0]);
  if (value > MAX_VND) throw new Error('MONTHLY_FINANCE_AMOUNT_OVERFLOW');
  return value;
}

function isValidDate(raw: string): boolean {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900
    && year <= 9999
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function marginPercent(netProfit: bigint, revenue: bigint): string | null {
  if (revenue === 0n) return null;

  // Integer division produces a display percentage with four fractional digits.
  const scaled = netProfit * 1_000_000n / revenue;
  const whole = scaled / 10_000n;
  const fraction = (scaled % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
  return fraction ? whole.toString() + '.' + fraction : whole.toString();
}

function emptyGroupCounts(): Record<MonthlyLedgerKind, number> {
  return {
    REVENUE: 0,
    DIRECT_COST: 0,
    PAYROLL: 0,
    OPERATING_EXPENSE: 0,
    DEPRECIATION: 0,
    INTEREST: 0,
    TAX: 0,
  };
}

function unavailableResult(
  month: string,
  reasons: string[],
  groupEntries: Record<MonthlyLedgerKind, number>,
): MonthlyResult {
  const expenseEntries = KINDS
    .filter((kind) => kind !== 'REVENUE')
    .reduce((count, kind) => count + groupEntries[kind], 0);

  return {
    month,
    state: 'CHUA_DU_DU_LIEU',
    reconciliationStatus: 'CHUA_DOI_SOAT',
    revenueVnd: null,
    directCostVnd: null,
    grossProfitVnd: null,
    payrollVnd: null,
    operatingExpenseVnd: null,
    ebitdaVnd: null,
    depreciationVnd: null,
    interestVnd: null,
    profitBeforeTaxVnd: null,
    taxVnd: null,
    netProfitVnd: null,
    netMarginPercent: null,
    expenseVnd: null,
    profitVnd: null,
    revenueEntries: groupEntries.REVENUE,
    expenseEntries,
    groupEntries,
    residentCount: null,
    bedOccupancyPercent: null,
    revenuePerResidentVnd: null,
    expensePerResidentVnd: null,
    breakEvenRevenueVnd: null,
    reasons,
  };
}

/**
 * Coverage and reconciliation flags must come from independent backend evidence.
 * A verified empty ledger may produce zero; missing evidence must produce NULL.
 */
export function calculateMonthlyOperatingResult(input: {
  month: string;
  entries: readonly MonthlyLedgerEntry[];
  ledgerCoverageComplete: boolean;
  reconciliationComplete: boolean;
}): MonthlyResult {
  const { month, entries, ledgerCoverageComplete, reconciliationComplete } = input;
  if (
    typeof month !== 'string'
    || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)
    || Number(month.slice(0, 4)) < 1900
  ) {
    throw new Error('MONTHLY_FINANCE_INVALID_MONTH');
  }
  if (!Array.isArray(entries)) throw new Error('MONTHLY_FINANCE_INVALID_ENTRIES');

  const totals: Record<MonthlyLedgerKind, bigint> = {
    REVENUE: 0n,
    DIRECT_COST: 0n,
    PAYROLL: 0n,
    OPERATING_EXPENSE: 0n,
    DEPRECIATION: 0n,
    INTEREST: 0n,
    TAX: 0n,
  };
  const groupEntries = emptyGroupCounts();
  const seenEntryIds = new Set<string>();
  const reasons: string[] = [];

  if (!ledgerCoverageComplete) reasons.push('LEDGER_COVERAGE_UNVERIFIED');
  if (!reconciliationComplete) reasons.push('SOURCE_RECONCILIATION_PENDING');

  for (const entry of entries) {
    if (
      !entry
      || typeof entry.entryId !== 'string'
      || !/^[A-Za-z0-9_-]{1,160}$/.test(entry.entryId)
      || seenEntryIds.has(entry.entryId)
    ) {
      throw new Error('MONTHLY_FINANCE_DUPLICATE_OR_INVALID_ENTRY');
    }
    seenEntryIds.add(entry.entryId);

    if (!KINDS.includes(entry.kind)) throw new Error('MONTHLY_FINANCE_UNKNOWN_LEDGER_KIND');
    const kind = entry.kind as MonthlyLedgerKind;
    if (!isValidDate(entry.recognitionDate)) {
      throw new Error('MONTHLY_FINANCE_INVALID_RECOGNITION_DATE');
    }

    const amount = parseVnd(entry.amountVnd);
    if (entry.recognitionDate.slice(0, 7) !== month) {
      throw new Error('MONTHLY_FINANCE_ENTRY_OUTSIDE_MONTH');
    }

    if (entry.posted !== true || entry.sourceVerified !== true) {
      if (!reasons.includes('UNVERIFIED_LEDGER_ENTRY')) {
        reasons.push('UNVERIFIED_LEDGER_ENTRY');
      }
      continue;
    }

    totals[kind] += amount;
    groupEntries[kind] += 1;
    if (totals[kind] > MAX_VND) throw new Error('MONTHLY_FINANCE_TOTAL_OVERFLOW');
  }

  if (reasons.length > 0) {
    return unavailableResult(month, reasons, groupEntries);
  }

  const revenue = totals.REVENUE;
  const directCosts = totals.DIRECT_COST;
  const payroll = totals.PAYROLL;
  const operatingExpenses = totals.OPERATING_EXPENSE;
  const depreciation = totals.DEPRECIATION;
  const interest = totals.INTEREST;
  const tax = totals.TAX;

  const grossProfit = revenue - directCosts;
  const ebitda = grossProfit - payroll - operatingExpenses;
  const profitBeforeTax = ebitda - depreciation - interest;
  const netProfit = profitBeforeTax - tax;
  const totalExpenses = directCosts + payroll + operatingExpenses + depreciation + interest + tax;
  const expenseEntries = KINDS
    .filter((kind) => kind !== 'REVENUE')
    .reduce((count, kind) => count + groupEntries[kind], 0);

  for (const total of [grossProfit, ebitda, profitBeforeTax, netProfit, totalExpenses]) {
    if (total > MAX_VND || total < -MAX_VND) {
      throw new Error('MONTHLY_FINANCE_TOTAL_OVERFLOW');
    }
  }

  return {
    month,
    state: 'READY',
    reconciliationStatus: 'DA_DOI_SOAT',
    revenueVnd: revenue.toString(),
    directCostVnd: directCosts.toString(),
    grossProfitVnd: grossProfit.toString(),
    payrollVnd: payroll.toString(),
    operatingExpenseVnd: operatingExpenses.toString(),
    ebitdaVnd: ebitda.toString(),
    depreciationVnd: depreciation.toString(),
    interestVnd: interest.toString(),
    profitBeforeTaxVnd: profitBeforeTax.toString(),
    taxVnd: tax.toString(),
    netProfitVnd: netProfit.toString(),
    netMarginPercent: marginPercent(netProfit, revenue),
    expenseVnd: totalExpenses.toString(),
    profitVnd: netProfit.toString(),
    revenueEntries: groupEntries.REVENUE,
    expenseEntries,
    groupEntries,
    residentCount: null,
    bedOccupancyPercent: null,
    revenuePerResidentVnd: null,
    expensePerResidentVnd: null,
    breakEvenRevenueVnd: null,
    reasons: [],
  };
}
