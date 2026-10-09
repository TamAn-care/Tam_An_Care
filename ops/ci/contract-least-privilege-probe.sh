#!/usr/bin/env bash
# Safe PostgreSQL catalog-only probe; self-hosted runner needs NO docker/SSH/sudo.
set -Eeuo pipefail
umask 077
: "${CONTRACT_AUDIT_DATABASE_URL:?CONTRACT_AUDIT_DATABASE_URL_REQUIRED}"
command -v psql >/dev/null || { echo 'PSQL_UNAVAILABLE'; exit 2; }
# Require explicit opt-in and TLS for network database transport.
[[ "${CONTRACT_AUDIT_APPROVED:-}" == "READ_ONLY" ]] || { echo 'AUDIT_NOT_APPROVED'; exit 3; }
[[ "$CONTRACT_AUDIT_DATABASE_URL" == *"sslmode=verify-full"* ]] || { echo 'TLS_VERIFY_FULL_REQUIRED'; exit 4; }
export PGCONNECT_TIMEOUT=8
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000'
# Suppress psql connection diagnostics, which can contain internal hostnames.
if ! output="$(psql -X -q -A -t -v ON_ERROR_STOP=1 "$CONTRACT_AUDIT_DATABASE_URL" 2>/dev/null <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT 'DB_TRANSACTION_READ_ONLY='||current_setting('transaction_read_only');
SELECT 'DB_CONNECTION_TLS='||CASE WHEN EXISTS (
 SELECT 1 FROM pg_stat_ssl WHERE pid=pg_backend_pid() AND ssl
) THEN 'YES' ELSE 'NO' END;
SELECT 'CONTRACT_TABLES='||count(*) FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN (
 'service_contract_records','service_contract_versions',
 'service_contract_signing_evidence','service_contract_approval_decisions');
SELECT 'AUTH_TABLES='||count(*) FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('staff_actors','auth_sessions');
SELECT 'FINANCE_TABLES='||count(*) FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('finance_entries','billing_invoices','billing_invoice_items');
SELECT 'REQUIRED_CONTRACT_COLUMNS='||count(*) FROM information_schema.columns
 WHERE table_schema='public' AND (
 (table_name='service_contract_versions' AND column_name IN
   ('contract_id','version','status','approved_at','signed_at','effective_date')) OR
 (table_name='service_contract_records' AND column_name IN
   ('contract_id','resident_id','status')) );
SELECT 'ROLE_CAN_CREATE_DB='||CASE WHEN has_database_privilege(current_user,current_database(),'CREATE') THEN 'YES' ELSE 'NO' END;
SELECT 'ROLE_CAN_CREATE_SCHEMA='||CASE WHEN has_schema_privilege(current_user,'public','CREATE') THEN 'YES' ELSE 'NO' END;
SELECT 'ROLE_SUPERUSER='||CASE WHEN (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN 'YES' ELSE 'NO' END;
SELECT 'ROLE_WRITABLE_PUBLIC_TABLES='||count(*) FROM pg_class t
 JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='public' AND t.relkind IN ('r','p')
 AND has_table_privilege(current_user,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE');
SELECT 'ROLE_CAN_WRITE_RESIDENTS='||CASE WHEN has_table_privilege(current_user,'public.residents','INSERT,UPDATE,DELETE') THEN 'YES' ELSE 'NO' END;
ROLLBACK;
SQL
)"; then
 echo 'READ_ONLY_DATABASE_CONNECT_OR_QUERY_FAILED'
 exit 5
fi
[[ "$output" == *"DB_TRANSACTION_READ_ONLY=on"* ]] || { echo 'SESSION_NOT_READ_ONLY';exit 6; }
[[ "$output" == *"DB_CONNECTION_TLS=YES"* ]] || { echo 'DB_TLS_NOT_PROVEN';exit 7; }
[[ "$output" == *"ROLE_CAN_CREATE_DB=NO"* && "$output" == *"ROLE_CAN_CREATE_SCHEMA=NO"* && "$output" == *"ROLE_CAN_WRITE_RESIDENTS=NO"* && "$output" == *"ROLE_SUPERUSER=NO"* && "$output" == *"ROLE_WRITABLE_PUBLIC_TABLES=0"* ]] ||
 { echo 'AUDIT_ROLE_OVERPRIVILEGED';exit 8; }
# Only allow known preapproved aggregate output; never expose values from business rows.
while IFS= read -r line;do
 case "$line" in
 DB_TRANSACTION_READ_ONLY=on|DB_CONNECTION_TLS=YES|ROLE_CAN_CREATE_DB=NO|ROLE_CAN_CREATE_SCHEMA=NO|ROLE_CAN_WRITE_RESIDENTS=NO|ROLE_SUPERUSER=NO|ROLE_WRITABLE_PUBLIC_TABLES=0) ;;
 CONTRACT_TABLES=[0-4]|AUTH_TABLES=[0-2]|FINANCE_TABLES=[0-3]|REQUIRED_CONTRACT_COLUMNS=[0-9]|REQUIRED_CONTRACT_COLUMNS=1[0-9]) ;;
 *) echo 'UNEXPECTED_AUDIT_OUTPUT';exit 9 ;;
 esac
done <<< "$output"
printf '%s\n' "$output"
echo 'CONTRACT_METADATA_PROBE=PASS'
echo 'BACKUP_RESTORE_EVIDENCE=NOT_VERIFIED'
echo 'ARCHIVED_SIGNED_DOCUMENTS=NOT_ACCESSED'
echo 'PRODUCTION_DEPLOY=NO'
