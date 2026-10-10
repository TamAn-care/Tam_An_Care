-- V3.8.18.29 — CI database ONLY. Requires isolated V26 and V27 schemas.
-- NOT a Production Test migration; no application route or ledger posting.
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.create_draft_v29(
 p_document_id text,p_origin_key text,p_kind text,p_recognition_date date,
 p_amount_vnd numeric,p_category text,p_description text,p_counterparty text,
 p_pay_basis text,p_evidence_type text,p_evidence_digest text,
 p_reviewer text,p_approver text,p_session_id text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE s record; d text;
BEGIN
 IF p_session_id IS NULL OR p_document_id IS NULL OR p_document_id !~ '^[a-zA-Z0-9_-]{1,160}$'
 OR p_origin_key IS NULL OR p_origin_key !~ '^[a-zA-Z0-9_-]{1,160}$'
 OR p_reviewer IS NULL OR p_approver IS NULL
 THEN RAISE EXCEPTION 'INVALID_DRAFT_REQUEST'; END IF;
 SELECT actor_id,actor_role INTO s
 FROM finance_manual_v26_ci.auth_sessions_lab
 WHERE session_id=p_session_id AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND OR s.actor_role NOT IN ('FINANCE_MAKER','FINANCE_MANAGER')
 THEN RAISE EXCEPTION 'DRAFT_MAKER_NOT_AUTHORIZED'; END IF;
 IF s.actor_id IN (p_reviewer,p_approver) OR p_reviewer=p_approver
 THEN RAISE EXCEPTION 'SEPARATION_OF_DUTIES_REQUIRED'; END IF;
 INSERT INTO finance_manual_v26_ci.documents(
 document_id,financial_origin_key,kind,recognition_date,amount_vnd,category,description,
 counterparty_ref,pay_basis,evidence_type,evidence_digest,created_by,reviewer_id,approver_id)
 VALUES(p_document_id,p_origin_key,p_kind,p_recognition_date,p_amount_vnd,
 p_category,p_description,p_counterparty,p_pay_basis,p_evidence_type,p_evidence_digest,
 s.actor_id,p_reviewer,p_approver)
 RETURNING document_id INTO d;
 INSERT INTO finance_manual_v26_ci.audit(document_id,document_revision,action,actor_id,reason)
 VALUES(d,0,'CREATE_DRAFT',s.actor_id,'INITIAL_DRAFT');
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.create_draft_v29(text,text,text,date,numeric,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
