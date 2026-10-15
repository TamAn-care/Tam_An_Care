# Guardian / Staff Auth — GitHub transition baseline

Status: **HOLD — not deployable**  
Feature branch: `feature/guardian-resident-scope-auth-20261012`  
Initial main commit: `93ef9dbc232b314836cbdff1dcf2e46df6878522`  
Reference date: 2026-10-12

## Objective

Continue development and validation of guardian authentication and resident-scoped access in GitHub, preserving existing staff authentication. Deploy to the independently operating Production Test server **only after** reproducible CI and isolated authorization regression tests pass, source/build provenance is established, and an explicit controlled deployment/rollback review approves release.

## Existing local verification evidence — transcribed from Gate logs, not GitHub CI results

| Gate | Observed result | Remaining limitation |
|---|---|---|
| 50.23 | 199 source files copied and SHA-256 verified in isolated workspace | Historical canonical source not proven |
| 50.29.2 | Offline npm install passed, 223 installed package versions matched; TypeScript compiler found | Local provisioning only |
| 50.30 | TypeScript 6.0.2 built 193 files; pre-emit diagnostics 0 | All four critical emitted JS files differ in SHA-256 from canonical runtime |
| 50.31 | Four artifacts inspected; 199 source files and canonical/compiled artifacts unchanged | Static structural/lexical review cannot prove behavior equivalence |
| 50.32 | Prepared 10 Staff Auth and 12 Guardian resident-scope regression scenarios | No regression tests executed |
| 50.33 | Four local Git working copies found; multiple copies point to this repository | Local authoritative repository unresolved; no push performed |

### Differences needing focused reconciliation

| Compiled artifact | Gate 50.31 line similarity to canonical | Gate 50.32 differing line blocks |
|---|---:|---:|
| `security/production-auth.middleware.js` | 0.94154 | 3 |
| `staff-actors/staff-actor.service.js` | 0.40506 | 20 |
| `residents/resident.controller.js` | 0.99329 | 1 |
| `resident-access-scope/resident-access-scope.service.js` | 0.88679 | 5 |

These metrics are text comparisons, not proofs of behavioral changes or equivalence.

## Mandatory CI gates (to implement on this branch)

1. Deterministic API and frontend build with locked dependencies, no startup seed or automatic database migration.
2. Code provenance against a verified, known-good runtime baseline; identify compiler and build-config differences.
3. Ten existing Staff Auth regression scenarios: valid/invalid/expired tokens, invalid signatures, disabled staff, roles, privilege escalation and guardian/staff identity separation.
4. Twelve Guardian resident-scope scenarios: active authorized link, missing/cross-resident/revoked/expired/inactive access, ID tampering, unauthorized edits/listing, unauthenticated attempts.
5. Explicit negative authorization assertions; no data returned or changed by unauthorized callers.
6. Secret scanning for source, proposed change set, workflows and Git history prior to publication.
7. Static analysis, test artifact retention, reviewer approval and a documented release decision.

The 22 scenarios are **test design only**. They must be implemented and executed against an isolated test harness before claiming PASS. No real resident records or Production Test data may be used as fixtures.

## Release/operations guardrails

- No fake/demo/seed data in Production Test.
- No database reset, Docker-volume modification, PostgreSQL restart, or silent migration.
- No replacement of canonical compiled JavaScript merely to force checksum parity.
- No merging to main or production deployment on the strength of a compile PASS alone.
- Do not include `.env`, credentials, database dumps, attachments containing resident data, backup archives or local cache in this public repository.
- Server remains operational without MacBook connected.
- Deployment requires backup and restore/rollback evidence, API/UI acceptance tests, separate authorization and `PRODUCTION_GO_NO_GO=GO`.

## Suggested transition workflow

1. Identify authoritative GitHub source structure and compare the fresh feature branch to the verified server runtime and historical local source. Preserve the already passing tests and unaffected staff paths.
2. Convert local test designs and non-sensitive findings into repository tests and CI checks. Implement missing Guardian functionality incrementally on this branch, not by copying unreviewed local source wholesale.
3. Open a **draft** PR for CI/review; resolve provenance and regression blockers before marking ready or merging.
4. After release approval, perform a controlled Production Test deployment with verified rollback; preserve real PostgreSQL data and attachments.

**Current decision: `PRODUCTION_GO_NO_GO=NO_GO`.**
