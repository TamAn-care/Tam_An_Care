#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
run_id="${GITHUB_RUN_ID:-local-${RANDOM}}-${GITHUB_RUN_ATTEMPT:-1}"
database="finance_e2e_${run_id//[^a-zA-Z0-9_]/_}"
secret_file="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/finance-e2e-database-url-${run_id}"
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
      --username="$PGUSER" "$database" >/dev/null 2>&1 || status=1
  else
    psql --host="${PGHOST:-127.0.0.1}" --port="${PGPORT:-5432}" --username="$PGUSER" \
      --dbname=postgres --set=ON_ERROR_STOP=1 -c \
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid<>pg_backend_pid(); DROP DATABASE IF EXISTS \"${database}\";" \
      >/dev/null 2>&1 || status=1
  fi
  rm -f "$secret_file"
  if psql --host="${PGHOST:-127.0.0.1}" --port="${PGPORT:-5432}" --username="$PGUSER" \
      --dbname=postgres --tuples-only --no-align --command \
      "SELECT count(*) FROM pg_database WHERE datname='${database}'" 2>/dev/null | grep -qx '0'; then
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
psql --set=ON_ERROR_STOP=1 --file=ops/finance/v32/009_service_price_catalog.sql

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
