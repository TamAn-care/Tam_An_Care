
/**
 * Tâm An Care Finance — PostgreSQL read models.
 * No mocks, no browser storage, no network, no writes.
 * Do not coerce incomplete database rows into legacy Billing DTOs.
 */

export interface FinanceInvoice {
  invoiceId: string;
  invoiceCode: string;
  residentId: string;
  contractId: string | null;
  billingMonth: string; // yyyy-mm
  status: 'DRAFT' | 'APPROVED' | 'ISSUED' |
          'PARTIAL' | 'PAID' | 'VOID';
  totalAmountVnd: string;
  allocatedAmountVnd: string;
  balanceVnd: string;
}

export interface FinanceReceipt {
  receiptId: string;
  receiptCode: string;
  residentId: string;
  amountVnd: string;
  receivedDate: string; // yyyy-mm-dd
  status: 'DRAFT' | 'CONFIRMED' | 'VOID';
  externalReference: string | null;
  createdAt: string;
  amountAllocatedToInvoiceVnd?: string;
}

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  if (value === null || typeof value !== 'object' ||
      Array.isArray(value)) {
    throw new Error('FINANCE_INVALID_RESPONSE_OBJECT');
  }
  return value as RecordValue;
}

function requiredString(
  row: RecordValue, key: string
): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('FINANCE_REQUIRED_FIELD_INVALID:' + key);
  }
  return value;
}

function optionalString(
  row: RecordValue, key: string
): string | null {
  const value = row[key];
  if (value === null) return null;
  return requiredString(row, key);
}

function amount(row: RecordValue, key: string): string {
  const value = requiredString(row, key);
  // PostgreSQL numeric(18,2)::text returns values such as "100.00".
  // Preserve integer VND precision; never silently round fractions.
  if (!/^(0|[1-9]\d*)(?:\.0{1,2})?$/.test(value)) {
    throw new Error('FINANCE_INVALID_VND_AMOUNT:' + key);
  }
  return value.split('.')[0];
}

function dateParts(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!match) throw new Error('FINANCE_INVALID_ISO_DATE');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 9999 ||
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() + 1 !== month ||
      d.getUTCDate() !== day) {
    throw new Error('FINANCE_INVALID_CALENDAR_DATE');
  }
  return [year, month, day];
}

export function formatFinanceDate(
  value: string
): string {
  const [year, month, day] = dateParts(value);
  return `${String(day).padStart(2, '0')}/` +
    `${String(month).padStart(2, '0')}/${year}`;
}

export function normalizeFinanceMonth(
  value: string
): string {
  // Accept month displayed as mm/yyyy or API value yyyy-mm.
  const display = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value);
  const normalized = display
    ? `${display[2]}-${display[1]}`
    : value;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    throw new Error('FINANCE_INVALID_MONTH');
  }
  return normalized;
}

export function formatFinanceMonth(
  value: string
): string {
  const isoMonth = normalizeFinanceMonth(value);
  return `${isoMonth.slice(5, 7)}/${isoMonth.slice(0, 4)}`;
}

function postgresMonth(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('FINANCE_INVALID_DATABASE_MONTH');
  }
  const [year, month, day] = dateParts(value);
  if (day !== 1) {
    throw new Error('FINANCE_BILLING_MONTH_NOT_FIRST_DAY');
  }
  return normalizeFinanceMonth(
    `${year}-${String(month).padStart(2, '0')}`
  );
}

function status<T extends string>(
  value: unknown, values: readonly T[]
): T {
  if (typeof value !== 'string' ||
      !values.includes(value as T)) {
    throw new Error('FINANCE_INVALID_STATUS');
  }
  return value as T;
}

function rows(payload: unknown): RecordValue[] {
  const envelope = record(payload);
  if (envelope.source !== 'POSTGRESQL' ||
      !Array.isArray(envelope.items)) {
    throw new Error('FINANCE_UNVERIFIED_DATA_SOURCE');
  }
  return envelope.items.map(record);
}

function invoice(row: RecordValue): FinanceInvoice {
  const total = amount(row, 'total_amount_vnd');
  const allocated = amount(row, 'allocated_amount_vnd');
  const balance = amount(row, 'balance_vnd');
  if (BigInt(total) - BigInt(allocated) !== BigInt(balance)) {
    throw new Error('FINANCE_INVOICE_BALANCE_MISMATCH');
  }
  return {
    invoiceId: requiredString(row, 'invoice_id'),
    invoiceCode: requiredString(row, 'invoice_code'),
    residentId: requiredString(row, 'resident_id'),
    contractId: optionalString(row, 'contract_id'),
    billingMonth: postgresMonth(row.billing_month),
    status: status(row.status, [
      'DRAFT', 'APPROVED', 'ISSUED',
      'PARTIAL', 'PAID', 'VOID'
    ] as const),
    totalAmountVnd: total,
    allocatedAmountVnd: allocated,
    balanceVnd: balance,
  };
}

export function parseFinanceInvoices(
  payload: unknown
): FinanceInvoice[] {
  return rows(payload).map(invoice);
}

function receipt(row: RecordValue): FinanceReceipt {
  const date = requiredString(row, 'received_date');
  dateParts(date);
  const createdAt = requiredString(row, 'created_at');
  dateParts(createdAt);
  const allocated = row.amount_allocated_to_invoice_vnd;
  return {
    receiptId: requiredString(row, 'receipt_id'),
    receiptCode: requiredString(row, 'receipt_code'),
    residentId: requiredString(row, 'resident_id'),
    amountVnd: amount(row, 'amount_vnd'),
    receivedDate: date.slice(0, 10),
    status: status(row.status, [
      'DRAFT', 'CONFIRMED', 'VOID'
    ] as const),
    externalReference: optionalString(
      row, 'external_reference'
    ),
    createdAt,
    ...(allocated === undefined ? {} : {
      amountAllocatedToInvoiceVnd:
        amount(row, 'amount_allocated_to_invoice_vnd')
    }),
  };
}

export function parseFinanceReceipts(
  payload: unknown
): FinanceReceipt[] {
  return rows(payload).map(receipt);
}
