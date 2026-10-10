-- V3.8.18.27 isolated transaction prototype. NEVER run on Production Test.
-- Authenticated actor/role must be resolved from server-held verified session.
CREATE TABLE finance_manual_v26_ci.auth_sessions_lab(
 session_id text PRIMARY KEY, actor_id text NOT NULL, actor_role text NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.transition_v27(
 p_document_id text,p_expected_revision bigint,p_action text,p_session_id text,p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE d finance_manual_v26_ci.documents%ROWTYPE; s record; next_status text;
BEGIN
 IF p_document_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_session_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason))<5
 THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 SELECT actor_id,actor_role INTO s FROM finance_manual_v26_ci.auth_sessions_lab
 WHERE session_id=p_session_id AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_ACTIVE'; END IF;
 SELECT * INTO d FROM finance_manual_v26_ci.documents WHERE document_id=p_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
 IF d.revision<>p_expected_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 next_status:=CASE
 WHEN d.status='DRAFT' AND p_action='SUBMIT' AND s.actor_id=d.created_by
  AND s.actor_role IN ('FINANCE_MAKER','FINANCE_MANAGER') THEN 'SUBMITTED'
 WHEN d.status='SUBMITTED' AND p_action='REVIEW' AND s.actor_id=d.reviewer_id
  AND s.actor_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER') THEN 'REVIEWED'
 WHEN d.status='REVIEWED' AND p_action='APPROVE' AND s.actor_id=d.approver_id
  AND s.actor_role IN ('DIRECTOR','FINANCE_APPROVER') AND d.evidence_digest IS NOT NULL
 THEN 'APPROVED'
 WHEN d.status='SUBMITTED' AND p_action='REJECT'
  AND s.actor_id IN (d.reviewer_id,d.approver_id)
  AND s.actor_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER','DIRECTOR','FINANCE_APPROVER')
 THEN 'REJECTED'
 ELSE NULL END;
 IF next_status IS NULL THEN RAISE EXCEPTION 'TRANSITION_DENIED'; END IF;
 UPDATE finance_manual_v26_ci.documents
 SET status=next_status,revision=revision+1,updated_at=clock_timestamp()
 WHERE document_id=p_document_id;
 INSERT INTO finance_manual_v26_ci.audit(document_id,document_revision,action,actor_id,reason)
 VALUES(p_document_id,p_expected_revision+1,p_action,s.actor_id,btrim(p_reason));
 RETURN next_status;
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.transition_v27(text,bigint,text,text,text) FROM PUBLIC;
