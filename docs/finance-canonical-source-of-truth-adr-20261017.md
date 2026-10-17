# Finance canonical source-of-truth decision — 2026-10-17

Status: **Target architecture selected; live Production Test source records remain unverified.**

This decision identifies which records may be authoritative for Finance. It does not assert that the candidate tables are already deployed, populated, approved for posting, or reconciled. It authorizes no migration, seed, or Production Test write.

## Decision

| Business fact | Canonical source | Eligibility and link to the ledger | Current evidence |
| --- | --- | --- | --- |
| Contract identity and signed terms | One server-side `service_contract_records` identity plus immutable `service_contract_versions`; exact signed artifact in `service_contract_signing_evidence`; independent approval in `service_contract_approval_decisions` | Key by `(contract_id, version)`. A version is usable only if its signed hash, effective date, approved hash, approver, resident/admission identity, care level and room/bed/pricing evidence agree. The schema must enforce the resident link to canonical `residents.resident_id` and matching admission. Select the approved version effective for the service period; never read browser storage or use the mutable current payload as billing authority. | These tables and guards exist in the Finance candidate migrations/code, but are absent from the Production Test catalog inventory. No live canonical contract backend was proven. |
| Approved service fees and accrued resident charges | `service_contract_approval_decisions.monthly_fee_vnd` is the approved base fee for the exact contract version. The finalized `billing_invoices` + `billing_invoice_items` are the authoritative monthly charge document, with each line retaining contract version, service period, charge basis and any independently approved adjustment evidence. | Only a finalized/issued, non-void invoice can support revenue. Reconcile invoice total to its lines and approved version. Link the ledger `REVENUE` posting to the invoice or stable invoice-line origin, with `recognition_date` in the verified service period. Receipts and allocations settle the receivable; they do not create revenue. VND amounts must be whole integer VND (`bigint` or `numeric(...,0)`); the current invoice draft's `numeric(18,2)` money columns must be corrected and migration-tested before use. | `billing_*` invoice/receipt tables are absent from the Production Test catalog. The current migration draft has basic invoice tables but does not yet carry all required line-level version/service/adjustment provenance or whole-VND precision. |
| Payroll expense | The approved payroll-period register from the authorized HR/payroll process, captured as an approved `finance_source_documents` record (`entry_type='PAYROLL'`, `source_domain='PAYROLL'`, `source_entity_type='PAYROLL_RUN'`, `source_entity_id=<stable run id>`), with source and approval evidence hashes. | Post one aggregated `PAYROLL` entry per payroll run and ledger category, linked to the restricted source document and keyed by stable source identity plus a globally unique `financial_origin_key`. Recognition date belongs to the payroll period; payment date is a separate cash event. Require preparer, independent reviewer and approver. Do not derive salary from `staff_actors`, shifts, attendance, or payments. | No payroll register/table or approved payroll source was established in the live catalog. `staff_actors` and shift records identify staff/work context only. The Finance candidate has a calculator and document-intake design, not a verified payroll feed or live approved records. |
| Direct cost | Approved supplier invoice or internal cost voucher, matched to receiving and the relevant inventory/kitchen issue or resident-consumption evidence; capture the validated amount, source document hash and approved cost allocation in an immutable approved Finance source document. | Use `DIRECT_COST` only where the evidence and approved costing policy support direct attribution. Give each economic origin one stable source key and one ledger posting; retain links to supplier document, receipt/movement and consumption evidence. Do not convert purchase/receipt, stock movement, or resident usage into money without verified unit cost, valuation method and allocation. | `kitchen_receiving_batch_items`, `inventory_transactions` and `resident_consumption_events` exist as operational context, but do not prove paid/approved value, costing method, allocation, or monthly completeness. No live approved direct-cost source was proven. |

## Ledger link contract

`public.finance_entries` is the existing reporting ledger and the only P&L total source; invoices, payroll documents and cost evidence are source documents, not parallel report totals. Each eligible posting must contain whole integer VND, `recognition_date`, `entry_type`, `status='POSTED'`, `source_mode`, `source_domain`, `source_entity_type`, `source_entity_id`, and `resident_id` when relevant. Keep an immutable source-link/audit record and a globally unique economic-origin key across SYSTEM and MANUAL entry paths. The current live partial unique index only protects SYSTEM entries with complete source keys, so it is not enough by itself to prevent cross-channel duplicates.

Use these posting families:

- Invoice or invoice line → `REVENUE`.
- Approved payroll run → `PAYROLL`.
- Approved, costed consumption or cost voucher → `DIRECT_COST`.
- Confirmed receipt/allocation → cash and receivable settlement only; never another `REVENUE`.
- Deposit → liability/deposit balance, not new revenue.
- Draft, void, unsigned, unapproved, unmatched or unreconciled source → no posting and no certified monthly profit.

The origin key must identify the economic obligation, not merely the file name. Revisions must preserve the original version and use a linked reversal/adjustment; never overwrite posted history. Month close must reconcile source documents, ledger postings, balances and audit events before returning a verified P&L.

## Evidence boundary and next implementation

The live metadata audit proves that `finance_entries`/`finance_entry_audit` and operational context tables exist; it does not prove actual contract, invoice, payroll or cost documents. Candidate Finance migrations are not installed on Production Test. Therefore this is the selected **target source-of-truth architecture**, not a claim that Production Test is ready to calculate or publish actual profit.

Before enabling any write or reporting actual profit:

1. Extend the isolated migration design so invoice lines preserve approved contract version, service period and adjustment origin; enforce resident/contract consistency and cross-channel origin uniqueness.
2. Identify the authorized payroll register and responsible approver; do not use attendance as a proxy.
3. Select and document the direct-cost valuation/allocation policy, then prove supplier → receipt → inventory/consumption → ledger reconciliation in isolated PostgreSQL 16.
4. Test the entire versioned migration chain and rollback/restore on an isolated schema matching the current Production Test metadata. No business rows are needed for schema compatibility checks; synthetic rows, if required, remain confined to a disposable CI database.
5. Obtain owner approval for Production Test migration/deployment only after a verified backup restore, runtime parity, signed-JWT authorization and reconciliation evidence pass.

Until these conditions hold: `FINANCE_REAL_SOURCE_RECONCILIATION=NOT_PROVEN`, `MONTHLY_PROFIT=CHUA_DU_DU_LIEU`, `FINANCE_DEPLOY_READINESS=NO_GO`.
