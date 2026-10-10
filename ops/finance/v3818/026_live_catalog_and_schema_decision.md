# Tâm An Care Finance V3.8.18.25 / V3.8.18.26

## Source evidence (live READ-ONLY)
2026-10-10 user-run SSH catalog on beta-docker / tamancare-production-test-server-postgres-1, database taman_care, role taman; transaction read_only=on; completed COMMIT with 35 matching relations. public.finance_entries and public.finance_entry_audit exist. public.auth_sessions and public.staff_actors also exist. No dedicated invoice, payroll, voucher or manual document table appeared among the 35 matching names. This is an audited-name-filter result, not proof that external source systems or nonmatching tables are absent. No live business row values inspected.

## V3.8.18.26 CI-only candidate
Isolated schema finance_manual_v26_ci for candidate source documents, audit history and optional payroll components. Supports agreed salary independent of shifts and income/expense with internal vouchers. Separates origin key and document approval from ledger transactions. It creates **no business rows**; isolated CI checks table constraints and zero rows.
Does NOT add the schema to live Production Test. Does NOT grant access, install an API, migrate, deploy, or post journal entries. No automatic expense recognition from kitchen receipts, inventory stock movements, payroll schedules or cash receipts.

## Remaining release blockers
1. Reconcile real business workflow owner and evidence fields and confidentiality policy before accepting canonical schema design.
2. Verify source branch/runtime image parity, least privilege, actual database backup and isolated restore.
3. Build authenticated server-side draft/submit/review/approve API, persisted audit, resource scopes, lock/idempotency; isolated negative security tests.
4. Build safe frontend and validate realistic **user-entered real records only** after staged, authorized deployment.
5. Connect Finance ledger through atomic posting after evidence and approval; preserve recognition-versus-payment separation and never double-count.
6. Release remains NO_GO until explicit acceptance, migrations and rollback gates.
