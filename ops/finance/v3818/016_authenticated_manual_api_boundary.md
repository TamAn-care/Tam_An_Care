# Tâm An Care — Finance V3.8.18.16 authenticated manual finance command boundary

## Scope completed
- Added a **pure server-side command boundary** for draft candidate and approval transition candidates.
- Client payload only permits `action`, `expectedRevision` and `reason`; rejects attempted role/actor injection and invalid revisions.
- Requires a server-verified identity with session reference; checks independent maker/reviewer/approver via existing V3.8.18.13 workflow.
- Supports agreed salary and manual non-invoice income/expense review via V3.8.18.12 checks.
- All decisions return `databaseWriteEnabled:false`, `postingEnabled:false`.

## Critical conditions before activation
- Server verified identity flag is a **trusted integration contract**, NOT cryptographic proof and must never be accepted from request JSON. A future Nest service must obtain it from `readVerifiedFinanceIdentity(request)` plus a fresh check for an unrevoked session using `FinanceDocumentAuthorizationService`.
- PostgreSQL row lock and optimistic revision compare, actual document persistence, evidence store, negative RBAC end-to-end tests and atomic audit/ledger linking **are not connected**.
- V3.8.18.15 SQL persistence has been tested in isolated GitHub Actions but MUST NOT be executed on Production Test automatically. Actual production schema and deployment need separate reconciliation.
- No actual protected HTTP route or frontend Save/Approve buttons are registered or enabled here. No write operation is performed in production.
- Any future activation requires proof of production image/source baseline, verified isolated backup restore, controlled migration approval and rollback, and explicit GO.
- Absolutely no automatic demo/fixture generation or PostgreSQL/container restarts.

**Release = NO_GO.**
