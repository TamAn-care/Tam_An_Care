#!/usr/bin/env bash
# V3.8.18.34: complete manual document workflow, EPHEMERAL CI ONLY.
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=finance_ci PGUSER=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" = 127.0.0.1 && "$PGDATABASE" = finance_ci && "$PGUSER" = finance_ci ]]
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE v text; n integer;
BEGIN
 IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN
  RAISE EXCEPTION 'CI_ISOLATION_DENIED';
 END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES ('ci34_m','ci34_maker','FINANCE_MAKER',now()+interval '1 hour'),
 ('ci34_r','ci34_reviewer','FINANCE_REVIEWER',now()+interval '1 hour'),
 ('ci34_a','ci34_approver','FINANCE_APPROVER',now()+interval '1 hour'),
 ('ci34_x','ci34_other','FINANCE_APPROVER',now()+interval '1 hour');
 v:=finance_manual_v26_ci.create_draft_v29(
 'ci34_doc','ci34_origin','OPERATING_EXPENSE',current_date,180000,
 'GENERAL','Approved documented internal payment','ci34_internal',
 'NOT_APPLICABLE','INTERNAL_VOUCHER',repeat('c',64),
 'ci34_reviewer','ci34_approver','ci34_m');
 IF v<>'ci34_doc' THEN RAISE EXCEPTION 'DRAFT_CREATE_FAILED'; END IF;
 BEGIN
  PERFORM finance_manual_v26_ci.transition_v27('ci34_doc',0,'APPROVE','ci34_a','Skip review');
  RAISE EXCEPTION 'UNEXPECTED_DIRECT_APPROVAL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'TRANSITION_DENIED' THEN RAISE; END IF;
 END;
 v:=finance_manual_v26_ci.transition_v27('ci34_doc',0,'SUBMIT','ci34_m','Send for review');
 IF v<>'SUBMITTED' THEN RAISE EXCEPTION 'SUBMIT_FAILED'; END IF;
 BEGIN
  PERFORM finance_manual_v26_ci.transition_v27('ci34_doc',1,'REVIEW','ci34_m','Unauthorized review');
  RAISE EXCEPTION 'UNEXPECTED_SELF_REVIEW';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'TRANSITION_DENIED' THEN RAISE; END IF;
 END;
 v:=finance_manual_v26_ci.transition_v27('ci34_doc',1,'REVIEW','ci34_r','Checked supporting evidence');
 IF v<>'REVIEWED' THEN RAISE EXCEPTION 'REVIEW_FAILED'; END IF;
 BEGIN
  PERFORM finance_manual_v26_ci.transition_v27('ci34_doc',1,'APPROVE','ci34_a','Stale revision');
  RAISE EXCEPTION 'UNEXPECTED_STALE_APPROVAL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'STALE_REVISION' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM finance_manual_v26_ci.transition_v27('ci34_doc',2,'APPROVE','ci34_x','Wrong approver');
  RAISE EXCEPTION 'UNEXPECTED_SCOPE_APPROVAL';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'TRANSITION_DENIED' THEN RAISE; END IF;
 END;
 v:=finance_manual_v26_ci.transition_v27('ci34_doc',2,'APPROVE','ci34_a','Approved internal voucher');
 IF v<>'APPROVED' THEN RAISE EXCEPTION 'APPROVAL_FAILED'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.audit WHERE document_id='ci34_doc';
 IF n<>4 THEN RAISE EXCEPTION 'AUDIT_CHAIN_INCOMPLETE'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.audit
 WHERE document_id='ci34_doc' AND document_revision IN(0,1,2,3);
 IF n<>4 THEN RAISE EXCEPTION 'AUDIT_REVISIONS_INVALID'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.documents
 WHERE document_id='ci34_doc' AND revision=3 AND status='APPROVED';
 IF n<>1 THEN RAISE EXCEPTION 'APPROVAL_NOT_PERSISTED_IN_TRANSACTION'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.documents WHERE document_id='ci34_doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.audit WHERE document_id='ci34_doc')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.auth_sessions_lab WHERE session_id='ci34_m')
 THEN RAISE EXCEPTION 'ROLLBACK_LEAK'; END IF;
END $$;
SELECT 'TAMANCARE_FINANCE_V381834_ISOLATED_END_TO_END_PASS' AS result;
SQL
