#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=finance_ci PGUSER=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == 127.0.0.1 && "$PGDATABASE" == finance_ci && "$PGUSER" == finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/044_ci_manual_idempotency.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE k text;n int;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'NOT_CI'; END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES('ci44m','ci44maker','FINANCE_MAKER',now()+interval '1 hour'),
 ('ci44r','ci44review','FINANCE_REVIEWER',now()+interval '1 hour'),
 ('ci44a','ci44approve','FINANCE_APPROVER',now()+interval '1 hour'),
 ('ci44x','other44','FINANCE_APPROVER',now()+interval '1 hour');
 PERFORM finance_manual_v26_ci.create_draft_v29('ci44doc','ci44origin','PAYROLL',current_date,540000,
 'SALARY','Verified payroll voucher','ci44staff','AGREED_AMOUNT','SIGNED_AGREEMENT',
 repeat('a',64),'ci44review','ci44approve','ci44m');
 PERFORM finance_manual_v26_ci.transition_v27('ci44doc',0,'SUBMIT','ci44m','Submit payroll');
 PERFORM finance_manual_v26_ci.transition_v27('ci44doc',1,'REVIEW','ci44r','Review payroll');
 PERFORM finance_manual_v26_ci.transition_v27('ci44doc',2,'APPROVE','ci44a','Approve payroll');
 BEGIN
 PERFORM finance_manual_v26_ci.manual_post_v44('ci44doc',3,'ci44x');
 RAISE EXCEPTION 'WRONG_ACTOR_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'DOCUMENT_NOT_POSTABLE' THEN RAISE; END IF;END;
 k:=finance_manual_v26_ci.manual_post_v44('ci44doc',3,'ci44a');
 IF k<>'ci44origin' THEN RAISE EXCEPTION 'ORIGIN_NOT_PRESERVED'; END IF;
 BEGIN
 PERFORM finance_manual_v26_ci.manual_post_v44('ci44doc',3,'ci44a');
 RAISE EXCEPTION 'DUPLICATE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'DUPLICATE_MANUAL_ORIGIN' THEN RAISE; END IF;END;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.manual_posting_v44
 WHERE document_id='ci44doc' AND canonical_entry_type='PAYROLL';
 IF n<>1 THEN RAISE EXCEPTION 'WRONG_CANONICAL_TYPE_OR_DUPLICATE'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.manual_posting_v44 WHERE document_id='ci44doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.documents WHERE document_id='ci44doc')
 THEN RAISE EXCEPTION 'ROLLBACK_FAILED'; END IF;
END $$;
SELECT 'TAMANCARE_FINANCE_V381844_MANUAL_IDEMPOTENCY_PASS' AS result;
SQL
