import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  calculateMonthlyOperatingResult,
  type MonthlyLedgerEntry,
  type MonthlyResult,
} from './monthly-operating-result';

const REQUIRED_LEDGER_COLUMNS = [
  'finance_entry_id',
  'entry_type',
  'recognition_date',
  'amount_vnd',
  'posting_status',
  'reconciliation_status',
] as const;

// A real month-close attestation and reconciliation proof must be independently
// implemented/verified before any monetary result may be called READY.
const MONTH_CLOSE_ATTESTATION_VERIFIED = false;

export type MonthlyOperatingResultRead = MonthlyResult & {
  source: 'POSTGRESQL';
  ledgerSchemaReady: boolean;
  missingColumns: string[];
};

/**
 * READ-ONLY canonical finance_entries adapter.
 *
 * This service never derives revenue from invoices, receipts or allocations.
 * It does not mutate schema/data and does not auto-seed any business row.
 *
 * Until Production Test metadata proves the canonical ledger has the explicit
 * fields below, the result fails closed as CHUA_DU_DU_LIEU.
 */
@Injectable()
export class MonthlyOperatingResultService {
  constructor(private readonly db: DatabaseService) {}

  private validateMonth(month: string): void {
    if (
      typeof month !== 'string' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      Number(month.slice(0, 4)) < 1900
    ) {
      throw new Error('MONTHLY_FINANCE_INVALID_MONTH');
    }
  }

  async read(month: string): Promise<MonthlyOperatingResultRead> {
    this.validateMonth(month);

    const metadata = await this.db.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='finance_entries'
          AND column_name = ANY($1::text[])
        ORDER BY column_name`,
      [[...REQUIRED_LEDGER_COLUMNS]],
    );

    const present = new Set(metadata.rows.map((row) => row.column_name));
    const missingColumns = REQUIRED_LEDGER_COLUMNS.filter(
      (column) => !present.has(column),
    );

    if (missingColumns.length > 0) {
      const result = calculateMonthlyOperatingResult({
        month,
        entries: [],
        ledgerCoverageComplete: false,
        reconciliationComplete: false,
      });
      return {
        source: 'POSTGRESQL',
        ledgerSchemaReady: false,
        missingColumns: [...missingColumns],
        ...result,
      };
    }

    const start = month + '-01';
    const rows = await this.db.query<{
      finance_entry_id: string;
      entry_type: string;
      recognition_date: string;
      amount_vnd: string;
      posting_status: string;
      reconciliation_status: string;
    }>(
      `SELECT finance_entry_id,
              entry_type,
              recognition_date::text AS recognition_date,
              amount_vnd::text AS amount_vnd,
              posting_status,
              reconciliation_status
         FROM public.finance_entries
        WHERE recognition_date >= $1::date
          AND recognition_date < ($1::date + INTERVAL '1 month')
        ORDER BY recognition_date, finance_entry_id
        LIMIT 10000`,
      [start],
    );

    const entries: MonthlyLedgerEntry[] = rows.rows.map((row) => ({
      entryId: row.finance_entry_id,
      kind:
        row.entry_type === 'REVENUE'
          ? 'REVENUE'
          : row.entry_type === 'EXPENSE'
            ? 'EXPENSE'
            : (row.entry_type as MonthlyLedgerEntry['kind']),
      recognitionDate: row.recognition_date,
      amountVnd: row.amount_vnd,
      posted: row.posting_status === 'POSTED',
      sourceVerified: row.reconciliation_status === 'VERIFIED',
    }));

    const rowsBounded = rows.rows.length < 10000;
    const reconciliationComplete = rows.rows.every(
      (row) =>
        row.reconciliation_status === 'VERIFIED' &&
        row.posting_status === 'POSTED',
    );

    const result = calculateMonthlyOperatingResult({
      month,
      entries,
      ledgerCoverageComplete: rowsBounded && rows.rows.length > 0 && MONTH_CLOSE_ATTESTATION_VERIFIED,
      reconciliationComplete: reconciliationComplete && MONTH_CLOSE_ATTESTATION_VERIFIED,
    });

    return {
      source: 'POSTGRESQL',
      ledgerSchemaReady: true,
      missingColumns: [],
      ...result,
    };
  }
}
