-- TAM AN CARE / FINANCE / READ-ONLY live metadata inspection.
-- PostgreSQL: SELECT statements only, no migration, no seed, no business rows.
-- Run manually on existing Production Test only after identifying safe read-only credentials.
-- Reconcile canonical contract and ledger source keys BEFORE allowing Finance writes.
BEGIN READ ONLY;
SELECT current_setting('server_version') AS postgres_version,
       current_database() AS database_name;
SELECT table_schema,table_name
FROM information_schema.tables
WHERE table_schema='public' AND
 (table_name ~* '(contract|billing|finance|admission|resident|payment|receipt)')
ORDER BY table_name;
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
AND table_name ~* '(contract|billing|finance|admission|resident|payment|receipt)'
ORDER BY table_name,ordinal_position;
SELECT tc.table_name,tc.constraint_name,tc.constraint_type,
       string_agg(kcu.column_name,',' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
 ON kcu.constraint_catalog=tc.constraint_catalog
AND kcu.constraint_schema=tc.constraint_schema
AND kcu.constraint_name=tc.constraint_name
AND kcu.table_name=tc.table_name
WHERE tc.table_schema='public'
AND tc.table_name ~* '(contract|billing|finance|admission|resident|payment|receipt)'
GROUP BY tc.table_name,tc.constraint_name,tc.constraint_type
ORDER BY tc.table_name,tc.constraint_name;
SELECT schemaname,tablename,indexname,indexdef
FROM pg_indexes WHERE schemaname='public'
AND tablename ~* '(contract|billing|finance|admission|resident|payment|receipt)'
ORDER BY tablename,indexname;
ROLLBACK;
