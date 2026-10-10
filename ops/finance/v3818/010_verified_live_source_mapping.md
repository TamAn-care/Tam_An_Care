# Tâm An Care Finance V3.8.18.10 — verified real-source adapter mapping

**Status:** source schema contract implemented and CI test committed. No live database inspection executed by this change, and no actual adapter is yet wired to Production Test.

## Previously observed Production Test facts (read-only V3.8.17 evidence)
- `public.finance_entries` and `public.finance_entry_audit` existed, both with **zero** rows at the earlier audit.
- `public.admission_cases` had 1 row, but an admission case does **not** establish recognized revenue.
- `public.kitchen_receiving_batch_items`, `public.kitchen_receiving_batches`, `public.inventory_transactions`, `public.resident_consumption_events`, and `public.resident_leave_requests` had zero rows at the audit.
- No canonical persisted billing invoice, payment allocation or approved payroll source was established in the previously inspected `public` schema. Other schemas/services must be separately verified, rather than assumed absent globally.
- Current Production Test API/frontend images have not been proven to correspond to the GitHub Finance source.

## Required source contracts before real integration
| Module | Authoritative source must demonstrate | Recognition rule |
|---|---|---|
| Contract and admission | Approved contract version, resident link, effectivity, amendment and admission dates | Basis for accrual; not direct posting |
| Monthly billing | Approved immutable fee statement/invoice, invoice lines and serviced month, adjustment lineage | Revenue accrual candidate once per origin |
| Receipts and allocations | Approved bank/cash receipt, receivable allocation, reversal/refund events | Settlement, never additional revenue |
| Kitchen | Approved receiving evidence, unit costs and matched vendor bill | Stock receipt is not automatically P&L expense |
| Inventory | Inventory movement references, valuation and consumption evidence | Financial cost only through approved cost policy/document |
| Payroll | Approved payroll period, staff roster/attendance reconciliation and salary payable | Payroll expense candidate |
| Operating expenses | Approved supplier invoice or recurring cost document and effective period | Expense candidate |
| Tax, depreciation, interest | Approved period schedule and classification | Separate ledger categories |

## Hard acceptance gates
1. Collect metadata (schema, table, columns, primary keys, relationships, approval/status values) via **read-only** connection to Production Test's actual isolated PostgreSQL instance; redact sensitive data.
2. Verify physical source provenance, lifecycle and approved state: column presence alone is insufficient.
3. Bind each adapter to a single authoritative source with immutable source ID/version and documented financial origin key.
4. Respect `assessCatalogSource` strict rejection of missing/ambiguous PK, version/approval/date fields; no guessed mapping, no mocked records.
5. Create isolated integration tests against schema snapshots, followed by actual read-only tests with genuine permitted records and negative RBAC checks.
6. Deploy only after isolated backup/restore and image/source baseline reconciliation; finance writes remain DISABLED.

**Result: NO_GO until independently verified live source maps and safe restore evidence exist.**
