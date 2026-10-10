#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" = 127.0.0.1 && "$PGDATABASE" = finance_ci && "$PGUSER" = finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/036_ci_atomic_ledger_post.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE origin text; n int;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES ('ci36m','ci36maker','FINANCE_MAKER',now()+interval '1 hour'),
 ('ci36r','ci36review','FINANCE_REVIEWER',now()+interval '1 hour'),
 ('ci36a','ci36approve','FINANCE_APPROVER',now()+interval '1 hour');
 PERFORM finance_manual_v26_ci.create_draft_v29('ci36doc','ci36origin','REVENUE',current_date,350000,
 'SERVICE','Documented service income','ci36source','NOT_APPLICABLE','INTERNAL_VOUCHER',
 repeat('e',64),'ci36review','ci36approve','ci36m');
 BEGIN
 PERFORM finance_manual_v26_ci.post_approved_v36('ci36doc',0,'ci36a');
 RAISE EXCEPTION 'UNAPPROVED_POST_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'INVALID_POSTING_COMMAND' THEN RAISE; END IF; END;
 PERFORM finance_manual_v26_ci.transition_v27('ci36doc',0,'SUBMIT','ci36m','Submit voucher');
 PERFORM finance_manual_v26_ci.transition_v27('ci36doc',1,'REVIEW','ci36r','Review voucher');
 PERFORM finance_manual_v26_ci.transition_v27('ci36doc',2,'APPROVE','ci36a','Approve voucher');
 origin:=finance_manual_v26_ci.post_approved_v36('ci36doc',3,'ci36a');
 IF origin<>'ci36origin' THEN RAISE EXCEPTION 'ORIGIN_MISMATCH'; END IF;
 BEGIN
 PERFORM finance_manual_v26_ci.post_approved_v36('ci36doc',3,'ci36a');
 RAISE EXCEPTION 'DUPLICATE_POST_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'DUPLICATE_POSTING_ORIGIN' THEN RAISE; END IF; END;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.ledger_v36 WHERE financial_origin_key='ci36origin';
 IF n<>1 THEN RAISE EXCEPTION 'LEDGER_CARDINALITY_FAILED'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.posting_audit_v36 WHERE document_id='ci36doc';
 IF n<>1 THEN RAISE EXCEPTION 'POSTING_AUDIT_MISSING'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.ledger_v36 WHERE document_id='ci36doc'
 AND entry_type='REVENUE' AND amount_vnd=350000;
 IF n<>1 THEN RAISE EXCEPTION 'RECOGNITION_MAPPING_FAILED'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.ledger_v36 WHERE document_id='ci36doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.posting_audit_v36 WHERE document_id='ci36doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.posting_claims_v35 WHERE document_id='ci36doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.documents WHERE document_id='ci36doc')
 THEN RAISE EXCEPTION 'ROLLBACK_LEAK'; END IF;
END $$;
SELECT 'FINANCE_V381836_CI_ATOMIC_LEDGER_ROLLBACK_PASS' AS result;
SQL
