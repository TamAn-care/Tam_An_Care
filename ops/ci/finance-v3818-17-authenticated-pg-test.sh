#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
test "$PGHOST" = 127.0.0.1 && test "$PGDATABASE" = finance_ci
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/017_session_authenticated_isolated.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO finance_manual_ci.session_authorizations_ci(session_id,actor_id,actor_role,expires_at)
VALUES ('session_m','maker','FINANCE_MAKER',now()+interval '1 hour'),
('session_r','reviewer','FINANCE_REVIEWER',now()+interval '1 hour'),
('session_d','director','DIRECTOR',now()+interval '1 hour');
INSERT INTO finance_manual_ci.documents(document_id,origin_key,document_type,amount_vnd,recognition_date,evidence_type,description,maker_id,reviewer_id,approver_id)
VALUES ('lab_doc_17','lab_salary_17','PAYROLL',9000000,'2026-10-01','SIGNED_AGREEMENT','Agreed monthly pay','maker','reviewer','director');
DO $$
DECLARE s text; n bigint;
BEGIN
s:=finance_manual_ci.transition_authenticated_ci('lab_doc_17',0,'SUBMIT','session_m','Prepare approval');
s:=finance_manual_ci.transition_authenticated_ci('lab_doc_17',1,'REVIEW','session_r','Review evidence');
s:=finance_manual_ci.transition_authenticated_ci('lab_doc_17',2,'APPROVE','session_d','Director approved');
SELECT count(*) INTO n FROM finance_manual_ci.audit WHERE document_id='lab_doc_17';
IF s<>'APPROVED' OR n<>3 THEN RAISE EXCEPTION 'AUDIT_CHECK_FAILED'; END IF;
END $$;
SELECT 'FINANCE_V3818_17_ISOLATED_AUTH_PASS' AS result;
SQL
