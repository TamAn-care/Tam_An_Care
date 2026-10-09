#!/usr/bin/env bash
# Explicit operator-run on Production Test SERVER, not GitHub runner.
# READ-ONLY. No SSH setup, restart, backup creation, migration, seed or business-row reads.
set -Eeuo pipefail
umask 077
OUT="${1:-$HOME/contract_runtime_readonly_report.txt}"
if [[ -e "$OUT" ]]; then echo "REFUSE_OVERWRITE_EXISTING_REPORT"; exit 2; fi
tmp="$(mktemp "${TMPDIR:-/tmp}/tamancare-contract-audit.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
{
 echo 'TAMANCARE_CONTRACT_RUNTIME_READONLY_AUDIT_V1'
 echo 'SCHEMA_SOURCE=LIVE_METADATA_ONLY'
 echo "AUDIT_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
 echo "HOST_DOCKER_ACCESS=$(docker info >/dev/null 2>&1 && echo YES || echo NO)"
 echo '=== CONTAINER STATES (names and running flags only) ==='
 docker ps --format '{{.Names}} {{.State}}' | grep -Ei 'postgres|api|frontend|nginx' || true
 echo '=== ARCHIVE CONFIGURATION (no paths, secrets or filenames) ==='
 for ct in $(docker ps --format '{{.Names}}' | grep -Ei 'api|backend' || true);do
  docker inspect "$ct" --format '{{range .Config.Env}}{{println .}}{{end}}' |
    awk -F= '/^TAMANCARE_CONTRACT_ARCHIVE_ROOT=/{print "ARCHIVE_ROOT_ENV_PRESENT=" (length($2)>0?"YES":"NO")}' || true
 done
 echo '=== DATABASE SCHEMA METADATA ==='
 pg="$(docker ps --format '{{.Names}}' | grep -E 'postgres' | head -n1)"
 if [[ -z "$pg" ]];then echo 'POSTGRES_NOT_FOUND'; exit 3;fi
 docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$pg" sh -c '
  exec psql -X -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"
 ' <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT 'PG_VERSION='||current_setting('server_version');
SELECT 'TABLE='||table_schema||'.'||table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name ~* '(contract|billing|finance|auth_sessions|staff_actors|admission|bed_assignments)'
 ORDER BY table_name;
SELECT 'COLUMN='||table_name||'.'||column_name||':'||data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name ~* '(contract|billing|finance|auth_sessions|staff_actors)'
 ORDER BY table_name,ordinal_position;
SELECT 'CONSTRAINT='||table_name||'.'||constraint_name||':'||constraint_type
 FROM information_schema.table_constraints WHERE table_schema='public'
 AND table_name ~* '(contract|billing|finance)' ORDER BY table_name,constraint_name;
ROLLBACK;
SQL
 echo '=== BACKUP EVIDENCE ==='
 echo 'BACKUP_FILES_AND_RESTORE_LOGS=NOT_ACCESSED'
 echo 'BACKUP_RESTORE_DRILL=NOT_PERFORMED'
 echo 'SIGNED_CONTRACT_BYTES=NOT_ACCESSED'
 echo 'PERSONAL_DATA_ROWS_READ=NO'
 echo 'DATABASE_WRITE=NO'
 echo 'SEED=NO'
 echo 'MIGRATION=NO'
 echo 'DEPLOY=NO'
 echo 'RESULT=RUNTIME_METADATA_AUDIT_COMPLETE'
} > "$tmp" 2>&1
mv -n "$tmp" "$OUT"
chmod 600 "$OUT"
trap - EXIT
echo "AUDIT_COMPLETED_REPORT=$OUT"
echo "PRODUCTION_DEPLOY=NO"
