# Finance V3.8.18.34 — CI-only integrated document lifecycle

- Dependencies: V26 isolated schema, V27 transition function and session lab, V29 atomic draft function.
- In ephemeral PostgreSQL finance_ci, exercise CREATE_DRAFT → SUBMIT → REVIEW → APPROVE in a single test transaction.
- Negative acceptance: no skip-direct approval, no self-review, no outdated revision approval, no unauthorized approver.
- Verify exactly four audit events with revisions 0–3, status APPROVED at revision 3; roll back all records and assert no residue.
- CI uses fake data ONLY within an isolated transaction in temporary CI PostgreSQL; it never seeds Production Test.
- This is NOT an operational REST API, real database migration, frontend activation, or a posting to public.finance_entries.
- No payroll read in this test; V30 separate confidential read gate remains mandatory.
- Release gates still required: canonical schema review, backup/restore evidence, source-runtime parity, user/role mapping, server-authenticated API, hard authorization, concurrency and idempotency, rollback without destroying live data, and explicit approval.
- Production Test GO/NO-GO: NO_GO.
