-- V3.8.18.40 -- READ-ONLY catalog & constraints; NO business row values.
-- Start with psql -X --single-transaction -v ON_ERROR_STOP=1 (see wrapper).
SET TRANSACTION READ ONLY;
SELECT current_database() AS db,current_user AS db_user,
 current_setting('transaction_read_only') AS read_only;
WITH sources(source_key,search_pattern) AS (
 VALUES ('FINANCE_LEDGER','finance_entries'),
 ('FINANCE_AUDIT','finance_entry_audit'),
 ('ADMISSION','admission_cases'),
 ('CARE_CLASSIFICATION','admission_care_classifications'),
 ('LEAVE','resident_leave_requests'),
 ('KITCHEN_RECEIPTS','kitchen_receiving_batches'),
 ('KITCHEN_ITEMS','kitchen_receiving_batch_items'),
 ('INVENTORY_MOVEMENTS','inventory_transactions'),
 ('RESIDENT_CONSUMPTION','resident_consumption_events'),
 ('STAFF','staff_actors'),
 ('SESSION','auth_sessions'),
 ('MANUAL_VOUCHERS','finance_manual_documents'),
 ('PAYROLL','payroll'),
 ('INVOICES','invoice'),
 ('CONTRACTS','contract')
)
SELECT s.source_key,n.nspname AS schema_name,c.relname AS relation,
 c.relkind AS kind,has_table_privilege(c.oid,'SELECT') AS selectable,
 string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod),', ' ORDER BY a.attnum) AS columns
FROM sources s LEFT JOIN pg_catalog.pg_class c ON
 (CASE WHEN s.source_key IN ('PAYROLL','INVOICES','CONTRACTS')
  THEN c.relname ILIKE '%'||s.search_pattern||'%'
  ELSE c.relname=s.search_pattern END) AND c.relkind IN ('r','p','v','m')
LEFT JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 AND n.nspname NOT IN ('pg_catalog','information_schema')
LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE c.oid IS NULL OR n.oid IS NOT NULL
GROUP BY s.source_key,n.nspname,c.relname,c.relkind,c.oid
ORDER BY s.source_key,n.nspname,c.relname;
