# Auth CI contract acceptance — V31

Failed run time: 2026-10-20 04:01:27–04:02:03 UTC. SHA256 of this sanitized document is listed in sibling SHA256SUMS.

Status: candidate fix prepared on the authorized Security branch. Exact V31 SHA and check conclusions must be read from final GitHub Actions head_sha; local results are not CI acceptance.

## Failed run evidence

| Field | Evidence |
|---|---|
| Failed workflow | Guardian Auth Verification, push run 39367355358 |
| Commit | 3c1586049854c0473231ee725605822edfa1591a |
| Failed job/check | Guardian 22-case release gate (fail closed), job/check 118447193697 |
| Step | Step 4, Validate acceptance matrix and executable test evidence |
| Other jobs/steps | API build, 22 named tests, artifact upload, frontend build and summary job completed; exact check metadata recorded through GitHub connector |
| Artifact | guardian-22-case-evidence-3c1586049854c0473231ee725605822edfa1591a, artifact id 12240196062, ZIP digest sha256:5f514fa5e66b80f4588acc98738c8b958c28133ab45cfaa5ade630a821290607 |
| Raw step log | GitHub connector exposes job/step conclusion but returned no log content; it also did not expose step annotations. Therefore this record distinguishes observed job metadata from reproduced validator output. |

## Root cause established from artifact producer and validator

The producer api/test/guardian-22-case-evidence.test.cjs writes top-level and per-case environment isolated-in-memory-no-db. It creates mocks; it does not start NestJS/PostgreSQL/HTTP. The fail-closed validator required isolated-postgresql-16-http and checked every test item for that same HTTP environment. Thus 22 tests completed, but their evidence type could not satisfy the validator. Renaming the evidence label would have falsified test provenance.

The validator's deterministic rejection output for this artifact is:

```text
TEST_ENVIRONMENT=isolated-in-memory-no-db
REQUIRED_TEST_ENVIRONMENT=isolated-postgresql-16-http
TEST_EVIDENCE=NOT_DATABASE_BACKED_HTTP
CI_BLOCKER=GUARDIAN_HTTP_POSTGRES16_E2E_REQUIRED
```

This is reproduced from the artifact schema and validator source, not quoted as raw Actions stdout.

## Candidate root fix

1. The 22-case validator now requires truthful isolated-in-memory-no-db, exact GitHub Actions runtime, exact GITHUB_SHA, exactly 22 unique required cases, every status passed, no per-case error, and matching SHA/environment for every case.
2. It reports POLICY_GATE=PASS; it does not claim PostgreSQL/HTTP coverage or release/deployment approval.
3. The separate guardian-http-browser workflow remains responsible for disposable PostgreSQL 16, actual HTTP/JWT, resident scope, Finance and Chromium checks.
4. Security/CI paths were added to the integration workflow trigger so both workflows run for the same Security candidate change.
5. The matrix now describes the in-memory suite accurately. No test is relabeled as HTTP and no skipped case counts as pass.

## Exact-SHA verification

| Check | SHA | Result | Evidence |
|---|---|---|---|
| Python syntax, diff validation | V31 candidate | Local PASS only | compile() and git diff --check; not CI |
| API build + policy tests | V31 candidate | Pending exact-SHA CI | Actions check required |
| Guardian resident scope and negative tests | V31 candidate | Pending exact-SHA CI | Actions check required |
| PostgreSQL 16 HTTP/JWT + browser | V31 candidate | Pending exact-SHA CI | guardian-http-browser required on same SHA |
| Gitleaks changed diff | V31 candidate | Pending exact-SHA CI | No secret values in report |
| Final Auth Contract CI | Exact V31 commit SHA | UNVERIFIED until all checks complete | Do not infer from prior V30 PASS |

No PASS is granted from local testing or skipped jobs. On the exact V31 commit, require API build, 22-case evidence gate, frontend build, PostgreSQL 16 HTTP/Chromium integration, and changed-diff Gitleaks to complete successfully. Retain the exact SHA, run ID, check URLs and artifact checksums in final evidence.
