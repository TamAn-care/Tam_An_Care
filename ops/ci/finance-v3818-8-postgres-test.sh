#!/usr/bin/env bash
set -euo pipefail
# CI ONLY: hard-fail unless connected to isolated PostgreSQL.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == 127.0.0.1 && "$PGDATABASE" == finance_ci && "$PGUSER" == finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/008_isolated_checkpoint_claims.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE a text; b text; n bigint; c bigint;
BEGIN
 a:=finance_sync_ci.claim_source('BILLING',1,'financialA','sourceA','v1',repeat('a',64));
 IF a<>'CLAIM_ONLY_CURSOR_UNCHANGED' THEN RAISE EXCEPTION 'CLAIM_STATUS'; END IF;
 b:=finance_sync_ci.claim_source('BILLING',1,'financialA','sourceA','v1',repeat('a',64));
 SELECT count(*) INTO n FROM finance_sync_ci.posting_claims;
 SELECT count(*) INTO c FROM finance_sync_ci.checkpoints;
 IF n<>1 OR c<>0 THEN RAISE EXCEPTION 'DUPLICATE_OR_CURSOR_ADVANCED'; END IF;
 BEGIN
  PERFORM finance_sync_ci.claim_source('BILLING',2,'financialA','sourceB','v1',repeat('b',64));
  RAISE EXCEPTION 'CONFLICT_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='CONFLICT_NOT_BLOCKED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM finance_sync_ci.claim_source('BILLING',2,'financialA','sourceA','v2',repeat('b',64));
  RAISE EXCEPTION 'AMEND_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='AMEND_NOT_BLOCKED' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO n FROM finance_sync_ci.posting_claims;
 IF n<>1 THEN RAISE EXCEPTION 'FAILED_CLAIM_PERSISTED'; END IF;
END $$;
SELECT 'FINANCE_V3818_8_ISOLATED_POSTGRES_CLAIM_PASS' AS result;
SQL
