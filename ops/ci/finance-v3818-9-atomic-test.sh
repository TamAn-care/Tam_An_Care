#!/usr/bin/env bash
set -euo pipefail
# Github Actions isolated service only. Never connect to live PostgreSQL.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGDATABASE" == finance_ci && "$PGUSER" == finance_ci && "$PGHOST" == 127.0.0.1 ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/009_atomic_ci_commit.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE result text; n int; cursor_value numeric;
BEGIN
 -- Failure after ledger + audit inserts must revert ALL effects.
 BEGIN
 PERFORM finance_sync_ci.commit_verified_ci('BILLING',10,'atomicA','sourceAtomicA','v1',repeat('c',64),
 'REVENUE',DATE '2026-10-01',14500000,true,true,true,true);
 RAISE EXCEPTION 'FAILURE_INJECTION_NOT_TRIGGERED';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM<>'FINANCE_CI_INJECTED_FAILURE' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO n FROM finance_sync_ci.ledger_ci WHERE financial_origin='atomicA';
 IF n<>0 THEN RAISE EXCEPTION 'LEDGER_NOT_ROLLED_BACK'; END IF;
 SELECT count(*) INTO n FROM finance_sync_ci.posting_claims WHERE financial_origin='atomicA';
 IF n<>0 THEN RAISE EXCEPTION 'CLAIM_NOT_ROLLED_BACK'; END IF;
 SELECT count(*) INTO n FROM finance_sync_ci.audit_events WHERE financial_origin='atomicA';
 IF n<>0 THEN RAISE EXCEPTION 'AUDIT_NOT_ROLLED_BACK'; END IF;
 SELECT count(*) INTO n FROM finance_sync_ci.checkpoints WHERE adapter_id='BILLING';
 IF n<>0 THEN RAISE EXCEPTION 'CURSOR_ADVANCED_DURING_FAILURE'; END IF;
 result:=finance_sync_ci.commit_verified_ci('BILLING',10,'atomicA','sourceAtomicA','v1',repeat('c',64),
 'REVENUE',DATE '2026-10-01',14500000,true,true,true,false);
 IF result<>'COMMITTED_CI_ONLY' THEN RAISE EXCEPTION 'COMMIT_FAILED'; END IF;
 result:=finance_sync_ci.commit_verified_ci('BILLING',10,'atomicA','sourceAtomicA','v1',repeat('c',64),
 'REVENUE',DATE '2026-10-01',14500000,true,true,true,false);
 IF result<>'ALREADY_POSTED' THEN RAISE EXCEPTION 'REPLAY_NOT_IDEMPOTENT'; END IF;
 SELECT count(*) INTO n FROM finance_sync_ci.ledger_ci WHERE financial_origin='atomicA';
 IF n<>1 THEN RAISE EXCEPTION 'DUPLICATE_LEDGER'; END IF;
 SELECT cursor_value INTO cursor_value FROM finance_sync_ci.checkpoints WHERE adapter_id='BILLING';
 IF cursor_value<>10 THEN RAISE EXCEPTION 'CURSOR_NOT_ATOMIC'; END IF;
 BEGIN
 PERFORM finance_sync_ci.commit_verified_ci('BILLING',11,'atomicA','sourceAtomicA','v2',repeat('d',64),
 'REVENUE',DATE '2026-10-01',14500000,true,true,true,false);
 RAISE EXCEPTION 'AMENDMENT_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM='AMENDMENT_NOT_BLOCKED' THEN RAISE; END IF;
 END;
 BEGIN
 PERFORM finance_sync_ci.commit_verified_ci('BILLING',11,'atomicB','sourceAtomicB','v1',repeat('e',64),
 'REVENUE',DATE '2026-10-01',200,true,false,true,false);
 RAISE EXCEPTION 'APPROVAL_NOT_BLOCKED';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM='APPROVAL_NOT_BLOCKED' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO n FROM finance_sync_ci.ledger_ci WHERE financial_origin IN ('atomicA','atomicB');
 IF n<>1 THEN RAISE EXCEPTION 'BAD_LEDGER_AFTER_NEGATIVE_TESTS'; END IF;
 SELECT cursor_value INTO cursor_value FROM finance_sync_ci.checkpoints WHERE adapter_id='BILLING';
 IF cursor_value<>10 THEN RAISE EXCEPTION 'CURSOR_ADVANCED_AFTER_NEGATIVE_TESTS'; END IF;
END $$;
SELECT 'FINANCE_V3818_9_ATOMIC_CI_PASS' AS result;
SQL
