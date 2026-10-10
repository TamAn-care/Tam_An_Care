#!/usr/bin/env bash
# TAMANCARE FINANCE V3.8.18.70 - read-only source mapping, not production release
set -Eeuo pipefail
umask 077
echo "V70_BEGIN=READ_ONLY"
[[ "$(hostname -s)" == "beta-docker" ]] || { echo "SAFE_STOP_WRONG_HOST"; exit 20; }
command -v docker >/dev/null || { echo "SAFE_STOP_DOCKER"; exit 21; }
pg="tamancare-production-test-server-postgres-1"
[[ "$(docker inspect -f '{{.State.Running}}' "$pg" 2>/dev/null || :)" == true ]] || { echo "SAFE_STOP_PG_NOT_RUNNING"; exit 22; }
# No dynamic SQL on untrusted schema names, no rows, PII, financial amounts or secrets.
# psql -X prevents user startup file execution. Enforce read-only at server session level.
docker exec -i "$pg" psql -X -v ON_ERROR_STOP=1 -U taman -d taman_care -P pager=off -P null='NULL' <<'SQL'
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '12s';
SET LOCAL lock_timeout = '2s';
DO $safe$
BEGIN
 IF current_database() <> 'taman_care'
    OR current_user <> 'taman'
    OR current_setting('transaction_read_only') <> 'on'
 THEN RAISE EXCEPTION 'V70_FAIL_CLOSED_DB_IDENTITY'; END IF;
END
$safe$;
SELECT 'V70_IDENTITY_READONLY_PASS' AS gate;
WITH source_map(source_key,relation_name,meaning) AS (
 VALUES
 ('invoices','finance_entries','Finance ledger candidate; invoice origin NOT proven'),
 ('careFees','finance_entries','Finance category candidate; care contract NOT proven'),
 ('leaveAdjustments','resident_leave_requests','Leave eligibility; monetary adjustment NOT proven'),
 ('inventoryConsumption','inventory_transactions','Movements; costing NOT proven'),
 ('inventoryConsumption','resident_consumption_events','Resident consumption; costing NOT proven'),
 ('inventoryConsumption','kitchen_receiving_batch_items','Receiving prices; allocation NOT proven'),
 ('payroll','shift_assignments','Shift evidence; approved payroll NOT proven'),
 ('payroll','staff_actors','Staff identity; approved payroll NOT proven'),
 ('manualVouchers','finance_entries','Manual entry candidate; approval NOT proven'),
 ('otherExpenses','finance_entries','Expense entry candidate; completeness NOT proven')
), discovered AS (
 SELECT m.source_key,m.relation_name,m.meaning,
        (c.oid IS NOT NULL) AS relation_present,
        COALESCE(has_table_privilege(c.oid,'SELECT'),false) AS select_privilege,
        COALESCE(string_agg(a.attname::text,',' ORDER BY a.attnum) FILTER
           (WHERE a.attname ~* '(status|approved|source_|amount|unit_price|occurred_at|recognition_date|resident_id|transaction_type|start_date|end_date)'), '') AS evidence_column_names
 FROM source_map m
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=m.relation_name AND c.relkind IN ('r','p','v')
 LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 GROUP BY m.source_key,m.relation_name,m.meaning,c.oid
)
SELECT source_key,relation_name,relation_present,select_privilege,evidence_column_names,
       'NOT_PROVEN' AS approved_row_proof,
       'NOT_PROVEN' AS finance_origin_reconciliation,
       'NOT_PROVEN' AS monthly_completeness
FROM discovered ORDER BY source_key,relation_name;
SELECT 'V70_SEVEN_SOURCES_OPERATIONAL_READY=NO' AS gate;
COMMIT;
SQL
echo "V70_SCHEMA_CANDIDATE_MAPPING=PASS"
echo "V70_APPROVED_ROWS=NOT_PROVEN"
echo "V70_MONTHLY_COMPLETENESS=NOT_PROVEN"
echo "V70_PROFIT=NOT_CALCULATED"
echo "DB_WRITE=NO MIGRATION=NO SEED=NO DEPLOY=NO POSTGRES_RESTART=NO"
echo "PRODUCTION_GO_NO_GO=NO_GO"
echo "RESULT=TAMANCARE_FINANCE_V381870_READONLY_SCHEMA_MAPPING_PASS"
