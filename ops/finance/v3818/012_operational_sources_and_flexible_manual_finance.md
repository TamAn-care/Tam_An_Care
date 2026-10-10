# Finance V3.8.18.12 — Real operational sources & flexible manual finance

## Business policy

Payroll supports **agreed negotiated amount**, approved timesheet-based computation, or other manually approved calculation. Attendance/shift assignment is **not** the mandatory payroll formula. Employee identity may be linked to `staff_actors.actor_id`, but payroll amounts require a separate approved payroll document and controls.

Income and costs without supplier tax invoices may be entered through **internal vouchers** supported by a business description, recognition date, counterparty reference, cost/revenue classification, monetary amount, evidence/approval digests, and independent preparer/reviewer/approver. A no-invoice entry is not automatically invalid; its accounting/tax treatment must be classified separately and reviewed. Internal vouchers must NOT be represented as VAT invoices; no automatic deductible VAT or tax expense eligibility is assumed. Cash settlement must be separated from accrual recognition. No direct revenue from receipt alone, and no automatic conversion of stock receiving/movements or shift assignments into P&L.

Manual document fields: entryId, version, financialOriginKey, kind, amountVnd, recognitionDate, category, description, counterpartyRef, payBasis, evidenceType, evidenceDigest, approvalDigest, preparedBy, reviewedBy, approvedBy, approved, verifiedEvidence, reconciled, monthOpen. The V3.8.18.12 evaluator returns *eligible for future posting review* but ALWAYS `postingEnabled=false`.

**Future UI desired:** Create/Edit Draft → Submit → Independent Review → Director/authorized Approval → (separate and controlled) Post; Reject / Return / Audit; attachments optional in kind but evidence trace required even without invoice. Approved document amendments must generate a new version and adjustment/reversal, not overwrite immutable posted records. Dashboard distinguishes recognized revenue/expenses, collections/disbursements, receivables/payables, and tax-invoice eligibility.

## Actual Production Test public schema confirmed 2026-10-10 (V3.8.18.11)

The following are **read-only contextual source mappings**, not direct sources for posting: `admission_cases`, `admission_care_classifications`, `resident_leave_requests`, `kitchen_receiving_batches`, `kitchen_receiving_batch_items`, `inventory_transactions`, `resident_consumption_events`, `staff_actors`. The existing `finance_entries` is a ledger destination, not an independent source for generating revenue.

Canonical approved invoices, payroll source documents, operating-expense vouchers and settlement allocations were **not established** in the inspected PostgreSQL catalog. Confirm whether source data live outside this database or in other app services before adding any schema or source adapter. The backend integration, durable database persistence for manual records, operator UI, and server-side sync are **not implemented** in this version.

### Security and delivery gate
- Development branch only; no Production Test runtime code changes
- No database writes/migrations/seeding/demo/fixtures on Production Test
- RBAC and source provenance verification required in the future actual endpoint
- Persisted source revision, one-origin-one-posting idempotency and atomic cursor/audit transaction required before enabling
- Verified source/image parity, isolated restore proof, rollback and acceptance required before deployment
- Until then, `PRODUCTION_GO_NO_GO=NO_GO`
