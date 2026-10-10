-- V3.8.18.41: schema + key/constraint discovery on existing source tables ONLY.
-- Must execute inside BEGIN READ ONLY with correct DB and user.
DO $$ BEGIN
 IF current_database() <> 'taman_care' OR current_user <> 'taman'
 OR current_setting('transaction_read_only') <> 'on'
 THEN RAISE EXCEPTION 'V41_DATABASE_OR_READONLY_MISMATCH'; END IF;
END $$;
WITH wanted(name) AS (VALUES
 ('finance_entries'),('finance_entry_audit'),('admission_cases'),
 ('admission_care_classifications'),('resident_leave_requests'),
 ('kitchen_receiving_batches'),('kitchen_receiving_batch_items'),
 ('inventory_transactions'),('resident_consumption_events'),
 ('staff_actors'),('auth_sessions'),('finance_manual_documents')
), actual AS (
 SELECT w.name,n.nspname,c.relname,c.oid,c.relkind
 FROM wanted w LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=w.name AND c.relkind IN ('r','p','v','m')
)
SELECT a.name AS source_name,COALESCE(a.relname,'NOT_FOUND') AS table_status,
 a.relkind,
 (SELECT count(*) FROM pg_catalog.pg_attribute x WHERE x.attrelid=a.oid AND x.attnum>0 AND NOT x.attisdropped) AS column_count,
 (SELECT string_agg(x.attname,',' ORDER BY x.attnum) FROM pg_catalog.pg_attribute x WHERE x.attrelid=a.oid AND x.attnum>0 AND NOT x.attisdropped) AS column_names,
 (SELECT string_agg(con.conname::text||':'||con.contype::text,',' ORDER BY con.conname) FROM pg_catalog.pg_constraint con WHERE con.conrelid=a.oid) AS constraints
FROM actual a ORDER BY a.name;
-- No row-level query, no PII, no salaries, no writes.
