# Canonical service-contract integration acceptance — phase 2

Scope: GitHub development branch only. NO production deploy/migration/seed.

## Verified progress
- Finance branch contracts read from a single PostgreSQL-backed contract identity and signed/approved ACTIVE version; draft and amendment writers are default-denied.
- Frontend list/detail now requires server API. No localStorage or mock fallback is used for API reads, and draft creation only treats a confirmed backend response as success.
- Existing browser localStorage is PRESERVED; never auto-import, auto-seed or delete browser data. UI operators should receive an explicit migration/reconciliation procedure after authenticated persistence exists.
- Draft amendment creates a separate version with expected-version check; current signed version remains immutable.
- Pure activation policy checks distinct signer/approver, SHA256 document fingerprint, resident/admission/room assignment agreement, approved care level and pricing and amendment approval.

## REQUIRED BEFORE REAL SIGN / APPROVE
1. Evidence-grade versioned signature backend: server-side document fingerprint from exact printable contract PDF (not browser-claimed hash), capture signature provenance and timestamps and consent; do not infer legally valid e-signature from a hash alone.
2. Authoritative approval: current actor roles and explicit direction-board permission from server identity; distinct signer/approver; capture immutable audit decision, reason, approved values, and stale version rejection in a database transaction.
3. Validate actual `admission_care_classifications` approval, `residents.care_level`, `bed_assignments` and accommodation changes server-side; the current pure policy checks evidence but DOES NOT fetch it itself.
4. Reconcile contract model from existing ServiceContractsPage and its signed print format, including any article 5 amendments and pricing terms; keep UI blocked if backend approval is unavailable.
5. Ensure invoice creation uses approved effective contract version and preserves historical terms for each issued billing period.
6. Review existing browser-only documents with an authorized operator using explicit provenance (real vs old demo) before selectively migrating; never silently copy.
7. Run whole-app isolated HTTP/PostgreSQL workflows, production drift/backup check and secure release gates before a reviewed migration.

VERDICT: FOUNDATIONAL CONTRACT SAFETY PASS; END-TO-END SIGNING/APPROVAL NOT YET COMPLETE; PRODUCTION_DEPLOY=NO.