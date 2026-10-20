# Auth CI contract acceptance — V31

Failed run time: 2026-10-20 04:01:27–04:02:03 UTC. SHA256 of this sanitized document is listed in sibling SHA256SUMS.

Status: PASS on code commit 1f0ca57f7974a64bf36c71f378c5bc3525b12e0f and evidence revision 7ac469236b6a62c2466173020a4bbd75aebce5aa. Both Auth and PostgreSQL 16 HTTP/Chromium workflows passed on the exact 7ac SHA. Local results are not CI acceptance.

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
| API build + policy tests | 1f0ca57f7974a64bf36c71f378c5bc3525b12e0f | PASS | run 39377121539, job 118477655983 |
| Guardian resident scope and negative tests | 1f0ca57f7974a64bf36c71f378c5bc3525b12e0f | PASS | run 39377121539 policy gate job 118477765174; PG16 HTTP run 39377121551 |
| PostgreSQL 16 HTTP/JWT + browser | 1f0ca57f7974a64bf36c71f378c5bc3525b12e0f | PASS | run 39377121551, job 118477655744 |
| Gitleaks changed diff | commit 1f0ca57f7974a64bf36c71f378c5bc3525b12e0f | PASS | local Gitleaks 8.30.1 scanned the new commit diff; zero findings |
| Final Auth Contract CI | 7ac469236b6a62c2466173020a4bbd75aebce5aa | PASS | Auth run 39378856687; PostgreSQL 16 HTTP/Chromium run 39378856649; both head_sha values match |

No PASS is granted from local testing or skipped jobs. All named GitHub checks completed successfully on both the code commit and exact evidence revision. On 7ac469236b6a62c2466173020a4bbd75aebce5aa, Auth completed 2026-10-20T06:10:16Z–06:10:57Z and HTTP/Chromium completed 2026-10-20T06:10:16Z–06:11:24Z. The GitHub connector exposes workflow/job conclusions and artifact metadata; it did not return raw failed-step stdout from the prior run.
