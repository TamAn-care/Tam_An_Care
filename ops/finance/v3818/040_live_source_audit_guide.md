# V3.8.18.40 — Real source inventory, READ ONLY

V39 CI PASS: 38033195474. V25 direct server inventory verified finance_entries and finance_entry_audit but not a canonical manual-document/payroll source. V40 is a targeted follow-up catalog query, **not proof of actual source completeness**.

## Operating procedure (operator run only after verified remote identity)
- Reach verified host beta-docker, exact container tamancare-production-test-server-postgres-1, database taman_care, user taman.
- Execute only ops/finance/v3818/040_live_source_inventory_readonly.sql through `psql -X -v ON_ERROR_STOP=1 --single-transaction`. Connection is to the intended existing container, never another DB.
- Confirm read_only=on; do not query payroll/resident row values. Inspect schema/columns only. No seed, migration, Docker changes, restart, database write, or deploy.
- SQL is committed on GitHub only, NOT copied to remote Production Test. An administrator must verify local file checksum and choose controlled READ-ONLY execution.
- Results show candidate source names/columns, NOT approved/invoiced/posted counts, exact row provenance, access scopes or evidence of complete month-close.
- A candidate invoice, payroll or contract table may use another naming convention: negative catalog output cannot prove no such functionality exists.

## Next release gates
1. Verify the named tables, key constraints, statuses, event and approval fields from live metadata.
2. Independently verify actual record provenance without exposing salary PII; use bounded aggregate queries and approved roles.
3. Confirm source-to-ledger join keys and recognition/cash date semantics. No inventory received stock treated as expense by default.
4. Prove source tree to deployed runtime equivalence, safety backup and tested isolated restore, rollback and least-privilege endpoint before any migration.
5. Month close remains CHUA_DU_DU_LIEU; production NO_GO.
