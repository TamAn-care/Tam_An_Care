#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == 127.0.0.1 && "$PGUSER" == finance_ci && "$PGDATABASE" == finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/032_candidate_ci_only_migration.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE n int;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'UNSAFE_DATABASE'; END IF;
 SELECT count(*) INTO n FROM information_schema.tables
 WHERE table_schema='finance_manual_canonical' AND table_name IN('documents','audit');
 IF n<>2 THEN RAISE EXCEPTION 'SCHEMA_INCOMPLETE'; END IF;
 SELECT count(*) INTO n FROM finance_manual_canonical.documents;
 IF n<>0 THEN RAISE EXCEPTION 'BUSINESS_DATA_PRESENT'; END IF;
END $$;
COMMIT;
SQL
# Independently verify the guarded migration fails closed when repeated.
if psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/032_candidate_ci_only_migration.sql >/dev/null 2>&1; then
 echo "REPEAT_MIGRATION_SHOULD_FAIL" >&2
 exit 1
fi
# Schema rollback exercised only in ephemeral CI DB: no application data ever inserted.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
BEGIN
 IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN RAISE EXCEPTION 'UNSAFE_ROLLBACK'; END IF;
 IF EXISTS(SELECT 1 FROM finance_manual_canonical.documents) OR
 EXISTS(SELECT 1 FROM finance_manual_canonical.audit) THEN RAISE EXCEPTION 'ROLLBACK_REQUIRES_EMPTY_TABLES'; END IF;
END $$;
DROP SCHEMA finance_manual_canonical CASCADE;
COMMIT;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='finance_manual_canonical')
 THEN RAISE EXCEPTION 'ROLLBACK_FAILED'; END IF;
END $$;
SELECT 'FINANCE_V381832_ISOLATED_MIGRATION_ROLLBACK_PASS' AS result;
SQL
