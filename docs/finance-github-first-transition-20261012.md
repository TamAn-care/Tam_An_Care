# Finance — GitHub-first transition gate (2026-10-12)

## Decision and boundaries

- Canonical GitHub development baseline: `feature/finance-v381861-isolated-integration`, pending code review. This is **not** a release approval.
- Develop via feature branches and pull requests, with isolated GitHub-hosted CI. Do not use a Production Test server or a self-hosted runner for this transition workflow.
- No automatic merge to `main`, deployment, production database connection, schema migration, seed, or production service restart.
- Never commit residents' records, medical data, invoices, live financial exports, credentials, tokens, database dumps, backups, or logs with personal data. Repository visibility must be reviewed before any migration.
- The feature's official monthly financial result remains **NO_GO** until trusted real-document provenance, comprehensive reconciliation, accounting-period lock, runtime source parity, authorized release, and acceptance are separately proven.

## Inventory: existing GitHub Finance (observed)

- `api/src/finance-billing/monthly-operating-result.service.ts` reads canonical ledger fields and fails closed when ledger columns are missing.
- Existing GitHub Actions: `finance-v61-isolated-merge.yml`, `finance-http-jwt-isolated.yml`, `finance-deploy-readiness.yml`.
- Existing CI scripts include finance reconciliation, month-close evidence and isolated JWT/RBAC tests.
- The alternate server-side Finance candidates from V169–V183 were tested *outside* GitHub. Their contents and source equivalence to the GitHub branch have **not** been completely reviewed or migrated. Earlier server-side PASS logs do not mean GitHub CI has passed.

## Migration sequence

1. **Inventory and security:** compare each server-side candidate with the GitHub Finance implementation by function and tests, review repository visibility, remove or redact sensitive material *before* any upload, and record provenance. Do not blindly copy compiled files, credentials, local reports or DB fixtures.
2. **Implement in GitHub:** port only missing logic into `api/src/finance-billing` and its tests; use a branch and draft PR. Retain null-as-unverified semantics, actual Ledger entry types, exact VND arithmetic, and strict JWT/RBAC.
3. **Qualify in CI:** require API/frontend builds, isolated unit/integration/HTTP/JWT/PostgreSQL tests, reconciliation, canonical contract checks and explicit NO_GO release guard. Zero-data or synthetic test cases do not prove real business completeness.
4. **Release only by explicit approval:** freeze a reviewed commit, verify runtime/source parity and isolated restore evidence, take a safety backup, approve migration separately, deploy controlled to Production Test, run post-deploy acceptance and keep rollback available.

## Outstanding release blockers

- Verified documents for revenue, direct costs, payroll and operating expenses.
- Contract/receivable/deposit recognition, exclusion of receivable collections from new earned revenue.
- Independent month-close and accounting-period lock.
- Proof that GitHub code matches deployed runtime, source schema and role permissions.
- Evidence of isolated backup/restore and explicit authorized release decision.

**Current status: FINANCE_PRODUCTION_GO_NO_GO=NO_GO.**

## GitHub Actions investigation — 2026-10-12

PR #5's first CI run failed at API build with TypeScript TS2307 in `api/src/app.module.ts`: the Finance baseline imports `./paper-records/paper-record.module`, but the module is absent from the Finance branch. Read-only comparison confirms `antigravity-production-test` contains `api/src/paper-records/paper-record.module.ts`, `paper-record.controller.ts`, and `paper-record.service.ts`. The module also depends on `DatabaseModule` and `ResidentAccessScopeModule`.

**Resolution requirement:** reconcile these three actual source files and dependency/security semantics in a reviewed integration, not a stub, and do not remove the existing `PaperRecordModule` registration. The historical paper-record controller accepts `x-actor-id`/`x-actor-role` headers; before bringing it onto a deployment path, verify that the actual upstream auth middleware replaces untrusted role headers and covers the entire route. Never claim RBAC parity from a successful TypeScript build alone.

The finance branch already contains:
- `api/src/finance-billing/monthly-operating-result.ts` and `monthly-operating-result.service.ts`;
- `monthly-close-evidence.ts`;
- `finance-read.controller.ts` with a guarded monthly operating result route;
- isolated JWT, accounting, reconciliation and source-provenance CI checks.

Server-side V169–V183 checkpoints use a different `api/src/finance` structure in some stages; the GitHub baseline uses `api/src/finance-billing`. These are not assumed equivalent. The GitHub monthly result pure engine groups expenses into `EXPENSE` whereas the earlier server-side Ledger used explicit `DIRECT_COST`, `PAYROLL`, `OPERATING_EXPENSE`, `DEPRECIATION`, `INTEREST`, and `TAX`. A canonical type/source mapping and money precision audit is required before porting formulas.

**CI status:** first workflow run FAIL (TS2307). Subsequent workflow updated to fail early with `CROSS_MODULE_SOURCE_PARITY=BLOCKED` and an actionable diagnostic. CI PASS and Finance release remain unproven; deployment is forbidden.

## Finance trusted month-close boundary — 2026-10-12

The isolated GitHub CI now explicitly demonstrates that the pure `verifyIndependentMonthlyClose` function validates a claimed evidence **shape**, not the authenticity of a cryptographic signature, repository or approving principal. A forged object with plausible flags may pass this pure shape check. The operational `MonthlyOperatingResultService` still calls the validator with `null` and forces `CHUA_DU_DU_LIEU`/`profitVnd: null`, even when ledger rows carry fabricated approval-like fields.

**Required before enabling a ready result:** implement a trusted backend evidence repository, attestation signature verification with authoritative keys, replay prevention and immutable month-snapshot binding, ledger source completeness, independent expense/revenue reconciliation, and actual accounting-period lock. Never wire a client-supplied boolean or document claim into a `READY` financial report. This test does not prove real-document provenance and does not authorize deploy.
