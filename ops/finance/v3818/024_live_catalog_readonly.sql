-- V3.8.18.24: finance source catalog ONLY. Execute on intended target
-- via psql -X -v ON_ERROR_STOP=1 --single-transaction (read-only).
-- Does NOT inspect resident/payroll row values or access other database.
SET TRANSACTION READ ONLY;
SELECT current_database() AS database_name,current_user AS database_user,
 current_setting('transaction_read_only') AS read_only;
SELECT n.nspname AS schema_name,c.relname AS relation_name,c.relkind,
 string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod),', ' ORDER BY a.attnum) AS columns,
 has_table_privilege(c.oid,'SELECT') AS can_select,
 has_table_privilege(c.oid,'INSERT') AS can_insert
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE c.relkind IN ('r','p','v','m')
 AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND (c.relname ~* '(finance|payroll|salary|wage|invoice|billing|contract|voucher|expense|receipt|payment|ledger|approval|audit)'
 OR c.relname IN ('auth_sessions','staff_actors'))
GROUP BY n.nspname,c.relname,c.relkind,c.oid
ORDER BY n.nspname,c.relname;
