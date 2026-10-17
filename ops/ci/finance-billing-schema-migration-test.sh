#!/usr/bin/env bash
set -euo pipefail

# CI-only ephemeral PostgreSQL 16 service; no business rows are inserted.
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "CI_ONLY_MIGRATION_TEST"
  exit 2
fi
export PGHOST=127.0.0.1
export PGPORT=5432
export PGUSER=finance_ci
export PGPASSWORD=finance_ci_only
export PGDATABASE=postgres

database="finance_migration_schema_ci_${GITHUB_RUN_ID:-local}_${BASHPID}"
if [[ ! "$database" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "INVALID_DISPOSABLE_DATABASE_NAME"
  exit 2
fi

psql -X -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$database\""
created=1
cleanup() {
  if [[ "${created:-0}" == 1 ]]; then
    PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$database\" WITH (FORCE)" >/dev/null
  fi
}
trap cleanup EXIT

export PGDATABASE="$database"
migrations=(
  ops/finance/v22/001_finance_foundation.sql
  ops/finance/v28/002_finance_transaction_safety.sql
  ops/finance/v29/003_finance_allocation_invariants.sql
  ops/finance/v29/004_finance_integrity_hardening.sql
  ops/finance/v30/005_shared_contract_version_history.sql
  ops/finance/v30/006_shared_contract_signoff_evidence.sql
)

for migration in "${migrations[@]}"; do
  echo "APPLY_SCHEMA_ONLY=$migration"
  psql -X -v ON_ERROR_STOP=1 -f "$migration"
done

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
DECLARE
  expected_tables text[] := ARRAY[
    'service_contract_records',
    'billing_invoices',
    'billing_invoice_items',
    'billing_receipts',
    'billing_payment_allocations',
    'finance_source_links',
    'finance_operation_idempotency',
    'finance_operation_audit',
    'service_contract_versions',
    'service_contract_signing_evidence',
    'service_contract_approval_decisions'
  ];
  expected_triggers text[] := ARRAY[
    'finance_allocation_guard',
    'finance_allocation_immutability',
    'finance_receipt_protection',
    'finance_invoice_protection',
    'finance_linked_receipt_status_guard',
    'finance_linked_invoice_status_guard',
    'service_contract_revision_immutability',
    'immutable_contract_signature_evidence',
    'immutable_contract_approval_decision'
  ];
  name text;
BEGIN
  FOREACH name IN ARRAY expected_tables LOOP
    IF to_regclass(format('public.%I', name)) IS NULL THEN
      RAISE EXCEPTION 'MIGRATION_TABLE_MISSING: %', name;
    END IF;
  END LOOP;

  FOREACH name IN ARRAY expected_triggers LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgname = name AND NOT tgisinternal
    ) THEN
      RAISE EXCEPTION 'MIGRATION_TRIGGER_MISSING: %', name;
    END IF;
  END LOOP;

  IF to_regclass('public.finance_operation_audit_key_idx') IS NULL
     OR to_regclass('public.uq_contract_single_active_version') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_INDEX_MISSING';
  END IF;

  IF (SELECT count(*) FROM public.service_contract_records)
     + (SELECT count(*) FROM public.billing_invoices)
     + (SELECT count(*) FROM public.billing_invoice_items)
     + (SELECT count(*) FROM public.billing_receipts)
     + (SELECT count(*) FROM public.billing_payment_allocations)
     + (SELECT count(*) FROM public.finance_source_links)
     + (SELECT count(*) FROM public.finance_operation_idempotency)
     + (SELECT count(*) FROM public.finance_operation_audit)
     + (SELECT count(*) FROM public.service_contract_versions)
     + (SELECT count(*) FROM public.service_contract_signing_evidence)
     + (SELECT count(*) FROM public.service_contract_approval_decisions) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_CREATED_BUSINESS_ROWS';
  END IF;
END
$verify$;
SQL

echo "FINANCE_BILLING_MIGRATION_SCHEMA_ONLY_PASS"
echo "FINANCE_BILLING_MIGRATION_BUSINESS_ROWS=0"
echo "FINANCE_BILLING_MIGRATION_DISPOSABLE_DATABASE=$database"
