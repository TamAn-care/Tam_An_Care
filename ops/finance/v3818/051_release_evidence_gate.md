# Finance release readiness — evidence-based decision (10 October 2026)

**Decision: NO_GO — NO DEPLOY, NO MIGRATION.** This is a release gate, not a deployment instruction.

## Proven
- Live V41 read-only catalog: public.finance_entries and finance_entry_audit exist. finance_manual_documents NOT_FOUND.
- Live V42 read-only constraints: finance_entries accepts REVENUE, DIRECT_COST, PAYROLL, OPERATING_EXPENSE, DEPRECIATION, INTEREST, TAX; POSTED/DRAFT/VOID; SYSTEM partial unique key covers only non-null source tuple, not MANUAL.
- V45–V49 are isolated CI tests. Their passing does **not** establish same source schema or business records in Production Test.
- V50 live-month ledger query has **not** been executed on Production Test. GitHub V50 initial CI failed on a path issue; code fix committed; recheck needed.

## Required gates — all MUST have PASS backed by evidence
1. CI including isolated PostgreSQL, API, frontend and release-gate PASS at exact candidate SHA.
2. Attested source-tree and running image equivalence (including four original Finance migrations referenced by docs/finance-controlled-release-evidence.md).
3. Live read-only bounded monthly counts for relevant periods; source gaps/reconciliation are explicit and no identifiers/PII leaked.
4. Canonical, authorized source of manual vouchers and payroll is implemented, including independent maker/reviewer/approver, immutable evidence and audit. No CI-only schema masquerading as live schema.
5. Manual+SYSTEM cross-channel origin semantics proven with actual source identities; idempotency, concurrency and reverse/void handling covered. No cash receipt counted as second revenue.
6. Accurate agreed salary and consumption-based inventory valuation, leave meal allowance rules and contract care-rate changes reconciled.
7. Server-verified authenticated API/RBAC (including negative payroll visibility tests) and end-to-end Finance business acceptance using **real approved records only**. No demonstration or seed data in Production Test.
8. Verified current safety backup and checksum; restore tested in isolated environment for exact release artifact, documented reversible deployment/rollback; no automatic PostgreSQL restart/volume reset.
9. Performance/disk headroom, runtime HTTP, frontend MIME/SW and deployment compatibility gates PASS.
10. Explicit authorization from operator for controlled deploy and any needed migration; until then NO_DEPLOY. Source-only readiness may be announced for review without deployment.

Do not return READY from a bounded or empty ledger snapshot, a present table alone, or an isolated CI fixture. Monthly profit stays CHUA_DU_DU_LIEU until all month-close attestation and source checks pass.
