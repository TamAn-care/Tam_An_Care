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
