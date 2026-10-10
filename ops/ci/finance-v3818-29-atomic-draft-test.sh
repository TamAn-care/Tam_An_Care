#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == 127.0.0.1 && "$PGUSER" == finance_ci && "$PGDATABASE" == finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/029_isolated_atomic_draft.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE n int; d text;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'UNSAFE_DB'; END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES('ci29_m','maker29','FINANCE_MAKER',now()+interval '1 hour'),
 ('ci29_x','maker29','FINANCE_MAKER',now()-interval '1 hour'),
 ('ci29_n','viewer29','CAREGIVER',now()+interval '1 hour');
 BEGIN
  PERFORM finance_manual_v26_ci.create_draft_v29('d29','origin29','REVENUE',current_date,50000,'SERVICE','Internal receipt','r29','NOT_APPLICABLE','INTERNAL_VOUCHER',NULL,'review29','director29','ci29_x');
  RAISE EXCEPTION 'EXPIRED_SHOULD_FAIL';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='EXPIRED_SHOULD_FAIL' THEN RAISE; END IF; END;
 BEGIN
  PERFORM finance_manual_v26_ci.create_draft_v29('d29','origin29','REVENUE',current_date,50000,'SERVICE','Internal receipt','r29','NOT_APPLICABLE','INTERNAL_VOUCHER',NULL,'review29','director29','ci29_n');
  RAISE EXCEPTION 'ROLE_SHOULD_FAIL';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='ROLE_SHOULD_FAIL' THEN RAISE; END IF; END;
 d:=finance_manual_v26_ci.create_draft_v29('d29','origin29','REVENUE',current_date,50000,'SERVICE','Internal receipt','r29','NOT_APPLICABLE','INTERNAL_VOUCHER',NULL,'review29','director29','ci29_m');
 IF d<>'d29' THEN RAISE EXCEPTION 'CREATE_DRAFT_FAILED'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.audit WHERE document_id='d29' AND action='CREATE_DRAFT' AND document_revision=0;
 IF n<>1 THEN RAISE EXCEPTION 'INITIAL_AUDIT_MISSING'; END IF;
 BEGIN
  PERFORM finance_manual_v26_ci.create_draft_v29('d30','origin29','REVENUE',current_date,50000,'SERVICE','Internal receipt','r29','NOT_APPLICABLE','INTERNAL_VOUCHER',NULL,'review29','director29','ci29_m');
  RAISE EXCEPTION 'DUPLICATE_ORIGIN_SHOULD_FAIL';
 EXCEPTION WHEN unique_violation THEN NULL;
 WHEN OTHERS THEN RAISE; END;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.documents WHERE financial_origin_key='origin29';
 IF n<>1 THEN RAISE EXCEPTION 'ORIGIN_DUPLICATED'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.documents WHERE document_id IN ('d29','d30'))
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.audit WHERE document_id IN ('d29','d30'))
 THEN RAISE EXCEPTION 'ROLLBACK_FAILED'; END IF;
END $$;
SELECT 'FINANCE_V381829_ATOMIC_DRAFT_ROLLBACK_CI_PASS' AS result;
SQL
