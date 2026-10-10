-- Finance V3.8.18.53: COMPLETE public business relation/column catalog, metadata ONLY.
-- Operator runs inside BEGIN TRANSACTION READ ONLY on verified Production Test target.
DO $$ BEGIN
 IF current_database()<>'taman_care' OR current_user<>'taman'
 OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'V53_WRONG_TARGET_OR_NOT_READ_ONLY'; END IF;
END $$;
SELECT c.relname AS table_name,
 CASE c.relkind WHEN 'r' THEN 'TABLE' WHEN 'p' THEN 'PARTITIONED_TABLE'
 WHEN 'v' THEN 'VIEW' ELSE 'MATERIALIZED_VIEW' END AS relation_kind,
 has_table_privilege(c.oid,'SELECT') AS can_select,
 (SELECT count(*) FROM pg_catalog.pg_attribute a
  WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS column_count,
 (SELECT string_agg(a.attname::text,', ' ORDER BY a.attnum)
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS column_names,
 (SELECT count(*) FROM pg_catalog.pg_constraint x
  WHERE x.conrelid=c.oid AND x.contype='f') AS foreign_key_count
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
ORDER BY c.relname;
-- Exposes schema metadata only. Does not read rows, PII or finance amounts.
