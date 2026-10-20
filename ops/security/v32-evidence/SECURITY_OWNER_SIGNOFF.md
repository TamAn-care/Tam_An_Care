# Security Owner sign-off — V32

Evidence scope: H01–H36 history and JWT provider/runtime/revocation evidence, not DBA/application/platform scopes. Prepared from candidate baseline `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; evidence branch revision `9933cd076638b19053e02e10e68e3694b7e48d6f`.

## Current verified state

- Gitleaks 8.30.1 historical scan reported 36 detections on baseline. Every finding is listed in `HISTORICAL_FINDINGS_H01_H36.md`; all 36 remain UNKNOWN.
- Source reads a single `JWT_SECRET` in auth issuance and production JWT middleware. Provider/account, secret-record/version, all runtime replicas, last use and revoke events remain unknown.
- Exact SHA GitHub Auth + PG16 HTTP/Chromium CI passed (runs 39379888909 and 39379888908); this is synthetic test evidence and does not prove provider-side lifecycle.
- No live rotation, revoke, or use of any suspected historical credential occurred.

Status: **PENDING_EVIDENCE / PENDING_SIGNOFF**.

Security owner must review each H01–H36 row against protected provider audit, provide redacted record IDs/event references and disposition, confirm JWT provider/version/revoke state, and decide whether rotation is required. If one person also holds another role, sign the other role's independent scope in its own file.

Decision: PENDING — ____________________  Timestamp: __________  Protected evidence references: __________
