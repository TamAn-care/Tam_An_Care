# Tâm An Care Finance V2.9.74.8 — SQL design review and isolated acceptance plan

> **DESIGN ONLY. DO NOT APPLY SQL TO PRODUCTION TEST.** No resident/finance data is contained here. No deployment, seed or migration approved.

## Verified checkpoints

- Production Test metadata audit: existing `public.finance_entries`, `public.finance_entry_audit`; none of `billing_invoices`, `billing_invoice_items`, `billing_receipts`, `billing_payment_allocations` found in public schema.
- GitHub Finance V2.9.74 isolated controller preflight has a successful run. This is **not** HTTP/JWT E2E.
- Four server-side SQL source files were hash-verified, **not executed**:
  - `ops/finance/v22/001_finance_foundation.sql`: 6 tables, incl. `service_contract_records`, invoices, items, receipts, allocations, `finance_source_links`.
  - `ops/finance/v28/002_finance_transaction_safety.sql`: operation idempotency and audit tables.
  - `ops/finance/v29/003_finance_allocation_invariants.sql`: allocation validation and document protection triggers.
  - `ops/finance/v29/004_finance_integrity_hardening.sql`: allocation immutability and linked-document status triggers.
- These SQL files currently remain on the server worktree and were **not** pushed to this public repo; this is a review of user-provided verified report, not a GitHub migration application.

## Existing accounting uniqueness

Index `uq_finance_entries_system_source` is unique on
`(source_domain, source_entity_type, source_entity_id, entry_type)`
**only when** `source_mode='SYSTEM'` and all three source fields are non-NULL.

Thus the index does not protect `MANUAL` records, missing source identifiers or two distinct upstream sources representing the same real-world revenue. `finance_source_links` additionally has a unique `finance_entry_id` but the reviewed DDL has no FK referencing `finance_entries`.

## Required business invariants before any migration

1. One revenue recognition per canonical economic event, with an explicit deterministic source key and clear distinction between invoice accrual and receipt settlement. **A receipt must not create revenue twice.**
2. `finance_entries` remains the financial reporting ledger; `billing_*` is billing and settlement detail, not a second independent reporting total.
3. Prove idempotent retry and reconciliation, including SYSTEM/MANUAL collisions and legacy duplicates; never automatically rewrite existing entries.
4. Ensure invoice total matches lines, and allocations cannot exceed confirmed receipt balance or issued invoice outstanding balance. Tests must cover cross-resident links and rounding.
5. Determine contract source of truth; do not duplicate the currently deployed service-contract workflow without a documented mapping.
6. Define correction/void/refund/reversal workflow under immutable allocations. No direct delete or destructive history updates.
7. Verify trigger lock order and behavior under parallel allocation attempts, invoice/receipt status changes and aborts.
8. Add auditable link integrity for `finance_source_links`, including FK/uniqueness/status semantics after isolated verification and approval.

## Proposed isolated PostgreSQL CI suite (NOT YET IMPLEMENTED)

- GitHub Actions ubuntu-24.04, Node 24, ephemeral PostgreSQL service `postgres:16` or project-compatible version (confirm server major version before choosing).
- Use a new ephemeral **CI-only database**; apply ordered SQL to that database *only* after validating SQL syntax and dependencies.
- Insert minimal synthetic CI-only test rows **only into that ephemeral database**, never Production Test; drop with runner on completion; no real resident records in CI/artifacts.
- Test: DDL idempotence, FK constraints, correct totals, allocation overage, duplicate/retry, concurrency, status transitions, mutation immutability, rollback, Finance Read HTTP JWT/RBAC negative cases, and compatibility with existing finance ledger structure.
- Never set up CI network access to Production Test, 192.168.1.32, live Postgres or private credentials.

## Stop gates

**BLOCKED:** schema compatibility, canonical contract mapping, double revenue prevention design, business authorization contract, and full HTTP JWT E2E. A green frontend/API build does not supersede these gates.

**Next action:** implement an isolated PostgreSQL CI lab on the Finance branch only, after confirming source SQL dependencies and selecting appropriate PostgreSQL major version. Runtime alignment still requires a separately approved READ-ONLY metadata-only check.

## Safety

Production Test migration **NO**; seed/demo on Production Test **NO**; database reset **NO**; PostgreSQL restart/volume change **NO**; deploy **NO**; merge **NO**.
