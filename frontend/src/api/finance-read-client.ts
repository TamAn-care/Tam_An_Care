
/**
 * Tâm An Care — Finance Read API client.
 *
 * Development-only integration foundation.
 * - Uses the existing authenticated apiRequest transport.
 * - Never creates invoices, receipts, or demo records.
 * - Never coerces incomplete Finance rows into legacy Billing DTOs.
 * - The backend Controller must be separately approved before activation.
 */
import { apiRequest, type RequestOptions } from './client';
import {
  normalizeFinanceMonth,
  parseFinanceInvoices,
  parseFinanceReceipts,
  type FinanceInvoice,
  type FinanceReceipt,
} from './finance-read-model';

const BASE = '/api/finance-read';

function validId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
    throw new Error('FINANCE_INVALID_INVOICE_ID');
  }
  return value;
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' ||
      Array.isArray(value)) {
    throw new Error('FINANCE_INVALID_RESPONSE_OBJECT');
  }
  return value as Record<string, unknown>;
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('FINANCE_REQUIRED_FIELD_INVALID:' + field);
  }
  return value;
}

function vnd(value: unknown, field: string): string {
  const text = required(value, field);
  if (!/^(0|[1-9]\d*)$/.test(text)) {
    throw new Error('FINANCE_INVALID_VND_AMOUNT:' + field);
  }
  return text;
}

export interface FinanceInvoiceItem {
  itemId: string;
  invoiceId: string;
  description: string;
  quantity: string;
  unitPriceVnd: string;
  lineTotalVnd: string;
}

export interface FinanceInvoiceDetail {
  invoice: FinanceInvoice;
  items: FinanceInvoiceItem[];
}

function parseItem(value: unknown): FinanceInvoiceItem {
  const row = object(value);
  const quantity = required(row.quantity, 'quantity');
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(quantity)) {
    throw new Error('FINANCE_INVALID_QUANTITY');
  }
  return {
    itemId: required(row.item_id, 'item_id'),
    invoiceId: required(row.invoice_id, 'invoice_id'),
    description: required(row.description, 'description'),
    quantity,
    unitPriceVnd: vnd(row.unit_price_vnd, 'unit_price_vnd'),
    lineTotalVnd: vnd(row.line_total_vnd, 'line_total_vnd'),
  };
}

export async function readFinanceInvoicesByMonth(
  month: string,
  options: RequestOptions,
): Promise<FinanceInvoice[]> {
  const normalized = normalizeFinanceMonth(month);
  const payload = await apiRequest<unknown>(
    `${BASE}/invoices/month/${normalized}`, options
  );
  return parseFinanceInvoices(payload);
}

export async function readFinanceInvoiceDetail(
  invoiceId: string,
  options: RequestOptions,
): Promise<FinanceInvoiceDetail> {
  const id = validId(invoiceId);
  const payload = object(await apiRequest<unknown>(
    `${BASE}/invoices/${encodeURIComponent(id)}`, options
  ));
  if (payload.source !== 'POSTGRESQL' ||
      !Array.isArray(payload.items)) {
    throw new Error('FINANCE_UNVERIFIED_DATA_SOURCE');
  }
  const invoice = parseFinanceInvoices({
    source: 'POSTGRESQL', items: [payload.invoice]
  })[0];
  if (invoice.invoiceId !== id) {
    throw new Error('FINANCE_INVOICE_ID_MISMATCH');
  }
  const items = payload.items.map(parseItem);
  if (items.some(item => item.invoiceId !== id)) {
    throw new Error('FINANCE_ITEM_INVOICE_MISMATCH');
  }
  return { invoice, items };
}

export async function readFinanceLatestReceipts(
  options: RequestOptions,
): Promise<FinanceReceipt[]> {
  const payload = await apiRequest<unknown>(
    `${BASE}/receipts`, options
  );
  return parseFinanceReceipts(payload);
}

export async function readFinanceReceiptsForInvoice(
  invoiceId: string,
  options: RequestOptions,
): Promise<FinanceReceipt[]> {
  const id = validId(invoiceId);
  const payload = await apiRequest<unknown>(
    `${BASE}/receipts/invoice/${encodeURIComponent(id)}`, options
  );
  return parseFinanceReceipts(payload);
}
