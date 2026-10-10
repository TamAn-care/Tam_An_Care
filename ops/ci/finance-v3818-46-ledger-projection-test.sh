#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=finance_ci PGUSER=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" = 127.0.0.1 && "$PGDATABASE" = finance_ci && "$PGUSER" = finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/046_ci_ledger_projection.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE id text;n int;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES('ci46m','ci46maker','FINANCE_MAKER',now()+interval '1 hour'),
 ('ci46r','ci46review','FINANCE_REVIEWER',now()+interval '1 hour'),
 ('ci46a','ci46approve','FINANCE_APPROVER',now()+interval '1 hour');
 PERFORM finance_manual_v26_ci.create_draft_v29('ci46doc','ci46origin','PAYROLL',DATE '2026-09-25',540000,
 'SALARY','Payroll agreement amount','ci46staff','AGREED_AMOUNT','SIGNED_AGREEMENT',
 repeat('c',64),'ci46review','ci46approve','ci46m');
 PERFORM finance_manual_v26_ci.transition_v27('ci46doc',0,'SUBMIT','ci46m','Submitted');
 PERFORM finance_manual_v26_ci.transition_v27('ci46doc',1,'REVIEW','ci46r','Reviewed');
 PERFORM finance_manual_v26_ci.transition_v27('ci46doc',2,'APPROVE','ci46a','Approved');
 BEGIN
 PERFORM finance_manual_v26_ci.project_manual_v46('ci46doc',3,'ci46a');
 RAISE EXCEPTION 'MISSING_CLAIM_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'POSTING_CLAIM_NOT_VERIFIED' THEN RAISE; END IF; END;
 PERFORM finance_manual_v26_ci.manual_post_v44('ci46doc',3,'ci46a');
 id:=finance_manual_v26_ci.project_manual_v46('ci46doc',3,'ci46a');
 IF id<>'MANUAL_ci46doc' THEN RAISE EXCEPTION 'ENTRY_ID_MISMATCH'; END IF;
 BEGIN
 PERFORM finance_manual_v26_ci.project_manual_v46('ci46doc',3,'ci46a');
 RAISE EXCEPTION 'DUPLICATE_PROJECTION_ACCEPTED';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.ledger_projection_v46
 WHERE finance_entry_id=id AND entry_type='PAYROLL' AND amount_vnd=540000
 AND recognition_date=DATE '2026-09-25' AND source_mode='MANUAL' AND status='POSTED';
 IF n<>1 THEN RAISE EXCEPTION 'CANONICAL_FIELDS_INVALID'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.posting_evidence_v46
 WHERE finance_entry_id=id AND approved_revision=3 AND approver_id='ci46approve';
 IF n<>1 THEN RAISE EXCEPTION 'AUDIT_EVIDENCE_INVALID'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.ledger_projection_v46 WHERE finance_entry_id='MANUAL_ci46doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.posting_evidence_v46 WHERE document_id='ci46doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.manual_posting_v44 WHERE document_id='ci46doc')
 THEN RAISE EXCEPTION 'ROLLBACK_LEAK'; END IF;
END $$;
SELECT 'TAMANCARE_FINANCE_V381846_CANONICAL_PROJECTION_PASS' AS result;
SQL
