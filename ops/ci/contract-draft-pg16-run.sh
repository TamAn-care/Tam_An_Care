#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

: "${PGHOST:?PGHOST_REQUIRED}"
: "${PGPORT:?PGPORT_REQUIRED}"
: "${PGUSER:?PGUSER_REQUIRED}"
: "${PGDATABASE:?PGDATABASE_REQUIRED}"

case "$PGHOST" in
  127.0.0.1|localhost) ;;
  *)
    echo "SAFE_STOP=NON_LOOPBACK_DATABASE"
    exit 1
    ;;
esac

case "$PGDATABASE" in
  contract_ci_*) ;;
  *)
    echo "SAFE_STOP=NON_CI_DATABASE_NAME"
    exit 1
    ;;
esac

echo "POSTGRES_TARGET=LOCAL_CI_ONLY"

psql -X -q -v ON_ERROR_STOP=1 \
  -c "SELECT 1" >/dev/null

for migration in \
  ops/finance/v22/001_finance_foundation.sql \
  ops/finance/v28/002_finance_transaction_safety.sql \
  ops/finance/v29/003_finance_allocation_invariants.sql \
  ops/finance/v29/004_finance_integrity_hardening.sql \
  ops/finance/v30/005_shared_contract_version_history.sql \
  ops/finance/v30/006_shared_contract_signoff_evidence.sql
do
  psql -X -q -v ON_ERROR_STOP=1 \
    -f "$ROOT/$migration"
done

echo "CANONICAL_MIGRATIONS=PASS"

psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.auth_sessions (
  session_id text PRIMARY KEY,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL
);

CREATE TABLE public.residents (
  resident_id text PRIMARY KEY
);

INSERT INTO public.auth_sessions VALUES
('TEST_ACTIVE','TEST_ACTOR','ACCOUNTANT',
 NULL,now()+interval '1 hour'),
('TEST_CARE','TEST_ACTOR','CAREGIVER',
 NULL,now()+interval '1 hour'),
('TEST_REVOKED','TEST_ACTOR','ACCOUNTANT',
 now(),now()+interval '1 hour');

INSERT INTO public.residents VALUES ('TEST_RESIDENT_1');
SQL

echo "SYNTHETIC_FIXTURES=PASS"

CONTRACT_LAB_PGPORT="$PGPORT" \
  node "$ROOT/ops/ci/contract-draft-pg-http.cjs"

echo "RESULT=CONTRACT_DRAFT_PG16_CI_PASS"

echo "GATE_SIGNOFF - SYNTHETIC E2E"

SIGNOFF_DB="${PGDATABASE}_signoff"

case "$SIGNOFF_DB" in
  contract_ci_*_signoff) ;;
  *)
    echo "SAFE_STOP=INVALID_SIGNOFF_DATABASE"
    exit 1
    ;;
esac

createdb \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
  -T template0 "$SIGNOFF_DB"

export PGDATABASE="$SIGNOFF_DB"

for migration in \
  ops/finance/v22/001_finance_foundation.sql \
  ops/finance/v28/002_finance_transaction_safety.sql \
  ops/finance/v29/003_finance_allocation_invariants.sql \
  ops/finance/v29/004_finance_integrity_hardening.sql \
  ops/finance/v30/005_shared_contract_version_history.sql \
  ops/finance/v30/006_shared_contract_signoff_evidence.sql
do
  psql -X -q -v ON_ERROR_STOP=1 \
    -f "$ROOT/$migration"
done

echo "CONTRACT_SIGNOFF_SEPARATE_DB=PASS"

psql -X -q -v ON_ERROR_STOP=1 \
 -f "$ROOT/ops/ci/contract-signoff-fixtures.sql"

ARCHIVE="$(mktemp -d)"
trap 'rm -rf "$ARCHIVE"' EXIT

python3 - "$ARCHIVE" <<'PYTHON'
from pathlib import Path
import sys
root=Path(sys.argv[1])
data=(
 b'%PDF-1.4\n'
 b'1 0 obj << /Type /Catalog >> endobj\n'
 b'%%EOF\n'
)
(root/"TEST_SIGNED.pdf").write_bytes(data)
PYTHON

PDF_SHA="$(
 shasum -a 256 "$ARCHIVE/TEST_SIGNED.pdf" |
 awk '{print $1}'
)"

test "${#PDF_SHA}" -eq 64

FINANCE_WORKTREE="$ROOT" \
FINANCE_LAB_PORT="$PGPORT" \
FINANCE_TEST_PDF_SHA="$PDF_SHA" \
TAMANCARE_CONTRACT_ARCHIVE_ROOT="$ARCHIVE" \
node "$ROOT/ops/ci/contract-signoff-pg-http.cjs"

echo "RESULT=CONTRACT_SIGNOFF_PG16_CI_PASS"
