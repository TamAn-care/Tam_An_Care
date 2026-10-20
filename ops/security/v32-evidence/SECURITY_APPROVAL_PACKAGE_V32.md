# Tam An Care security approval package — V32

Prepared: 2026-10-20 ICT. Integration checkpoint: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`. Evidence candidate branch at preparation: `security/runtime-role-jwt-20261020`, SHA `9933cd076638b19053e02e10e68e3694b7e48d6f`. Baseline CI checkpoint `39230834225` PASS retained as baseline only. Exact current evidence SHA CI: Auth run `39379888909` PASS; PostgreSQL 16 HTTP/Chromium run `39379888908` PASS. These CI results do not prove live provider state or target DB-role completeness.

No sensitive values, older-adult personal data, database passwords or token values are included. No live DB permissions, secret, Production Test data, deployment, merge or backup were changed.

## Decision summary

| Gate | Evidence ready | Owner | Verification method | Risk / missing evidence | Decision |
|---|---|---|---|---|---|
| Existing DB role | Partial: read-only sanitized summary verifies `taman` SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS and broad ownership | DBA | Protected PG16 read-only catalog export and effective-privilege probes | No signed export metadata/full ACL/consumer inventory | PENDING_EVIDENCE |
| Runtime grants allowlist | Draft deny/allow boundaries only | DBA + Application Owner | Reconcile SQL call paths, catalog objects and consumer list; rehearse exact frozen matrix in disposable PG16 | Exact object/verb list and full app tests not yet proven | PENDING_EVIDENCE |
| Backup | Checkpoint identity, checksum and archive TOC recorded | DBA | Restore readiness test in approved isolated protected environment | Real archive restore not performed; do not call RESTORE_PASS | PENDING_EVIDENCE |
| Application RBAC | Exact-SHA Auth and PG16 HTTP/Chromium CI pass for stated cases | Application Owner | CI artifacts + complete module tests under proposed runtime role | No complete target-role Admin/Staff/Medical/Care/Nutrition/Contracts/Finance matrix | PENDING_EVIDENCE |
| H01–H36 | 36 individually listed, all UNKNOWN | Security | Protected provider/account/secret audit and per-finding redacted disposition | 0/36 closed; no proof of revoke or non-use | PENDING_EVIDENCE |
| JWT provider and runtime | Source single-key path; one API snapshot | Security + Platform | Provider metadata, secret version refs and all-process deployment audit | Key version, replicas, last-use, session invalidation and revoke unknown | PENDING_EVIDENCE |
| Security CI | Exact SHA `9933cd076638b19053e02e10e68e3694b7e48d6f`, two required runs PASS; Gitleaks changed diff required before final commit | Security/CI | GitHub check head SHA and run artifacts; Gitleaks diff | Current SHA is before this V32 documentation commit; final SHA must rerun CI | PENDING_FINAL_SHA_CI |

## Independent owner attestations

### 1. DBA Owner

Confirm role manifest, membership/ownership/ACL, complete consumer dependencies, exact object/verb allowlist, effective-privilege positive/negative tests and backup checkpoint/restore evidence. Current status: **PENDING_EVIDENCE**.

Decision: PENDING — ____________________  Timestamp: __________  Evidence references/checksums: __________

### 2. Application Owner

Confirm Admin/Superior remains highest application permission, independent of PostgreSQL SUPERUSER; verify Staff, Guardian cross-resident DENY, Medical, Care, Nutrition, Contracts and Finance acceptance under the proposed runtime role, with exact source/run/artifact SHA and no skipped cases. Current status: **PENDING_EVIDENCE**.

Decision: PENDING — ____________________  Timestamp: __________  Evidence references/checksums: __________

### 3. Security Owner

Confirm provider/account, protected key record/version, each H01–H36 disposition, revoke/rotation evidence, outstanding risk and decision on JWT rotation. Current status: **PENDING_EVIDENCE**.

Decision: PENDING — ____________________  Timestamp: __________  Evidence references/checksums: __________

### 4. Platform Owner

Confirm all API/worker/job/backup/migration/monitor/reporting/scheduler/maintenance consumers, instance/image digests, secret references/versions, rollout completeness and session/revoke propagation. Current status: **PENDING_EVIDENCE**.

Decision: PENDING — ____________________  Timestamp: __________  Evidence references/checksums: __________

The same person may hold multiple roles, but must make a separate decision/signature/timestamp for each role based on that role's scope. No signature or timestamp has been pre-filled.

## Exact next human action

Return one sanitized packet containing the four independent sections above and attach: (a) DBA-protected manifest metadata and exact object/verb grants plus attributable disposable rehearsal; (b) Application Owner's target-role regression artifact; (c) Security's provider audit and dispositions H01–H36; (d) Platform's full replica/consumer/version and session invalidation map. Each owner should mark missing items UNVERIFIED, not PASS. This is the evidence packet required before a cutover approval can be considered.

## Cutover prerequisites and rollback

Prerequisites: exact candidate CI PASS, signed owner evidence, complete target grant matrix, backup checkpoint with authorized restore readiness evidence, isolated rehearse of preflight/health/negative tests, Platform full consumer inventory, Security rotation decision and session plan, care-operations timing, and stop conditions. Cutover is a separate approval.

DB rollback must restore the prior application configuration only if the prior credential remains authorized and not exposed; do not reuse a credential confirmed compromised. JWT rollback uses a newly approved version, never a revoked/leaked key. Include health checks and operational stop conditions. This package does not authorize live changes.

DB_ROLE_CUTOVER=NOT_EXECUTED
JWT_ROTATION=NOT_EXECUTED
PRODUCTION_DEPLOY=NO
RELEASE_GATE=CLOSED
