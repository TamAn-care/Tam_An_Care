#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=finance_ci PGUSER=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" = 127.0.0.1 && "$PGDATABASE" = finance_ci && "$PGUSER" = finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/047_ci_cross_channel_origin_registry.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE n int;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF;
 PERFORM finance_manual_v26_ci.register_origin_v47('ci47_same_origin','SYSTEM','CARE','INVOICE','invoice47','REVENUE',NULL);
 BEGIN
 PERFORM finance_manual_v26_ci.register_origin_v47('ci47_same_origin','MANUAL','MANUAL_VOUCHER','FINANCE_MANUAL_DOCUMENT','voucher47','REVENUE','document47');
 RAISE EXCEPTION 'CROSS_CHANNEL_DUPLICATE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CROSS_CHANNEL_ORIGIN_ALREADY_REGISTERED' THEN RAISE; END IF; END;
 PERFORM finance_manual_v26_ci.register_origin_v47('ci47_other_origin','MANUAL','MANUAL_VOUCHER','FINANCE_MANUAL_DOCUMENT','voucher48','DIRECT_COST','document48');
 BEGIN
 PERFORM finance_manual_v26_ci.register_origin_v47('ci47_other_origin','SYSTEM','CARE','INVOICE','invoice48','DIRECT_COST',NULL);
 RAISE EXCEPTION 'REVERSE_CHANNEL_DUPLICATE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CROSS_CHANNEL_ORIGIN_ALREADY_REGISTERED' THEN RAISE; END IF; END;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.origin_registry_v47
 WHERE origin_key IN ('ci47_same_origin','ci47_other_origin');
 IF n<>2 THEN RAISE EXCEPTION 'ORIGIN_CARDINALITY_FAILED'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.origin_registry_v47 WHERE origin_key LIKE 'ci47_%') THEN RAISE EXCEPTION 'ROLLBACK_LEAK'; END IF; END $$;
SELECT 'TAMANCARE_FINANCE_V381847_ORIGIN_GUARD_PASS' AS result;
SQL
