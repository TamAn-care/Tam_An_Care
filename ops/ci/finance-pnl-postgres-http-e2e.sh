#!/usr/bin/env bash
set -Eeuo pipefail

# Production-mode JWT + real PostgreSQL 16 HTTP acceptance. CI only.
# Creates and drops only this run's disposable database; never targets live DB.
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "SAFE_STOP=CI_ONLY_FINANCE_PNL_E2E"
  exit 2
fi

export PGHOST=127.0.0.1
export PGPORT=5432
export PGUSER=finance_ci
export PGPASSWORD=finance_ci_only
export PGDATABASE=postgres

database="finance_pnl_http_ci_${GITHUB_RUN_ID:-local}_${BASHPID}"
if [[ ! "$database" =~ ^finance_pnl_http_ci_[a-zA-Z0-9_]+$ ]]; then
  echo "SAFE_STOP=INVALID_DISPOSABLE_DATABASE_NAME"
  exit 2
fi

psql -X -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$database\""
created=1
cleanup() {
  if [[ "${created:-0}" == 1 ]]; then
    PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE \"$database\" WITH (FORCE)" >/dev/null
  fi
}
trap cleanup EXIT
export PGDATABASE="$database"

# These tables and rows are synthetic, isolated fixtures matching the live
# ledger/auth column contract. They are never loaded into Production Test.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.residents (resident_id text PRIMARY KEY);
CREATE TABLE public.admission_cases (
  admission_case_id text PRIMARY KEY,
  resident_id text NOT NULL
);
CREATE TABLE public.finance_entries (
  finance_entry_id text PRIMARY KEY,
  entry_type text NOT NULL,
  category text,
  description text,
  amount_vnd numeric(18,2) NOT NULL,
  recognition_date date NOT NULL,
  cash_date date,
  resident_id text,
  source_mode text,
  source_domain text,
  source_entity_type text,
  source_entity_id text,
  status text NOT NULL,
  reference_number text,
  note text,
  created_by text,
  created_by_role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uq_finance_entries_system_source
  ON public.finance_entries(source_domain,source_entity_type,source_entity_id,entry_type)
  WHERE source_mode='SYSTEM' AND source_domain IS NOT NULL
    AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL;
CREATE TABLE public.auth_sessions (
  session_id text PRIMARY KEY,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL
);
INSERT INTO public.residents(resident_id) VALUES ('CI_RESIDENT_PNL');
INSERT INTO public.auth_sessions(session_id,actor_id,actor_role,expires_at) VALUES
  ('CI_PNL_ADMIN','CI_ACTOR_ADMIN','ADMIN',now()+interval '1 hour'),
  ('CI_PNL_SUPERVISOR','CI_ACTOR_SUPERVISOR','SUPERVISOR',now()+interval '1 hour'),
  ('CI_PNL_ACCOUNTANT','CI_ACTOR_ACCOUNTANT','ACCOUNTANT',now()+interval '1 hour'),
  ('CI_PNL_CAREGIVER','CI_ACTOR_CAREGIVER','CAREGIVER',now()+interval '1 hour'),
  ('CI_PNL_REVOKED','CI_ACTOR_ADMIN','ADMIN',now()+interval '1 hour');
UPDATE public.auth_sessions SET revoked_at=now() WHERE session_id='CI_PNL_REVOKED';
SQL

for migration in \
  ops/finance/v22/001_finance_foundation.sql \
  ops/finance/v28/002_finance_transaction_safety.sql \
  ops/finance/v29/003_finance_allocation_invariants.sql \
  ops/finance/v29/004_finance_integrity_hardening.sql \
  ops/finance/v30/005_shared_contract_version_history.sql \
  ops/finance/v30/006_shared_contract_signoff_evidence.sql \
  ops/finance/v31/007_finance_invoice_ledger_origin.sql
do
  psql -X -q -v ON_ERROR_STOP=1 -f "$migration"
done

# The ledger row is deliberately not backed by an independent month-close
# attestation. The API must therefore withhold every profit figure (NULL).
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.finance_entries(
  finance_entry_id,entry_type,amount_vnd,recognition_date,resident_id,status,
  source_mode,source_domain,source_entity_type,source_entity_id,financial_origin_key
) VALUES (
  'CI_PNL_REVENUE','REVENUE',12000000,DATE '2026-10-01','CI_RESIDENT_PNL','POSTED',
  'SYSTEM','BILLING','INVOICE_LINE','CI_PNL_LINE','ci-origin:pnl-http:revenue:202610'
);
SQL

node ops/ci/finance-pnl-postgres-http-e2e.cjs
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'FINANCE_PNL_HTTP_POSTGRES_E2E=PASS\n' >> "$GITHUB_ENV"
fi
