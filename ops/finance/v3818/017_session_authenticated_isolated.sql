-- V3.8.18.17 - isolated ephemeral PostgreSQL authorization transaction.
-- Run ONLY against GitHub Actions finance_ci. NOT Production Test.
BEGIN;
CREATE TABLE finance_manual_ci.session_authorizations_ci (
 session_id text PRIMARY KEY,
 actor_id text NOT NULL,
 actor_role text NOT NULL,
 revoked_at timestamptz,
 expires_at timestamptz NOT NULL
);
REVOKE ALL ON finance_manual_ci.session_authorizations_ci FROM PUBLIC;
CREATE OR REPLACE FUNCTION finance_manual_ci.transition_authenticated_ci(
 p_document_id text, p_expected_revision bigint, p_action text,
 p_session_id text, p_reason text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE a record; d finance_manual_ci.documents%ROWTYPE; new_state text;
BEGIN
 IF p_session_id IS NULL OR p_document_id IS NULL OR p_reason IS NULL
 OR length(btrim(p_reason)) < 5 OR p_expected_revision IS NULL
 OR p_expected_revision < 0 THEN RAISE EXCEPTION 'COMMAND_INVALID'; END IF;
 SELECT actor_id,actor_role INTO a
 FROM finance_manual_ci.session_authorizations_ci
 WHERE session_id=p_session_id AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'AUTHENTICATED_SESSION_REQUIRED'; END IF;
 SELECT * INTO d FROM finance_manual_ci.documents
 WHERE document_id=p_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
 IF d.revision<>p_expected_revision THEN RAISE EXCEPTION 'STALE_DOCUMENT_REVISION'; END IF;
 new_state:=CASE
 WHEN d.state='DRAFT' AND p_action='SUBMIT' AND a.actor_id=d.maker_id
  AND a.actor_role IN ('FINANCE_MAKER','FINANCE_MANAGER') THEN 'SUBMITTED'
 WHEN d.state='SUBMITTED' AND p_action='REVIEW' AND a.actor_id=d.reviewer_id
  AND a.actor_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER') THEN 'REVIEWED'
 WHEN d.state='REVIEWED' AND p_action='APPROVE' AND a.actor_id=d.approver_id
  AND a.actor_role IN ('FINANCE_APPROVER','DIRECTOR') THEN 'APPROVED'
 WHEN d.state='SUBMITTED' AND p_action='REJECT'
  AND a.actor_id IN (d.reviewer_id,d.approver_id)
  AND a.actor_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER','FINANCE_APPROVER','DIRECTOR') THEN 'REJECTED'
 ELSE NULL END;
 IF new_state IS NULL THEN RAISE EXCEPTION 'ROLE_OR_STATE_FORBIDDEN'; END IF;
 UPDATE finance_manual_ci.documents SET revision=revision+1,state=new_state
 WHERE document_id=p_document_id;
 INSERT INTO finance_manual_ci.audit(document_id,revision,action,actor_id,reason)
 VALUES(p_document_id,p_expected_revision+1,p_action,a.actor_id,btrim(p_reason));
 RETURN new_state;
END $$;
REVOKE ALL ON FUNCTION finance_manual_ci.transition_authenticated_ci(text,bigint,text,text,text) FROM PUBLIC;
COMMIT;
