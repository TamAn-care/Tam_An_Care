# Finance Business Rules & Mapping V1.0 — release assessment

## Source binding

- Repository: `TamAn-care/Tam_An_Care`
- Branch: `feature/finance-github-first-transition-20261012`
- Starting commit: `c4b9f8513193c50ed27cdf48bd5d839ee62b79ed`
- PR #5: open, Draft, unmerged; head matched the starting commit at inspection.
- Actions on the starting commit: Finance GitHub-first qualification, Finance Contracts Server-Only CI and Finance Business Error Regression all succeeded. These are historical evidence for `c4b9f85`, not evidence for the new commit.

## V1 work in this change

- Adds an additive Finance V3.2 migration for discount policies, resident/contract assignments, invoice discount applications, absence evidence and immutable discount audit.
- Constraints require approved policy terms, separation between proposer and approver, versioned decisions, valid date windows, source/resident consistency, unique application source keys, whole nonnegative VND, nonstacking fee-line applications, a separate negative invoice discount line, and immutable approved invoice evidence.
- `PERCENT` values are constrained to 0–100. Fixed discounts support `MONTHLY_PRORATED` and `ONE_TIME`. Database trigger calculations use PostgreSQL numeric `round` (half up) and cap discounts at eligible fee amount.
- TypeScript calculation uses `BigInt` and deterministic half-up rounding. It clips policy windows to the billing period and fee segments; excludes deposits, third-party charges, medicine and other noneligible items.
- Meal-deduction qualification uses the Asia/Ho_Chi_Minh start-of-absence boundary, requires family confirmation and explicit follow-up dates; late notices retain the first day. This records evidence only and does not invent meal prices. Room and care fees are not reduced for absences.
- Existing billing API continues to fail closed. No real invoices, contract terms, absence evidence, discount assignments, receipt or ledger entries are generated from client input.

## Verified locally

- API TypeScript/Nest build: PASS.
- Discount/absence arithmetic tests: PASS.
- PostgreSQL 16 Finance migrations on empty schema: PASS.
- PostgreSQL 16 Finance migrations on the isolated compatibility schema: PASS.
- Isolated pre-migration backup/restore schema and data comparison: PASS.
- Negative constraints for invalid percent, invalid policy transitions, immutable audit, nonstacking discounts, unconfirmed absence and immutable absence evidence: PASS.
- Frontend TypeScript/Vite production build: PASS (Vite reports an existing large main chunk warning).
- No browser runtime is available in this session; browser acceptance: NOT RUN.

## Release gates still closed

- Discount proposal/approval/assignment endpoints and frontend date-scoped discount form are not connected. The calculation and schema are implemented, but end-user discount workflows are not yet integrated.
- Canonical contract prices, room/care timeline and absence meal-price sources are not proven against current live schema. No real monthly invoice generation is enabled.
- Finance permission allowlists for discount propose/approve/apply are not approved/configured; no permission has been granted by this change.
- Existing ledger/P&L remains source-evidence gated. Real verified revenue and cost source mapping, independent month-close attestation, signed snapshot and period lock remain required for `READY`.
- Browser acceptance could not run because no browser is exposed. There is no current end-to-end discount workflow to accept.
- Source/runtime parity with Production Test, live image/schema binding, integrated CI for the new SHA, and release approval remain unverified.

## Migration and release safety

The migration was tested only in disposable PostgreSQL 16 databases. Do not apply it to Production Test as part of this change. There is no destructive down migration because that could remove audit evidence; before live write enablement, rollback is restoration of the exact pre-migration backup in an isolated environment. Any later live business records require a separately reviewed forward correction plan.

`FINANCE_RELEASE_READY=NO`. PR #5 remains unmerged and Production Test deployment/migration is `NO`.

## V1.1 service price catalog continuation (2026-10-18)

- Added `ops/finance/v32/009_service_price_catalog.sql`, additive versioned price catalog tables, VND/date/item constraints, approval overlap checks, immutable approved terms and audit records.
- Added `ServicePricingController` with list/draft/edit/copy-version/submit/approve/reject endpoints. JWT identity, active session and active staff are checked; permission-specific role allowlists default to empty and therefore deny. No RBAC grants or production config were changed.
- Added the service price catalog panel to the existing Finance pricing tab. It uses server data and displays an explicit unavailable/denied state instead of displaying legacy pricing as official.
- The PG16 empty-schema and compatibility-schema migration suite passed on an ephemeral container. Synthetic tests exercised approval, overlap, negative-amount and immutable-approved-version constraints; no business rows were retained.
- API build and frontend production build passed. After commit `cb65da83375f8d30bd876e4d5a3dc1dc949f508b` was pushed, GitHub Actions Finance qualification run 100, Contracts Server-Only CI run 23 and Business Error Regression run 26 all completed successfully on that SHA. The qualification job includes API/frontend builds, isolated PostgreSQL migration chain, P&L HTTP/JWT/PostgreSQL E2E and Finance security/source gates.
- Browser acceptance has not run: this session has no browser surface, and no end-to-end test account/runtime is configured. Do not report browser PASS.
- Remaining release blockers: approved permission mapping/configuration, multi-item catalog editing, discount UI/API connection, contract-specific price precedence, verified room/care/meal price sources, invoice snapshot integration, browser acceptance, source/runtime parity, and integrated CI for the final SHA.
