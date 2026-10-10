#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == "127.0.0.1" && "$PGUSER" == "finance_ci" && "$PGDATABASE" == "finance_ci" ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/027_isolated_approval_transaction.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE v text; n int;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'DATABASE_ISOLATION_FAILED'; END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES('isolated_m','maker','FINANCE_MAKER',now()+interval '1 hour'),
 ('isolated_r','reviewer','FINANCE_REVIEWER',now()+interval '1 hour'),
 ('isolated_d','director','DIRECTOR',now()+interval '1 hour'),
 ('isolated_exp','director','DIRECTOR',now()-interval '1 hour');
 INSERT INTO finance_manual_v26_ci.documents
 (document_id,financial_origin_key,kind,recognition_date,amount_vnd,category,description,
 counterparty_ref,pay_basis,evidence_type,evidence_digest,created_by,reviewer_id,approver_id)
 VALUES('ci_doc_27','ci_origin_27','PAYROLL',DATE '2026-10-10',9000000,
 'AGREED_SALARY','Internal agreed salary test','ci_actor','AGREED_AMOUNT','SIGNED_AGREEMENT',
 repeat('a',64),'maker','reviewer','director');
 BEGIN
  PERFORM finance_manual_v26_ci.transition_v27('ci_doc_27',0,'APPROVE','isolated_d','Invalid approval');
  RAISE EXCEPTION 'DIRECT_APPROVAL_SHOULD_FAIL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='DIRECT_APPROVAL_SHOULD_FAIL' THEN RAISE; END IF;
 END;
 v:=finance_manual_v26_ci.transition_v27('ci_doc_27',0,'SUBMIT','isolated_m','Submitted payroll');
 IF v<>'SUBMITTED' THEN RAISE EXCEPTION 'SUBMIT_FAILED'; END IF;
 BEGIN
  PERFORM finance_manual_v26_ci.transition_v27('ci_doc_27',0,'REVIEW','isolated_r','Outdated revision');
  RAISE EXCEPTION 'STALE_REVISION_SHOULD_FAIL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='STALE_REVISION_SHOULD_FAIL' THEN RAISE; END IF;
 END;
 v:=finance_manual_v26_ci.transition_v27('ci_doc_27',1,'REVIEW','isolated_r','Verified document');
 BEGIN
  PERFORM finance_manual_v26_ci.transition_v27('ci_doc_27',2,'APPROVE','isolated_exp','Expired login');
  RAISE EXCEPTION 'EXPIRED_SESSION_SHOULD_FAIL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='EXPIRED_SESSION_SHOULD_FAIL' THEN RAISE; END IF;
 END;
 v:=finance_manual_v26_ci.transition_v27('ci_doc_27',2,'APPROVE','isolated_d','Director approval');
 SELECT count(*) INTO n FROM finance_manual_v26_ci.audit WHERE document_id='ci_doc_27';
 IF v<>'APPROVED' OR n<>3 THEN RAISE EXCEPTION 'ATOMIC_AUDIT_MISMATCH'; END IF;
END $$;
ROLLBACK;
SELECT CASE WHEN (SELECT count(*) FROM finance_manual_v26_ci.documents)=0
 AND (SELECT count(*) FROM finance_manual_v26_ci.audit)=0
 THEN 'FINANCE_V381827_ATOMIC_ROLLBACK_CI_PASS'
 ELSE 'FINANCE_V381827_ATOMIC_ROLLBACK_CI_FAIL' END AS result;
SQL
