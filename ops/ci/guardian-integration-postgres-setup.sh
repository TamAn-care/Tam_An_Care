#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo 'GUARDIAN_PG16_SETUP_CI_ONLY'
  exit 2
fi
database="${DB_NAME:-}"
if [[ ! "$database" =~ ^guardian_e2e_[0-9]+$ ]]; then
  echo 'GUARDIAN_PG16_DISPOSABLE_DATABASE_NAME_INVALID'
  exit 2
fi

psql -X -v ON_ERROR_STOP=1 -d "$database" -f database/schema.sql
psql -X -v ON_ERROR_STOP=1 -d "$database" -f database/migrations/20260829_001_enterprise_foundation.sql
psql -X -v ON_ERROR_STOP=1 -d "$database" -f database/migrations/20260829_002_auth_session_lifecycle.sql

migrations=(
  ops/finance/v22/001_finance_foundation.sql
  ops/finance/v28/002_finance_transaction_safety.sql
  ops/finance/v29/003_finance_allocation_invariants.sql
  ops/finance/v29/004_finance_integrity_hardening.sql
  ops/finance/v30/005_shared_contract_version_history.sql
  ops/finance/v30/006_shared_contract_signoff_evidence.sql
  ops/finance/v31/007_finance_invoice_ledger_origin.sql
  ops/finance/v32/008_discount_and_absence_policy.sql
  ops/finance/v32/009_service_price_catalog.sql
  ops/finance/v32/010_immutable_invoice_snapshot.sql
  ops/finance/v32/011_service_code_mapping.sql
  ops/finance/v32/012_family_extra_meal_source.sql
  ops/finance/v32/013_family_meal_invoice_snapshot.sql
)
for migration in "${migrations[@]}"; do
  psql -X -v ON_ERROR_STOP=1 -d "$database" -f "$migration"
done
psql -X -v ON_ERROR_STOP=1 -d "$database" -f database/migrations/20261019_001_guardian_identity_auth.sql
echo 'GUARDIAN_PG16_CANONICAL_SCHEMA_AND_MIGRATIONS=PASS migrations=008..013 guardian_identity_auth=1'
