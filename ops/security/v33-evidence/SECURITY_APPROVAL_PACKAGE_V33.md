# Tam An Care — Security approval package V33

Prepared 2026-10-20 ICT. Integration checkpoint: `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`. Source/code candidate: `9933cd076638b19053e02e10e68e3694b7e48d6f`. Evidence branch revision before V33 documents: `a69ad0e564c3f59f634f77b1af81a03faaa5d6b8`. Exact-SHA Actions on a69: Auth run `39386735780` SUCCESS; PG16 HTTP/Chromium run `39386735779` SUCCESS. Baseline integration run `39230834225` remains a historical checkpoint, not evidence for this branch.

All attached Markdown files have SHA-256 values in `SHA256SUMS`. Protected catalog evidence remains outside Git at `/private/tmp/v33-dba-protected/prodtest-catalog.json` (mode 0600), SHA-256 `df77951d946f70654e283448bb61be28c776e48a0d12b72acdb00a8c5db0394b`. No credential values, older-adult personal data or full environment were written into this package.

## Decision matrix

| Scope | Evidence ready | Required verification / risk | Owner decision |
|---|---|---|---|
| DBA — privileges and restore | Fresh read-only PG16 catalog, hourly archive checksum and 192/192 table-name coverage; daily archive separately identified | `taman` is superuser and owns app objects; exact least-privilege test not run; restore not performed; hourly TOC header differs by 6; DBA must attest protected manifest and backup/restore process | PENDING_EVIDENCE |
| Application Owner — RBAC and business regression | Exact SHA GitHub Auth + PG16 HTTP/Chromium PASS; source call-path matrix | Admin/Superior dedicated E2E and several modules not tested end-to-end; proposed DB role not exercised; Owner must confirm business acceptance | PENDING_EVIDENCE |
| Security — historical findings and JWT | H01–H36 each listed; JWT source signing/session behavior reviewed | 36 remain UNKNOWN/RISK_OPEN; no provider evidence/revoke; internal JWT has no provider key-version proof; rotation decision and evidence needed | PENDING_EVIDENCE |
| Platform — consumers/replicas/session | API, frontend and DB instance metadata; one API observed; backup cron schedule | Full replica/worker/consumer list, secret IDs/versions/injection, backup identity and session invalidation propagation not verified | PENDING_EVIDENCE |

## Owner attestations (four independent decisions)

Each owner should review only their scope and record identity, verification method, decision, UTC timestamp and evidence references. Same person may act in multiple roles, but each decision remains separate. No owner identity, signature or approval has been supplied or pre-filled.

### DBA — database privileges and restore evidence

Evidence: `DBA_EVIDENCE.md`, `DB_GRANTS_ALLOWLIST.md`, `DBA_RESTORE_READINESS.md`. Risks: current `taman` superuser/ownership; proposed allowlist is untested; full restore not proven.

Decision: PENDING — Owner identity: __________ — Attestation method: __________ — Timestamp: __________ — Evidence/checksum: __________

### APPLICATION OWNER — Admin/Superior RBAC and business regression

Evidence: `APPLICATION_SQL_CALL_PATH.md`, `APPLICATION_REGRESSION.md`. Admin/Superior remains an application business role and does not require PostgreSQL SUPERUSER. Partial CI coverage is described in the regression matrix.

Decision: PENDING — Owner identity: __________ — Attestation method: __________ — Timestamp: __________ — Evidence/checksum: __________

### SECURITY — findings, JWT validity and revocation

Evidence: `HISTORICAL_FINDINGS_H01_H36.md`, `JWT_RUNTIME_EVIDENCE.md`. Risks: all 36 findings unknown; no external-provider audit or revoke evidence; live JWT key validity unknown.

Decision: PENDING — Owner identity: __________ — Attestation method: __________ — Timestamp: __________ — Evidence/checksum: __________

### PLATFORM — consumers, replicas, secret versions, invalidation

Evidence: `PLATFORM_CONSUMER_MAP.md`, `PLATFORM_SESSION_INVALIDATION.md`. Risks: one API replica snapshot only; secret version/source and complete consumers unverified.

Decision: PENDING — Owner identity: __________ — Attestation method: __________ — Timestamp: __________ — Evidence/checksum: __________

## Single owner handoff

Return one sanitized evidence packet with four distinct sections: (1) DBA protected export object/version and signed exact allowlist test plus authorized restore evidence; (2) Application Owner regression under proposed runtime role for remaining cases; (3) Security provider/account audit and per-finding H01–H36 validity/revocation dispositions plus internal JWT rotation decision; (4) Platform complete instance/consumer map with secret record/version references and invalidation propagation. Do not include secret values or personal data. Mark unsupported claims UNVERIFIED.

## Cutover gates

| Action | Preconditions | Stop condition / rollback | Decision |
|---|---|---|---|
| DB role cutover | Signed manifest, exact allowlist rehearsal, complete consumers, verified backup/restore readiness, owner approval | Any unknown consumer, grant failure, health/authorization regression; rollback only to a credential still authorized and not exposed | NOT AUTHORIZED |
| JWT rotation | Security decision, all consumers/versions mapped, synthetic rehearsal, re-login/session plan and owner approval | Any replica unable to load new version or unexpected auth failure; do not restore a known-exposed key | NOT AUTHORIZED |

`LIVE_ROLE_CUTOVER=NO` · `LIVE_JWT_ROTATION=NO` · `PRODUCTION_DEPLOY=NO` · `PR_MERGE=NO` · `RELEASE_GATE=CLOSED`.
