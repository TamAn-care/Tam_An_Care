#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
temp_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/taman-compose-secret-test.XXXXXX")"
created_api_env=0
cleanup() {
  if [[ "$created_api_env" == 1 ]]; then
    rm -f "$repo_root/api/.env"
  fi
  rm -rf "$temp_root"
}
trap cleanup EXIT

umask 077
printf '%s' 'synthetic-ci-password-only' > "$temp_root/postgres-password"
printf '%s://%s:%s@%s:%s/%s' 'postgresql' 'synthetic_ci' 'synthetic-ci-password-only' 'postgres' '5432' 'synthetic_ci' > "$temp_root/database-url"

if [[ ! -e "$repo_root/api/.env" ]]; then
  : > "$repo_root/api/.env"
  chmod 600 "$repo_root/api/.env"
  created_api_env=1
fi

export TAMANCARE_POSTGRES_PASSWORD_FILE="$temp_root/postgres-password"
export TAMANCARE_DATABASE_URL_FILE="$temp_root/database-url"
if ! docker compose -f "$repo_root/docker-compose.production-test.yml" config -q >"$temp_root/compose-validation-output" 2>&1; then
  echo 'COMPOSE_SYNTHETIC_SECRET_VALIDATION=FAIL'
  exit 1
fi
if grep -Eq 'synthetic-ci-password-only|synthetic_ci' "$temp_root/compose-validation-output"; then
  echo 'COMPOSE_SECRET_LEAKED_TO_OUTPUT=FAIL'
  exit 1
fi

unset TAMANCARE_DATABASE_URL_FILE
if docker compose -f "$repo_root/docker-compose.production-test.yml" config -q 2>"$temp_root/missing-secret-error"; then
  echo 'MISSING_DATABASE_URL_SECRET=UNEXPECTED_SUCCESS'
  exit 1
fi
if ! grep -q 'TAMANCARE_DATABASE_URL_FILE' "$temp_root/missing-secret-error"; then
  echo 'MISSING_DATABASE_URL_SECRET=FAILED_FOR_UNEXPECTED_REASON'
  exit 1
fi

# Validate the production Compose source with disposable secret files and paths only.
export TAMANCARE_POSTGRES_PASSWORD_FILE="$temp_root/postgres-password"
export TAMANCARE_DATABASE_URL_FILE="$temp_root/database-url"
printf '%s' 'synthetic-jwt-secret-only' > "$temp_root/jwt-secret"
chmod 600 "$temp_root/jwt-secret"
export TAMANCARE_JWT_SECRET_FILE="$temp_root/jwt-secret"
export POSTGRES_DB=synthetic_ci POSTGRES_USER=synthetic_ci
export CORS_ORIGIN=https://synthetic.invalid
export TAMANCARE_SERVER_NAME=synthetic.invalid
export TAMANCARE_WEB_DIST="$temp_root/web"
export TAMANCARE_TLS_DIR="$temp_root/tls"
export TAMANCARE_ACME_DIR="$temp_root/acme"
mkdir -p "$TAMANCARE_WEB_DIST" "$TAMANCARE_TLS_DIR" "$TAMANCARE_ACME_DIR"
if ! docker compose -f "$repo_root/deploy/production/docker-compose.production.yml" config -q >"$temp_root/production-compose-validation-output" 2>&1; then
  echo 'PRODUCTION_COMPOSE_SYNTHETIC_SECRET_VALIDATION=FAIL'
  exit 1
fi
if grep -Eq 'synthetic-ci-password-only|synthetic_ci:synthetic-ci-password-only|synthetic-jwt-secret-only' "$temp_root/production-compose-validation-output"; then
  echo 'PRODUCTION_COMPOSE_SECRET_LEAKED_TO_OUTPUT=FAIL'
  exit 1
fi

echo 'PRODUCTION_COMPOSE_SYNTHETIC_SECRET_VALIDATION=PASS'
echo 'COMPOSE_SYNTHETIC_SECRET_VALIDATION=PASS'
echo 'MISSING_DATABASE_URL_SECRET_FAIL_CLOSED=PASS'
