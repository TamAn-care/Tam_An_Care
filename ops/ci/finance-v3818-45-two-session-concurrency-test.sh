#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:=127.0.0.1}" "${PGDATABASE:=finance_ci}" "${PGUSER:=finance_ci}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "finance_ci" && "$PGUSER" == "finance_ci" ]] || { echo CI_ONLY; exit 1; }
export PGHOST PGDATABASE PGUSER
export PGPORT=5432 PGPASSWORD=finance_ci_only
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/045_ci_concurrency_fixture.sql >/dev/null
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Session A locks document before posting; session B must wait for A's commit.
(
 psql -X -v ON_ERROR_STOP=1 -At <<'SQL'
BEGIN;
SET LOCAL lock_timeout='15s';
SELECT 1 FROM finance_manual_v26_ci.documents WHERE document_id='ci45doc' FOR UPDATE;
SELECT pg_sleep(2);
SELECT finance_manual_v26_ci.manual_post_v44('ci45doc',3,'ci45a');
COMMIT;
SQL
) >"$work/a.out" 2>"$work/a.err" &
a=$!
sleep 0.3
(
 psql -X -v ON_ERROR_STOP=1 -At <<'SQL'
BEGIN;
SET LOCAL lock_timeout='15s';
SELECT finance_manual_v26_ci.manual_post_v44('ci45doc',3,'ci45a');
COMMIT;
SQL
) >"$work/b.out" 2>"$work/b.err" &
b=$!
wait "$a"; ra=$?
set +e
wait "$b"; rb=$?
set -e
[[ "$ra" -eq 0 && "$rb" -ne 0 ]] || { echo "CONCURRENCY_UNEXPECTED_STATUS A=$ra B=$rb"; cat "$work/a.err" "$work/b.err"; exit 1; }
grep -q 'DUPLICATE_MANUAL_ORIGIN' "$work/b.err" || { echo CONCURRENCY_UNEXPECTED_REJECTION; cat "$work/b.err"; exit 1; }
psql -X -v ON_ERROR_STOP=1 -At <<'SQL' | grep -qx '1|1|PAYROLL'
SELECT (SELECT count(*) FROM finance_manual_v26_ci.manual_posting_v44 WHERE voucher_origin_key='ci45origin'),
(SELECT count(*) FROM finance_manual_v26_ci.manual_posting_v44 WHERE document_id='ci45doc'),
(SELECT canonical_entry_type FROM finance_manual_v26_ci.manual_posting_v44 WHERE voucher_origin_key='ci45origin');
SQL
echo TAMANCARE_FINANCE_V381845_TWO_SESSION_DUPLICATE_PROTECTION_PASS
