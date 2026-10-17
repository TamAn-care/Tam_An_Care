# Finance integration and controlled migration runbook

The target source-of-truth architecture is selected in [finance-canonical-source-of-truth-adr-20261017.md](finance-canonical-source-of-truth-adr-20261017.md). This does not prove the corresponding records exist in Production Test or authorize its migration.

## Authoritative live baseline (metadata only, 2026-10-09)
- PostgreSQL 16.15, public residents(resident_id), admission_cases(resident_id), finance_entries and finance_entry_audit present.
- New Finance billing, contract and allocation/idempotency tables are absent.
- Existing finance_entries supports source_mode, source_domain, source_entity_type, source_entity_id, amount_vnd, recognition_date, entry_type, status.
- Partial uniqueness applies to SYSTEM entries with nonnull source keys, not all MANUAL/SYSTEM economic duplicates.
- The Finance branch now rejects browser-local contract persistence and exposes a server-only contract read boundary. Production Test backend persistence is still NOT established; its current runtime image also requires a fresh parity check before relying on that boundary.

## Deployment prerequisites (hard stop until all verified)
1. Prove actual approved contract persistence and map it to the selected `service_contract_records` plus immutable version/signature/approval model, including canonical identifier, effective signed pricing, terms, change approval and version. The candidate schema is not live; do not copy browser-local records or treat an unverified candidate table as operational authority.
2. Define invariant map: admission_cases.resident_id -> residents.resident_id; invoices resident_id must match canonical residents; contract relationship must be enforced after backend source is verified.
3. Document exact ledger entry_type/status/category/source keys for revenue recognition from constraints and existing implementation without reading personal business rows. No revenue write until reconciled. Receipts/allocations NEVER create revenue.
4. Use separate isolated PostgreSQL 16 CI migration and transaction tests with synthetic CI-only records; block any automatic seed or schema-changing startup hook.
5. Before any authorized production mutation: verified restore-capable safety backup, maintenance window, actual available free space, SQL hash verification, current schema drift check, approved forward migration and rollback plan, real JWT and permissions acceptance. Stop if any check fails.
6. Do not deploy the in-progress Finance branch as a substitute for the Production Test branch. Reconcile changed shared files and dependencies and run full production branch regression.
7. Keep TAMANCARE_FINANCE_WRITE_ENABLED unset/false until business contract and ledger acceptance is signed off. No default allow role.

## Controlled deployment phases (not executable here)
- Phase A: record metadata only, source reconciliation, review changes and sign off.
- Phase B: pre-deploy full backup and isolated restore proof. NO deleting existing volumes.
- Phase C: schema migration only with a documented transaction/rollback and explicit user authorization; maintenance restrictions as needed.
- Phase D: deploy pinned immutable backend/frontend artifacts, check health, RBAC, read pages, invoice and receipt rendering; keep Finance writes OFF.
- Phase E: after separate approval enable narrowly scoped write roles, test genuine business data through authorized workflow, monitor finance_entry_audit and ledger invariants.
- Rollback: disable Finance writes first; restore previous app images. DB schema is forward-only by default because dropping new tables risks irreversible data loss; DB restore only by explicit operator approval and verified isolated restore point.

## STOP conditions
Unverified canonical contract, mismatched source mappings, duplicate/ambiguous manual ledger revenue, unsupported enum constraints, missing migrations, failed tests, insufficient server space, stale restore point, runtime drift, JWT/RBAC failure, shared file conflicts.

CURRENT_VERDICT=NO_GO. No Production Test changes authorized by this document.
