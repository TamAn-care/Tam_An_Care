#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == 127.0.0.1 && "$PGUSER" == finance_ci && "$PGDATABASE" == finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/030_isolated_document_read.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE n int;
BEGIN
 IF current_database()<>'finance_ci' THEN RAISE EXCEPTION 'UNSAFE_DATABASE'; END IF;
 INSERT INTO finance_manual_v26_ci.auth_sessions_lab(session_id,actor_id,actor_role,expires_at)
 VALUES('v30_m','maker30','FINANCE_MAKER',now()+interval '1 hour'),
 ('v30_r','review30','FINANCE_REVIEWER',now()+interval '1 hour'),
 ('v30_d','director30','DIRECTOR',now()+interval '1 hour'),
 ('v30_stranger','other30','DIRECTOR',now()+interval '1 hour'),
 ('v30_exp','director30','DIRECTOR',now()-interval '1 hour'),
 ('v30_rev','director30','DIRECTOR',now()+interval '1 hour');
 UPDATE finance_manual_v26_ci.auth_sessions_lab SET revoked_at=now() WHERE session_id='v30_rev';
 INSERT INTO finance_manual_v26_ci.documents
 (document_id,financial_origin_key,kind,recognition_date,amount_vnd,category,description,
 counterparty_ref,pay_basis,evidence_type,created_by,reviewer_id,approver_id)
 VALUES('v30_doc','v30_origin','PAYROLL',current_date,1000000,'SALARY','CI-only agreed amount',
 'ci_stf','AGREED_AMOUNT','INTERNAL_VOUCHER','maker30','review30','director30');
 SELECT count(*) INTO n FROM finance_manual_v26_ci.read_document_v30('v30_doc','v30_m');
 IF n<>1 THEN RAISE EXCEPTION 'MAKER_SCOPE_FAILED'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.read_document_v30('v30_doc','v30_r');
 IF n<>1 THEN RAISE EXCEPTION 'REVIEWER_SCOPE_FAILED'; END IF;
 SELECT count(*) INTO n FROM finance_manual_v26_ci.read_document_v30('v30_doc','v30_d');
 IF n<>1 THEN RAISE EXCEPTION 'DIRECTOR_SCOPE_FAILED'; END IF;
 BEGIN
  PERFORM finance_manual_v26_ci.read_document_v30('v30_doc','v30_stranger');
  RAISE EXCEPTION 'UNRELATED_DIRECTOR_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'FINANCE_READ_DENIED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM finance_manual_v26_ci.read_document_v30('v30_doc','v30_exp');
  RAISE EXCEPTION 'EXPIRED_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'FINANCE_READ_DENIED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM finance_manual_v26_ci.read_document_v30('v30_doc','v30_rev');
  RAISE EXCEPTION 'REVOKED_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'FINANCE_READ_DENIED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM finance_manual_v26_ci.read_document_v30('missing_document','v30_d');
  RAISE EXCEPTION 'UNKNOWN_DOCUMENT_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'FINANCE_READ_DENIED' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.documents WHERE document_id='v30_doc')
 THEN RAISE EXCEPTION 'DOCUMENT_ROLLBACK_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM finance_manual_v26_ci.auth_sessions_lab WHERE session_id='v30_m')
 THEN RAISE EXCEPTION 'SESSION_ROLLBACK_FAILED'; END IF;
END $$;
SELECT 'FINANCE_V381830_ISOLATED_CONFIDENTIAL_READ_PASS' AS result;
SQL
