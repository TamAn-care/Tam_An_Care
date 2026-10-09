# Finance V2.2 — Integration Acceptance Gates (GitHub-only preparation)

Status: **NOT APPROVED FOR PRODUCTION TEST DEPLOYMENT**. This document describes gates; it does **not** run any tests, migrations or deployments.

## G0 — Source/build provenance
- Confirm branch `feature/finance-v22-github-build`, exact Git commit, workflow run ID and Node.js 24 runtime.
- GitHub Actions: TypeScript node/application, API-base guard and Vite all PASS.
- Build ZIP GitHub artifact SHA-256 agrees with downloaded ZIP bytes.
- `FINANCE_BUILD_MANIFEST.txt` records exact commit, Node version and build-only mode.
- `sha256sum -c FINANCE_SHA256SUMS.txt` passes **every listed item**; the checksum list must not include itself.
- Artifact is **build-only, not directly deployable**. Check runtime API base separately.

## G1 — Production Test compatibility (READ-ONLY)
- Compare Finance source commit with the **actual deployed** API/frontend images and currently running commit.
- Check Finance controller/module, frontend router, existing billing/service contracts and database schema compatibility.
- Check no unexpected schema migration, seed, fixture, mock/demo data, startup writes or destructive operations.
- Detect conflicts with other active TâmAnCare worktrees, schema migrations and shared files. Stop if overlap is unsafe.

## G2 — Finance Read authorization (isolated tests, no real resident data)
- Verify token integrity, verified role and deny-by-default authorization.
- Positive checks for ADMIN / SUPERVISOR / ACCOUNTANT according to approved role policy.
- Negative checks for all unrelated roles, expired/forged tokens and direct API requests: 401/403 and **no writes**.
- Confirm no frontend-only authorization reliance.

## G3 — Finance Read API contract (isolated, authorized environment)
- Verify all five Finance Read GET endpoints and data contracts: invoice, balance, monthly finance, receipts and the remaining mapped GET endpoint.
- Check read-only HTTP semantics, pagination/filters where applicable, empty states, rounding and financial totals.
- Validate use of canonical live business tables only; exclude any demo/mock/seed output.
- Confirm no schema or data writes. Do not use real resident or financial records in public GitHub logs/artifacts.

## G4 — Frontend / browser acceptance
- Compare actual frontend API base, proxy and public route; prevent `/api/api` prefix duplication.
- Verify authorized Finance menu and page visibility, loading/errors, mobile layout and role logout.
- Verify invoices/balances correspond to canonical API responses.
- Check regression for existing billing and service contract routes.

## G5 — Backup / release / rollback (NOT RUN)
- Obtain explicit user approval for deployment **after G0–G4 PASS**.
- Create and verify safety backup and isolated restore evidence; preserve scheduled server-side backups.
- Validate disk/RAM capacity, artifact integrity, deployment manifest, server independence and exact rollback target.
- Never reset DB, run automatic migrations or seeds, create demo data, restart PostgreSQL or alter volumes.
- Deploy only by a separate gated runbook and immediately verify health, RBAC, HTTP, API and UI.
- If any gate fails, STOP, report, and rollback only via the separately approved procedure.

## Evidence/status table
| Gate | State |
| --- | --- |
| G0 build on Node 24 | PASS in GitHub run #2; post-checksum-fix rerun pending |
| G0 internal SHA-256 | FIX COMMITTED; must inspect new artifact |
| G1 Production Test compatibility | NOT RUN |
| G2 isolated security end-to-end | NOT RUN (prior mocked unit tests are not E2E) |
| G3 GET API / business data | NOT RUN |
| G4 browser | NOT RUN |
| G5 release authorization | NOT GRANTED |

**Safety:** This document only provides acceptance requirements. Its presence does not grant any deployment permission.
