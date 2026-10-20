# Tam An Care V30 security approval package

Candidate baseline: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`.
Security code candidate: parent `3c1586049854c0473231ee725605822edfa1591a`; this evidence-only revision is independently identified by its commit SHA and CI checks after push.

## Evidence index

| Control | Evidence source | SHA / run | Time (UTC unless noted) | Result | Owner decision |
|---|---|---|---|---|---|
| Baseline candidate CI | GitHub Actions, `guardian-http-browser` | run `39230834225`, job `117988104488`, baseline SHA above | 2026-10-19 09:32:30–09:33:48 | PASS | inherited evidence only |
| Runtime DDL removal | Candidate patch, build and targeted tests | `3c1586049854c0473231ee725605822edfa1591a` (security code commit) | 2026-10-20 | PASS locally | Application Owner review required |
| Production Test runtime identity | READ ONLY query, health check and `pg_stat_activity` | sanitized V30 evidence record | 2026-10-20 03:56 UTC | role `taman`, API connection corroborated | DBA review required |
| Production Test role posture | PostgreSQL 16.15 catalog summary, transaction `READ ONLY` | sanitized V30 evidence record | 2026-10-20 | `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS` all true; 192 tables and 3 sequences owned | DBA review required |
| Consumer map | container inventory, filtered API config, timer/backup script metadata | sanitized V30 evidence record | 2026-10-20 | API confirmed; backup username and all other consumers unverified | Platform/DBA evidence required |
| Target grants allowlist | no approved SQL call-path-to-object matrix yet | — | — | UNVERIFIED | DBA + Application Owner must approve |
| Backup checkpoint | host backup file, SHA256 sidecar and read-only `pg_restore --list` | sanitized V30 evidence record | 2026-10-20 10:00:01 +07 | archive checksum/list pass; restore of real-data checkpoint not attempted | DBA approval required |
| Disposable PostgreSQL role rehearsal | PostgreSQL 16.15 synthetic database, local ephemeral runs | `LOCAL_ROLE_MODEL_REHEARSAL_20261020.md` | 2026-10-20 | PASS for modeled allowlist; supplemental, not production manifest | DBA review required |
| Application regression | candidate build and targeted Node test run | `3c1586049854c0473231ee725605822edfa1591a` (security code commit) | 2026-10-20 | build PASS, 53/53 selected tests PASS | Application Owner review required |
| GitHub Actions integration | `guardian-http-browser` run `39367355400` | `3c1586049854c0473231ee725605822edfa1591a` | 2026-10-20 | PASS; disposable PostgreSQL 16 + HTTP/JWT + Chromium | inherited automation evidence |
| GitHub Actions auth evidence release gate | run `39367355358`, job `118447193697` | `3c1586049854c0473231ee725605822edfa1591a` | 2026-10-20 | FAIL: in-memory test artifact is rejected because gate requires PostgreSQL 16 HTTP evidence | CI test contract must be reconciled; do not claim global CI PASS |
| Gitleaks | full checkpoint scan and commit-delta scan | baseline `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; delta commit `3c1586049854c0473231ee725605822edfa1591a` | 2026-10-20 | 36 existing baseline findings; zero findings in candidate diff | Security disposition of historical findings required |
| JWT source inventory | candidate source inspection | `3c1586049854c0473231ee725605822edfa1591a` (security code commit) | 2026-10-20 | single `JWT_SECRET`; provider, deployment and revoke evidence UNKNOWN | Security/Platform evidence required |
| JWT synthetic rotation | isolated rehearsal | pending | — | NOT RUN | requires tested synthetic login/session/revoke harness |

## A. DBA approval

- Current Production Test role: `taman`, login enabled, PostgreSQL superuser and high-risk flags listed above.
- Proposed runtime role: **not frozen**. No live role or credential changes were made.
- Grants allowlist: **UNVERIFIED** pending exact consumer inventory, object/call-path mapping, RLS and definer review.
- Consumer map: API is confirmed; backup, migration, scheduled jobs, monitoring and maintenance inventory is incomplete.
- Backup checkpoint: checksum and archive TOC verified. Real checkpoint restore readiness is unverified.
- Cutover and rollback: not authorized or executed; runbook must use a new credential and a verified restore path.
- DBA signoff: `UNVERIFIED — DBA action required`.

## B. Application Owner approval

- Candidate removes application startup/request-path DDL. Notifications schema creation is moved to a migration; the other removed DDL/seed operations are covered by existing migrations at the baseline.
- Candidate build PASS; selected auth, guardian scope, resident authorization tests PASS 53/53.
- These tests do not constitute the full role-bound Admin/Superior, Staff, Guardian, Finance end-to-end suite on the disposable PostgreSQL role.
- Approval to bind API to a new DB runtime role: `UNVERIFIED — Application Owner action required`.

## C. Security / Platform approval

- Source currently reads one signing key, `JWT_SECRET`; no prior-key/key-id dual-signing mechanism was observed in candidate source.
- Provider/account, runtime secret record/version, replica distribution, historical fingerprint disposition, revoke state and issuer/audience inventory remain `UNKNOWN`.
- No secret value or key-derived fingerprint is included.
- JWT rotation rehearsal and session invalidation acceptance: `UNVERIFIED`.
- Security/Platform signoff: `UNVERIFIED — owner evidence required`.

## Approval decision

`SECURITY_GATE=BLOCKED_UNTIL_VERIFIED`
`DB_ROLE_RUNTIME_CUTOVER=NOT_EXECUTED`
`JWT_LIVE_ROTATION=NOT_EXECUTED`
`PRODUCTION_DEPLOY=NO`
`RELEASE_GATE=CLOSED`
