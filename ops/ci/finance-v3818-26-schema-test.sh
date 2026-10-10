#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=finance_ci PGUSER=finance_ci PGPASSWORD=finance_ci_only
test "$PGHOST" = 127.0.0.1
test "$PGDATABASE" = finance_ci
test "$PGUSER" = finance_ci
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/026_candidate_manual_finance_isolated.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN TRANSACTION READ ONLY;
DO $$
DECLARE n integer;
BEGIN
 IF current_database()<>'finance_ci' OR current_setting('transaction_read_only')<>'on' THEN
  RAISE EXCEPTION 'ISOLATION_IDENTITY_FAILED';
 END IF;
 SELECT count(*) INTO n FROM information_schema.tables
 WHERE table_schema='finance_manual_v26_ci'
 AND table_name IN ('documents','audit','payroll_components');
 IF n<>3 THEN RAISE EXCEPTION 'CANONICAL_TABLE_COVERAGE_FAILED'; END IF;
 SELECT count(*) INTO n FROM pg_catalog.pg_constraint c
 JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
 JOIN pg_catalog.pg_namespace s ON s.oid=t.relnamespace
 WHERE s.nspname='finance_manual_v26_ci' AND t.relname='documents'
 AND c.contype IN ('p','u','c');
 IF n<7 THEN RAISE EXCEPTION 'DOCUMENT_CONSTRAINTS_INCOMPLETE'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.documents;
 IF n<>0 THEN RAISE EXCEPTION 'NO_BUSINESS_ROWS_ALLOWED_IN_SCHEMA_CI'; END IF;
END $$;
COMMIT;
SELECT 'FINANCE_V381826_ISOLATED_SCHEMA_CONTRACT_PASS' AS result;
SQL
