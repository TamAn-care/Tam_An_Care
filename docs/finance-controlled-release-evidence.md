# Finance controlled release evidence (NO DEPLOY)

Last reviewed: 2026-10-17 (Finance evidence checkpoint `e90ad4f2b4e57d375ee6e2076a3bd63c36f314a2`). This evidence separates isolated CI success from authorization to use real Finance data.

## Current source and CI

- Finance branch: `feature/finance-github-first-transition-20261012`.
- Finance implementation HEAD under review: `777a49500bd36f1be223339f286e4b9f6a906b2c` on `feature/finance-github-first-transition-20261012`; PR #5 remains open and Draft.
- Finance code HEAD `777a49500bd36f1be223339f286e4b9f6a906b2c` had qualification `39038139003` PASS (duplicate push run `39038135366` PASS), Finance Business Error `39038139076` PASS, and Contracts Server-Only `39038139027` PASS. The docs-only evidence checkpoint `e90ad4f2b4e57d375ee6e2076a3bd63c36f314a2` also passed qualification `39038569831`, Finance Business Error `39038569813`, and Contracts Server-Only `39038569793`. Qualification includes API/frontend builds, isolated PostgreSQL regression and migrations, and fail-closed readiness. Queued/in-progress results are not counted as PASS.
- PR #5 remains open and Draft; no merge or Production Test deployment was performed for Finance.
- Frontend production build: PASS.
- The latest change removes legacy in-memory invoice, receipt, fee notice and pricing fixtures. Legacy billing API operations fail closed until backed by a verified Finance API; Billing and Family Portal display an unavailable-source error instead of mock values or a false zero. The new regression is included in both qualification CI and the read-only reconciliation aggregator.
- CI ran PostgreSQL only in disposable isolated databases; the billing migration test checked schema and inserted no business rows.
- Local frontend change removed unverified contract fee, deposit, service, date, room, and identity defaults. Missing values stay unverified and are not treated as zero.
- The target source-of-truth architecture and ledger link contract are selected in [finance-canonical-source-of-truth-adr-20261017.md](finance-canonical-source-of-truth-adr-20261017.md). This resolves the target design question, not proof of live approved records.

## Production Test read-only evidence

- V69 confirmed the expected database identity and completed a metadata-only schema inventory under a read-only transaction.
- V70 confirmed the presence and selected column names of operational context tables for leave, inventory, kitchen receiving, consumption, staffing, and Finance ledger. It did not inspect business rows or amounts.
- The metadata-only inventory found `finance_entries` and `finance_entry_audit` as Finance-named tables. It did not find dedicated invoice, contract, receipt/payment, payroll, or expense ledgers. This does not establish that existing ledger rows contain complete, approved source evidence.
- A follow-up metadata-only inventory found candidate kitchen receiving line fields (`unit_price`, `total_price`, `inventory_lot_id`, receiving status) and inventory consumption/lot links. This is not proof of approved supplier cost, final valuation/allocation policy, or complete transaction provenance; source rows were not inspected. The runtime code also has a resident cost snapshot path that does not match the candidate receiving-lot path, and the corresponding resident-cost table was not found in the live schema inventory. The authoritative direct-cost method therefore remains unresolved.
- No payroll register/source or authorized payroll approver has been proven in repository/runtime/schema evidence. Monthly net profit must remain fail-closed until payroll and direct-cost sources and approval rules are verified.
- A fresh read-only check on 2026-10-17 confirmed the running API image still lacks compiled `/app/dist/finance-billing/monthly-operating-result.service.js`, `/app/dist/finance-billing/monthly-operating-result.js`, and `/app/dist/finance-billing/finance-read.controller.js`. Production Test runtime parity is therefore FAIL for the current Finance P&L implementation.
- The server source worktree was observed to have tracked changes. No server source or container was modified by this audit.
- Neither audit read business rows, changed schema, wrote data, restarted services, or touched Docker volumes.

## Release blockers

1. Prove that live approved contracts, invoices/fees, leave adjustments, inventory costing, payroll, vouchers, and operating expenses map to the selected architecture. The V70 table/column map is a candidate inventory only; approved monthly rows and origin reconciliation remain `NOT_PROVEN`.
2. Reconcile recognized ledger amounts and source origins for a complete month. Do not publish net profit while any required source is unverified.
3. Implement and validate the selected canonical contract backend and contract-version/approval mapping. Do not create a second contract master or infer fees from mutable UI values.
4. Verify schema compatibility and the required migration chain against the live schema on an isolated PostgreSQL copy. No migration has been applied to Production Test.
5. Build and validate a controlled runtime candidate, including production-equivalent signed JWT/session checks and read/write authorization boundaries. The current running API image is missing Finance P&L modules.
6. Verify a current Production Test backup restore and rollback candidate for the exact application/schema release. The disposable PostgreSQL 16 CI test restores the pre-migration schema/data snapshot, compares normalized dumps byte-for-byte, and prepares a rollback candidate from that baseline. This does not prove a current Production Test backup is restorable.
7. Obtain the system owner's approval for any Production Test migration or deployment.

## Isolated migration chain

The canonical Finance schema migrations are present on the Finance branch and are exercised in a disposable PostgreSQL 16 database in GitHub Actions. The test verifies expected schema objects and empty business tables; it does not seed demo data. This does not prove live-schema compatibility or authorize applying those migrations to Production Test.

## Release decision

`FINANCE_DEPLOY_READINESS=NO_GO`

`PRODUCTION_TEST_DEPLOY=NO`

`PRODUCTION_MIGRATION=NO`

`PRODUCTION_SEED=NO`

Latest static release gate: `FINANCE_DEPLOY_READINESS=NO_GO`. Ledger amount/source reconciliation, Production billing migration presence, approved contract mapping, runtime schema approval, and Production-equivalent HTTP/JWT E2E remain blocked. The current readiness script reports amount/source reconciliation, Production billing migration presence, approved contract mapping, runtime schema approval, and production-equivalent HTTP/JWT E2E as BLOCKED; current HEAD reports `FINANCE_DEPLOY_READINESS=NO_GO`. The isolated CI pass and disposable restore test do not discharge these live-system gates.

CI PASS is necessary but not sufficient for release. No Release Candidate may be declared ready until each blocker above has evidence and the system owner approves the controlled deployment step.
