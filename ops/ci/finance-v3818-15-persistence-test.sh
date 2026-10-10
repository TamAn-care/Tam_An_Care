#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" == 127.0.0.1 && "$PGDATABASE" == finance_ci && "$PGUSER" == finance_ci ]]
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3818/015_manual_documents_isolated.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO finance_manual_ci.documents(document_id,origin_key,document_type,amount_vnd,recognition_date,evidence_type,description,maker_id,reviewer_id,approver_id)
VALUES('doc_ci_1','payroll_actor_202610','PAYROLL',9000000,'2026-10-01','SIGNED_AGREEMENT','Monthly agreed salary','maker','reviewer','director');
DO $$
DECLARE s text; n bigint;
BEGIN
 s:=finance_manual_ci.transition_document('doc_ci_1',0,'SUBMIT','maker','FINANCE_MAKER','Submit salary');IF s<>'SUBMITTED' THEN RAISE EXCEPTION 'SUBMIT_FAILED';END IF;
 BEGIN PERFORM finance_manual_ci.transition_document('doc_ci_1',0,'REVIEW','reviewer','FINANCE_REVIEWER','Review salary');
 RAISE EXCEPTION 'STALE_NOT_REJECTED'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='STALE_NOT_REJECTED' THEN RAISE; END IF;END;
 BEGIN PERFORM finance_manual_ci.transition_document('doc_ci_1',1,'REVIEW','maker','FINANCE_REVIEWER','Self review');
 RAISE EXCEPTION 'SELF_REVIEW_NOT_REJECTED'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='SELF_REVIEW_NOT_REJECTED' THEN RAISE; END IF;END;
 s:=finance_manual_ci.transition_document('doc_ci_1',1,'REVIEW','reviewer','FINANCE_REVIEWER','Reviewed evidence');
 s:=finance_manual_ci.transition_document('doc_ci_1',2,'APPROVE','director','DIRECTOR','Approved payroll');
 SELECT count(*) INTO n FROM finance_manual_ci.audit WHERE document_id='doc_ci_1';
 IF s<>'APPROVED' OR n<>3 THEN RAISE EXCEPTION 'AUDIT_OR_APPROVAL_FAILED'; END IF;
 BEGIN
  INSERT INTO finance_manual_ci.documents(document_id,origin_key,document_type,amount_vnd,recognition_date,evidence_type,description,maker_id,reviewer_id,approver_id)
  VALUES('doc_ci_2','payroll_actor_202610','PAYROLL',9000000,'2026-10-01','SIGNED_AGREEMENT','Second same origin','maker','reviewer','director');
  RAISE EXCEPTION 'DUPLICATE_ORIGIN_NOT_REJECTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='DUPLICATE_ORIGIN_NOT_REJECTED' THEN RAISE; END IF; END;
 SELECT count(*) INTO n FROM finance_manual_ci.documents;
 IF n<>1 THEN RAISE EXCEPTION 'DUPLICATE_ROW_PERSISTED';END IF;
END $$;
SELECT 'FINANCE_V3818_15_ISOLATED_PERSISTENCE_PASS' AS result;
SQL
