-- Finance V3.8.18.30: isolated CI-only document read boundary.
-- Caller's role is NEVER an argument; use authenticated session lookup.
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.read_document_v30(
 p_document_id text,p_session_id text)
RETURNS TABLE(document_id text,kind text,status text,revision bigint,amount_vnd numeric,recognition_date date)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE s record; d finance_manual_v26_ci.documents%ROWTYPE;
BEGIN
 IF p_document_id IS NULL OR p_document_id !~ '^[A-Za-z0-9_-]{1,160}$'
 OR p_session_id IS NULL THEN RAISE EXCEPTION 'FINANCE_READ_DENIED'; END IF;
 SELECT actor_id,actor_role INTO s
 FROM finance_manual_v26_ci.auth_sessions_lab
 WHERE session_id=p_session_id AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'FINANCE_READ_DENIED'; END IF;
 SELECT * INTO d FROM finance_manual_v26_ci.documents
 WHERE documents.document_id=p_document_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'FINANCE_READ_DENIED'; END IF;
 IF d.kind='PAYROLL' THEN
  IF (s.actor_role='DIRECTOR' AND s.actor_id=d.approver_id)
   OR (s.actor_role='FINANCE_APPROVER' AND s.actor_id=d.approver_id)
   OR (s.actor_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER') AND s.actor_id=d.reviewer_id)
   OR (s.actor_role IN ('FINANCE_MAKER','FINANCE_MANAGER') AND s.actor_id=d.created_by)
  THEN NULL; ELSE RAISE EXCEPTION 'FINANCE_READ_DENIED'; END IF;
 ELSE
  IF NOT ((s.actor_role IN ('FINANCE_MAKER','FINANCE_MANAGER') AND s.actor_id=d.created_by)
   OR (s.actor_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER') AND s.actor_id=d.reviewer_id)
   OR (s.actor_role IN ('DIRECTOR','FINANCE_APPROVER') AND s.actor_id=d.approver_id))
  THEN RAISE EXCEPTION 'FINANCE_READ_DENIED'; END IF;
 END IF;
 RETURN QUERY SELECT d.document_id,d.kind,d.status,d.revision,d.amount_vnd,d.recognition_date;
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.read_document_v30(text,text) FROM PUBLIC;
