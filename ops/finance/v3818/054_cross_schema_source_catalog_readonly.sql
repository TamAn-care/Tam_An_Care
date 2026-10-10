-- Finance V3.8.18.54 — metadata-only cross-schema canonical-source discovery.
-- Execution contract: BEGIN READ ONLY on beta-docker/taman_care/taman.
DO $$ BEGIN
 IF current_database()<>'taman_care' OR current_user<>'taman'
 OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'V54_READ_ONLY_IDENTITY_REJECTED'; END IF;
END $$;
WITH namespaces AS (
 SELECT n.oid,n.nspname
 FROM pg_catalog.pg_namespace n
 WHERE n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%'
 AND n.nspname NOT LIKE 'pg_temp%'
), relations AS (
 SELECT n.nspname,c.relname,c.relkind,c.oid
 FROM namespaces n JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
 WHERE c.relkind IN ('r','p','v','m')
), candidates AS (
 SELECT r.* FROM relations r
 WHERE r.relname ~* '(contract|agreement|invoice|billing|receivable|payable|salary|payroll|wage|voucher|payment|finance|expense|price|rate|fee|ledger)'
 OR EXISTS (
 SELECT 1 FROM pg_catalog.pg_attribute a
 WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
 AND a.attname ~* '(contract_id|invoice_id|payroll_id|salary_amount|approved_amount|rate_vnd|monthly_fee|voucher_id)'
 )
)
SELECT n.nspname AS schema_name,
 (SELECT count(*) FROM relations r WHERE r.nspname=n.nspname) AS relation_count,
 (SELECT count(*) FROM candidates c WHERE c.nspname=n.nspname) AS finance_candidate_count
FROM namespaces n WHERE EXISTS(SELECT 1 FROM relations r WHERE r.nspname=n.nspname)
ORDER BY n.nspname;
SELECT c.nspname AS schema_name,c.relname AS candidate_relation,
 c.relkind AS relation_kind,
 has_table_privilege(c.oid,'SELECT') AS can_select,
 (SELECT string_agg(a.attname::text,', ' ORDER BY a.attnum)
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  AND a.attname ~* '(contract|invoice|payroll|salary|wage|voucher|payment|finance|expense|price|rate|fee|amount|status|approved|resident|staff|source)'
 ) AS relevant_columns
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p','v','m')
 AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND (
 c.relname ~* '(contract|agreement|invoice|billing|receivable|payable|salary|payroll|wage|voucher|payment|finance|expense|price|rate|fee|ledger)'
 OR EXISTS (
 SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0
 AND NOT a.attisdropped AND a.attname ~* '(contract_id|invoice_id|payroll_id|salary_amount|approved_amount|rate_vnd|monthly_fee|voucher_id)'
 )
 )
ORDER BY n.nspname,c.relname;
