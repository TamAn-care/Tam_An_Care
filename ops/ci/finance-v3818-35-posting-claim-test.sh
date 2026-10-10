#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == 127.0.0.1 && "$PGDATABASE" == finance_ci && "$PGUSER" == finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/035_isolated_posting_claim.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE v text; n integer;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES('ci35m','ci35maker','FINANCE_MAKER',now()+interval '1 hour'),
 ('ci35r','ci35review','FINANCE_REVIEWER',now()+interval '1 hour'),
 ('ci35a','ci35director','DIRECTOR',now()+interval '1 hour'),
 ('ci35x','ci35stranger','DIRECTOR',now()+interval '1 hour');
 v:=finance_manual_v26_ci.create_draft_v29('ci35doc','ci35origin','OPERATING_EXPENSE',
 current_date,125000,'OFFICE','Documented operational expense','ci35internal',
 'NOT_APPLICABLE','INTERNAL_VOUCHER',repeat('d',64),'ci35review','ci35director','ci35m');
 BEGIN
  PERFORM finance_manual_v26_ci.claim_postable_v35('ci35doc',0,'ci35a');
  RAISE EXCEPTION 'DRAFT_CLAIM_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'INVALID_POSTING_COMMAND' THEN RAISE; END IF; END;
 PERFORM finance_manual_v26_ci.transition_v27('ci35doc',0,'SUBMIT','ci35m','Ready for review');
 PERFORM finance_manual_v26_ci.transition_v27('ci35doc',1,'REVIEW','ci35r','Reviewed voucher');
 PERFORM finance_manual_v26_ci.transition_v27('ci35doc',2,'APPROVE','ci35a','Approved voucher');
 BEGIN
  PERFORM finance_manual_v26_ci.claim_postable_v35('ci35doc',3,'ci35x');
  RAISE EXCEPTION 'FOREIGN_APPROVER_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'DOCUMENT_NOT_POSTABLE' THEN RAISE; END IF; END;
 v:=finance_manual_v26_ci.claim_postable_v35('ci35doc',3,'ci35a');
 IF v<>'ci35origin' THEN RAISE EXCEPTION 'ORIGIN_MISMATCH'; END IF;
 BEGIN
  PERFORM finance_manual_v26_ci.claim_postable_v35('ci35doc',3,'ci35a');
  RAISE EXCEPTION 'DUPLICATE_CLAIM_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'DUPLICATE_POSTING_ORIGIN' THEN RAISE; END IF; END;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.posting_claims_v35
 WHERE financial_origin_key='ci35origin';
 IF n<>1 THEN RAISE EXCEPTION 'CLAIM_UNIQUENESS_FAILED'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.posting_claims_v35 WHERE financial_origin_key='ci35origin')
 OR EXISTS(SELECT 1 FROM finance_manual_v26_ci.documents WHERE document_id='ci35doc')
 THEN RAISE EXCEPTION 'ROLLBACK_LEAK'; END IF;
END $$;
SELECT 'TAMANCARE_FINANCE_V381835_CI_POSTING_CLAIM_PASS' AS result;
SQL
