# Application Owner sign-off — V32

Business principle recorded from operator instruction: Admin/Superior is the highest application permission and is not PostgreSQL SUPERUSER. This records the policy statement only; it is not a technical sign-off.

Evidence reviewed: source baseline `f79fe2b7e0919e7035838bae7ce5f46df01b7e36`; Security evidence branch SHA at preparation `9933cd076638b19053e02e10e68e3694b7e48d6f`; CI runs 39379888909 and 39379888908. See `APPLICATION_SQL_CALL_PATH.md`, `APPLICATION_RBAC_REGRESSION.md`, and `DB_GRANTS_ALLOWLIST.md`.

## Owner decision

Status: **PENDING_SIGNOFF**. The full SQL/object/verb map and full regression under the new runtime DB role are not yet verified. CI PASS does not establish those missing results.

Application Owner must confirm separately:

1. Admin/Superior business administration survives unchanged and never depends on PostgreSQL superuser privileges.
2. Staff role separation; Guardian resident boundary including cross-resident DENY; Medical, Care, Nutrition, Contracts and Finance business operations pass.
3. Every SQL call path maps to least-privilege grants; no runtime DDL remains; migrations are separately approved.
4. Regression artifact SHA and run details correspond to exact candidate SHA and no cases were skipped.

Decision: PENDING — ____________________  Timestamp: __________  Evidence/run IDs: __________
