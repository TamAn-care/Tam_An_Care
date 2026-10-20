#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
run_id="${GITHUB_RUN_ID:-local-${RANDOM}}-${GITHUB_RUN_ATTEMPT:-1}"
database="finance_e2e_${run_id//[^a-zA-Z0-9_]/_}"
restore_database="${database}_restore"
[[ "$database" =~ ^finance_e2e_[A-Za-z0-9_]+$ && "$restore_database" == "${database}_restore" ]] || {
  echo 'FINANCE_E2E_OWNED_DATABASE_NAME_INVALID' >&2
  exit 1
}
secret_file="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/finance-e2e-database-url-${run_id}"
restore_archive="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/finance-e2e-restore-${run_id}.dump"
api_pid=''
vite_pid=''
api_log="${RUNNER_TEMP:-/tmp}/finance-playwright-api.log"
vite_log="${RUNNER_TEMP:-/tmp}/finance-playwright-vite.log"

cleanup() {
  local status=$?
  [[ -n "$vite_pid" ]] && kill "$vite_pid" 2>/dev/null || true
  [[ -n "$api_pid" ]] && kill "$api_pid" 2>/dev/null || true
  if command -v dropdb >/dev/null 2>&1; then
    dropdb --if-exists --maintenance-db=postgres --host="${PGHOST:-127.0.0.1}" --port="${PGPORT:-5432}" \
      --username="$PGUSER" "$restore_database" >/dev/null 2>&1 || status=1
    dropdb --if-exists --maintenance-db=postgres --host="${PGHOST:-127.0.0.1}" --port="${PGPORT:-5432}" \
      --username="$PGUSER" "$database" >/dev/null 2>&1 || status=1
  else
    psql --host="${PGHOST:-127.0.0.1}" --port="${PGPORT:-5432}" --username="$PGUSER" \
      --dbname=postgres --set=ON_ERROR_STOP=1 -c \
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('${database}','${restore_database}') AND pid<>pg_backend_pid(); DROP DATABASE IF EXISTS \"${restore_database}\"; DROP DATABASE IF EXISTS \"${database}\";" \
      >/dev/null 2>&1 || status=1
  fi
  rm -f "$secret_file"
  rm -f "$restore_archive"
  if psql --host="${PGHOST:-127.0.0.1}" --port="${PGPORT:-5432}" --username="$PGUSER" \
      --dbname=postgres --tuples-only --no-align --command \
      "SELECT count(*) FROM pg_database WHERE datname IN ('${database}','${restore_database}')" 2>/dev/null | grep -qx '0'; then
    echo 'FINANCE_E2E_DISPOSABLE_DATABASE_CLEANUP=PASS'
  else
    echo 'FINANCE_E2E_DISPOSABLE_DATABASE_CLEANUP=FAIL'
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$root"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}"
createdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$database"
export PGDATABASE="$database"
psql --set=ON_ERROR_STOP=1 --file=ops/ci/finance-playwright-bootstrap.sql
psql --set=ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.residents (resident_id text PRIMARY KEY);
CREATE TABLE public.finance_entries (
  finance_entry_id text PRIMARY KEY, entry_type text NOT NULL, category text,
  description text, amount_vnd numeric(18,2) NOT NULL, recognition_date date NOT NULL,
  cash_date date, resident_id text, source_mode text, source_domain text,
  source_entity_type text, source_entity_id text, status text NOT NULL,
  reference_number text, note text, created_by text, created_by_role text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uq_finance_entries_system_source ON public.finance_entries(source_domain,source_entity_type,source_entity_id,entry_type)
WHERE source_mode='SYSTEM' AND source_domain IS NOT NULL AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL;
SQL
for migration in \
  ops/finance/v22/001_finance_foundation.sql \
  ops/finance/v28/002_finance_transaction_safety.sql \
  ops/finance/v29/003_finance_allocation_invariants.sql \
  ops/finance/v29/004_finance_integrity_hardening.sql \
  ops/finance/v30/005_shared_contract_version_history.sql \
  ops/finance/v30/006_shared_contract_signoff_evidence.sql \
  ops/finance/v31/007_finance_invoice_ledger_origin.sql \
  ops/finance/v32/008_discount_and_absence_policy.sql \
  ops/finance/v32/009_service_price_catalog.sql \
  ops/finance/v32/010_immutable_invoice_snapshot.sql \
  ops/finance/v32/011_service_code_mapping.sql \
  ops/finance/v32/012_family_extra_meal_source.sql \
  ops/finance/v32/013_family_meal_invoice_snapshot.sql \
  ops/finance/v42/001_general_workflows.sql
do
  psql --set=ON_ERROR_STOP=1 --file="$migration"
done
psql --set=ON_ERROR_STOP=1 <<'SQL'
INSERT INTO residents VALUES ('RES_V428');
INSERT INTO service_contract_records(contract_id,contract_code,resident_id,status,effective_date,payload,version)
VALUES ('CONTRACT_V428','CONTRACT-V428','RES_V428','ACTIVE','2026-07-01','{"package":"STANDARD"}',1);
INSERT INTO service_contract_versions(contract_id,version,payload,status,effective_date,signed_at,approved_at,approved_by,change_reason)
VALUES ('CONTRACT_V428',1,'{"package":"STANDARD"}','ACTIVE','2026-07-01',now(),now(),'CI_APPROVER','synthetic browser contract');
INSERT INTO service_contract_signing_evidence(contract_id,version,document_sha256,document_reference,signing_method,verified_by,signed_at)
VALUES ('CONTRACT_V428',1,repeat('a',64),'synthetic-v428-document','SIGNED_PAPER_ARCHIVED','CI_APPROVER',now());
INSERT INTO service_contract_approval_decisions(contract_id,version,approved_by,approval_reason,approved_sha256,admission_care_level,room_id,bed_id,monthly_fee_vnd)
VALUES ('CONTRACT_V428',1,'CI_APPROVER','Synthetic browser acceptance contract',repeat('a',64),'STANDARD','ROOM-V428','BED-V428',12000000);
SQL

npm --prefix api ci --ignore-scripts --no-audit --no-fund
npm --prefix api run build
# The Nest incremental build can omit a required module from a clean dist tree.
# Compile the complete configured TypeScript project before starting the actual
# AuthModule, then assert its runtime dependency is present.
node api/node_modules/typescript/bin/tsc -p api/tsconfig.json --incremental false
test -s api/dist/auth/auth.module.js
test -s api/dist/database/database.module.js
echo 'FINANCE_API_CLEAN_DIST_REQUIRED_MODULES=PASS'
npm --prefix frontend ci --ignore-scripts --no-audit --no-fund
frontend/node_modules/.bin/playwright install --with-deps chromium

export FINANCE_E2E_PASSWORD="${FINANCE_E2E_PASSWORD:-synthetic-only-finance-e2e-password}"
node ops/ci/finance-playwright-seed.cjs

umask 077
printf '%s%s%s:%s@%s:%s/%s' 'postgresql' '://' "$PGUSER" "$PGPASSWORD" \
  "$PGHOST" "$PGPORT" "$PGDATABASE" > "$secret_file"
chmod 600 "$secret_file"
export DATABASE_URL_FILE="$secret_file"
export JWT_SECRET='finance-playwright-synthetic-key-only-not-production'
export TAMANCARE_FINANCE_READ_ROLES='ADMIN,SUPERVISOR'
export TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES='ADMIN,SUPERVISOR'
export TAMANCARE_FINANCE_WRITE_ENABLED='true'
export TAMANCARE_FINANCE_WRITE_ROLES='ACCOUNTANT'
export TAMANCARE_FINANCE_BILLING_DRAFT_ROLES='ACCOUNTANT'
export TAMANCARE_FINANCE_INVOICE_REVIEW_ROLES='SUPERVISOR'
export TAMANCARE_FINANCE_INVOICE_APPROVE_ROLES='ADMIN,SUPERVISOR'
export TAMANCARE_FINANCE_INVOICE_ISSUE_ROLES='ADMIN,SUPERVISOR'
export TAMANCARE_FINANCE_RECEIPT_WRITE_ROLES='ACCOUNTANT'
export TAMANCARE_FINANCE_RECEIPT_VERIFY_ROLES='ADMIN,SUPERVISOR'
export TAMANCARE_FINANCE_LEDGER_POST_ROLES='ACCOUNTANT,ADMIN,SUPERVISOR'
export TAMANCARE_FINANCE_ALLOW_UNRECONCILED_CLOSE='true'
export PORT=3000

node ops/ci/finance-playwright-api.cjs >"$api_log" 2>&1 &
api_pid=$!
npm --prefix frontend run dev -- --host 127.0.0.1 >"$vite_log" 2>&1 &
vite_pid=$!

for attempt in $(seq 1 60); do
  if curl --silent --fail http://127.0.0.1:3000/api/health/ready >/dev/null && \
     curl --silent --fail http://127.0.0.1:5173/ >/dev/null; then
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null || ! kill -0 "$vite_pid" 2>/dev/null; then
    echo 'FINANCE_PLAYWRIGHT_APP_START=FAIL'
    if ! kill -0 "$api_pid" 2>/dev/null; then
      echo 'FINANCE_PLAYWRIGHT_API_PROCESS=EXITED'
      set +e
      wait "$api_pid"
      api_exit=$?
      set -e
      echo "FINANCE_PLAYWRIGHT_API_EXIT_CODE=$api_exit"
      grep -Eo 'FINANCE_PLAYWRIGHT_AUTH_MODULE_LOAD_FAILED=[^[:cntrl:]]{1,300}' "$api_log" || true
      grep -Eo 'FINANCE_PLAYWRIGHT_API_START_FAILED=[^[:cntrl:]]{1,300}' "$api_log" || true
      if [[ -s "$api_log" ]]; then
        sed -E \
          -e 's#(postgres(ql)?://)[^[:space:]]+#\1[REDACTED]#Ig' \
          -e 's#((password|token|secret)=?)[^[:space:]&]+#\1[REDACTED]#Ig' \
          "$api_log" | { head -n 4; tail -n 8; } | cut -c1-240
      else
        echo 'FINANCE_PLAYWRIGHT_API_LOG=EMPTY'
      fi
    else
      echo 'FINANCE_PLAYWRIGHT_API_PROCESS=ALIVE'
    fi
    if ! kill -0 "$vite_pid" 2>/dev/null; then
      echo 'FINANCE_PLAYWRIGHT_VITE_PROCESS=EXITED'
      grep -Ei '(^|[[:space:]])(error|failed)(:|[[:space:]])' "$vite_log" | tail -n 3 | cut -c1-240 || true
    else
      echo 'FINANCE_PLAYWRIGHT_VITE_PROCESS=ALIVE'
    fi
    exit 1
  fi
  sleep 1
done
curl --silent --fail http://127.0.0.1:3000/api/health/ready >/dev/null
curl --silent --fail http://127.0.0.1:5173/ >/dev/null
grep -E 'Mapped \{/api/(auth|health|finance)' "$api_log" | cut -c1-200 || echo 'FINANCE_PLAYWRIGHT_ROUTE_MAP=EMPTY'
direct_auth_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST --header 'Content-Type: application/json' --data '{}' \
  http://127.0.0.1:3000/api/auth/login)"
proxy_auth_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST --header 'Content-Type: application/json' --data '{}' \
  http://127.0.0.1:5173/api/auth/login)"
echo "FINANCE_PLAYWRIGHT_AUTH_ROUTE_DIRECT_STATUS=$direct_auth_status"
echo "FINANCE_PLAYWRIGHT_AUTH_ROUTE_VITE_PROXY_STATUS=$proxy_auth_status"
test "$direct_auth_status" = 401
test "$proxy_auth_status" = 401

export FINANCE_E2E_BASE_URL='http://127.0.0.1:5173'
export FINANCE_E2E_MAKER_ID='CI_MAKER'
export FINANCE_E2E_SUBMITTER_ID='CI_SUBMITTER'
export FINANCE_E2E_APPROVER_ID='CI_APPROVER'
export FINANCE_E2E_ACCOUNTANT_ID='CI_ACCOUNTANT'
export FINANCE_E2E_MAKER_PASSWORD="$FINANCE_E2E_PASSWORD"
export FINANCE_E2E_SUBMITTER_PASSWORD="$FINANCE_E2E_PASSWORD"
export FINANCE_E2E_APPROVER_PASSWORD="$FINANCE_E2E_PASSWORD"
export FINANCE_E2E_ACCOUNTANT_PASSWORD="$FINANCE_E2E_PASSWORD"
export FINANCE_E2E_ENVIRONMENT='synthetic-disposable-postgresql-16'
npm --prefix frontend run test:e2e:finance

# Exercise a real PostgreSQL 16 backup and restore using only this run's
# synthetic database. The archive stays outside the checkout and is removed
# by cleanup, including when a later assertion fails.
umask 077
pg_dump --format=custom --file="$restore_archive" --dbname="$database"
test -s "$restore_archive"
createdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$restore_database"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$restore_database" "$restore_archive"
restored_actor_count="$(psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --dbname="$restore_database" --command='SELECT count(*) FROM public.staff_actors')"
restored_table_count="$(psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --dbname="$restore_database" --command="SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
test "$restored_actor_count" = 4
test "$restored_table_count" -gt 0
dropdb --if-exists --maintenance-db=postgres --host="$PGHOST" --port="$PGPORT" \
  --username="$PGUSER" "$restore_database"
rm -f "$restore_archive"
test ! -e "$restore_archive"
echo "FINANCE_E2E_SYNTHETIC_RESTORE=PASS actors=$restored_actor_count tables=$restored_table_count"
