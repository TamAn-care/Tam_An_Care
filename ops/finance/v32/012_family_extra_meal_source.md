# Family extra meal source (v32.012)

This additive schema stores family meal registrations and the staff-confirmed chargeable quantity. Resident meals included in the signed service package do not enter this table and must not be invoiced separately.

The guardian registration is `REGISTERED` and has no price or charge amount. A verified Nutritionist/Supervisor/Admin can transition it once to `CONFIRMED`; the API requires an active signed contract, resident access scope, a reason, and exactly one approved `FAMILY_EXTRA_MEAL` catalog item effective on the service date. The version and integer VND amount are captured on confirmation. Confirmed rows and audit entries are immutable. No cancellation/refund rule is inferred here.

No price or operational data is seeded. Apply and test only on disposable PostgreSQL 16. Production Test migration remains separately gated and is not part of this change.

## Current integration boundary

Confirmed charges are stored as canonical Nutrition source records. The existing monthly fee notice API in `frontend/src/api/billing.ts` is explicitly not ready, and invoice issue/write APIs are not available in this branch. Therefore this migration does not silently update a notice, invoice, receivable, or ledger. Those must consume these confirmed source rows through the canonical Billing transaction before any release can be considered ready.

## Rollback

No destructive rollback is provided. The migration adds tables, indexes, functions, and triggers. If a candidate must be reverted before any production application, stop the candidate API and restore the pre-migration database using the approved backup/restore runbook. Do not drop these tables if they contain business evidence.
