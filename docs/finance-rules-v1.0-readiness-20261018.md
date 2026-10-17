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
