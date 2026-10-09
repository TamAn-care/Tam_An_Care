# Finance × Production Test: verified schema baseline (2026-10-09)

Source: user-supplied, completed READ-ONLY PostgreSQL metadata audit on ag@192.168.1.32. The report contains **schema metadata only**, no business rows. This document deliberately excludes connection credentials, resident names and account data.

## VERIFIED (actual Production Test)
- PostgreSQL 16.15.
- `public.residents(resident_id)` exists and is the authoritative resident identity key.
- `public.admission_cases(resident_id)` references `residents(resident_id)`.
- `public.finance_entries` exists with `finance_entry_id, entry_type, category, description, amount_vnd, recognition_date, cash_date, resident_id, source_mode, source_domain, source_entity_type, source_entity_id, status, reference_number, note, created_by, created_by_role, created_at, updated_at`.
- `public.finance_entry_audit(finance_entry_id)` references `finance_entries(finance_entry_id)`.
- Partial unique index `uq_finance_entries_system_source` guards `(source_domain, source_entity_type, source_entity_id, entry_type)` only when `source_mode='SYSTEM'` and all source keys are non-null.
- None of `service_contract_records`, `billing_invoices`, `billing_invoice_items`, `billing_receipts`, `billing_payment_allocations`, `finance_source_links`, `finance_operation_idempotency`, `finance_operation_audit` were present in the filtered live table list.

## DESIGN CONSEQUENCES
1. Never infer the Finance migrations are installed because GitHub CI passed. Production Test currently lacks the required billing tables.
2. Treat `residents.resident_id` and admissions' `resident_id` as canonical resident identity; forbid creation of a separate resident catalogue.
3. `finance_entries` is the existing ledger. A new invoice must never create revenue unless the document is validated against the canonical contract, actual billing source, existing manual/system entries and uniqueness policy.
4. Receipts and allocations settle receivables: they must **not** create a second `REVENUE` entry.
5. `finance_source_links` is absent: the current read-only link endpoint cannot work against this runtime without approved migration; it is not proof of monetary reconciliation.
6. The existing frontend contract module exposes localStorage fallback and API calls. Canonical **server-persisted** contract source is not yet verified; never seed, copy or auto-sync these into a second contracts table.
7. Production write gate remains off (`TAMANCARE_FINANCE_WRITE_ENABLED` unset/false). New APIs must not be enabled until the contract and ledger mapping, migration planning, backup/restore, auth and operational acceptance are approved.

## Remaining checks
- READ-ONLY inspect metadata of `/api/service-contracts` backend's actual persistence and deployment runtime. Do not assume frontend localStorage equals PostgreSQL canonical storage.
- Document approved contract identifiers/version/status mapping to billing invoices and room, care level, signed fees and leave deductions.
- Verify finance_entries CHECK constraints' accepted enum values and ledger recognition rules using metadata (not real rows).
- Build isolated migration replay and exact source checksum artifact; separately assess backup/restore and forward-only rollback procedures.
- Stage equivalent integrated tests with synthetic rows **only in disposable CI PostgreSQL**. No fake or demo records on Production Test.

VERDICT=NO_GO; PRODUCTION_DEPLOY=NO; PROD_MIGRATION=NO; PROD_SEED=NO.