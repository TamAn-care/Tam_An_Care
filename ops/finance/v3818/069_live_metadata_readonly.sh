#!/usr/bin/env bash
# Finance V3.8.18.69: Production Test provenance metadata only; NO DATA ROWS.
set -Eeuo pipefail
umask 077
say(){ printf '%s\n' "$*"; }
say 'GATE69_START=READ_ONLY'
[[ "$(hostname -s)" == "beta-docker" ]] || { say 'RESULT=SAFE_STOP_WRONG_HOST'; exit 20; }
command -v docker >/dev/null || { say 'RESULT=SAFE_STOP_DOCKER_UNAVAILABLE'; exit 21; }
command -v git >/dev/null || { say 'RESULT=SAFE_STOP_GIT_UNAVAILABLE'; exit 22; }
api=tamancare-production-test-server-api-1
pg=tamancare-production-test-server-postgres-1
for name in "$api" "$pg"; do
  [[ "$(docker inspect --format '{{.State.Running}}' "$name" 2>/dev/null || :)" == true ]] || {
    say "RESULT=SAFE_STOP_MISSING_CONTAINER:$name"; exit 23;
  }
  docker inspect --format 'CONTAINER={{.Name}} IMAGE_ID={{.Image}}' "$name"
done
for repo in /home/ag/tamancare-antigravity /home/ag/tamancare-finance-safe/workspaces/finance-pnl-20261007_143559; do
 if [[ -d "$repo/.git" ]]; then
   say "SOURCE_PATH=$repo"
   git -C "$repo" rev-parse --verify HEAD | sed 's/^/SOURCE_SHA=/'
   say "TRACKED_DIRTY_FILES=$(git -C "$repo" status --porcelain --untracked-files=no | wc -l | tr -d ' ')"
 fi
done
# No row contents, counts or secret environment values. Transaction is READ ONLY.
sql=$(cat <<'SQL'
\\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
DO $guard$
BEGIN
 IF current_database() <> 'taman_care' OR current_user <> 'taman'
 OR current_setting('transaction_read_only') <> 'on'
 THEN RAISE EXCEPTION 'V69_TARGET_IDENTITY_OR_READONLY_FAIL'; END IF;
END
$guard$;
SELECT 'V69_DB_IDENTITY_PASS' AS gate;
SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind AS kind,
       array_to_string(ARRAY(SELECT a.attname::text FROM pg_catalog.pg_attribute a
       WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
       ORDER BY a.attnum),',') AS column_names
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND c.relkind IN ('r','p','v','m')
ORDER BY n.nspname,c.relname
LIMIT 600;
COMMIT;
SQL
)
# Use explicit known database identity, no credentials printed. Do not fall back to another DB.
if ! printf '%s\n' "$sql" | docker exec -i "$pg" psql -X -q -v ON_ERROR_STOP=1 -U taman -d taman_care -P pager=off; then
 say 'RESULT=SAFE_STOP_PSQL_IDENTITY_OR_AUTH_OR_SCHEMA_FAIL'
 exit 24
fi
say 'GATE69_METADATA_READ_ONLY=PASS'
say 'GATE69_7_SOURCE_ROW_LEVEL_PROOF=NOT_PROVEN'
say 'GATE69_RUNTIME_SOURCE_PARITY=NOT_PROVEN'
say 'DATABASE_WRITE=NO'
say 'MIGRATION=NO'
say 'SEED=NO'
say 'DEPLOY=NO'
say 'POSTGRES_RESTART=NO'
say 'DOCKER_VOLUME_CHANGE=NO'
say 'PRODUCTION_GO_NO_GO=NO_GO'
say 'RESULT=TAMANCARE_FINANCE_V381869_METADATA_AUDIT_PASS'
