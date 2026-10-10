-- V3.8.18.15 — ONLY for ephemeral GitHub Actions finance_ci.
-- Never run against the live Production Test database.
BEGIN;
CREATE SCHEMA IF NOT EXISTS finance_manual_ci;
CREATE TABLE finance_manual_ci.documents(
 document_id text PRIMARY KEY,
 origin_key text NOT NULL UNIQUE,
 document_type text NOT NULL CHECK(document_type IN ('PAYROLL','REVENUE','DIRECT_COST','OPERATING_EXPENSE')),
 amount_vnd numeric(18,0) NOT NULL CHECK(amount_vnd>=0 AND amount_vnd<=9999999999999999),
 recognition_date date NOT NULL,
 evidence_type text NOT NULL,
 description text NOT NULL CHECK(length(btrim(description))>=8),
 maker_id text NOT NULL,
 reviewer_id text NOT NULL,
 approver_id text NOT NULL,
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK(maker_id<>reviewer_id AND maker_id<>approver_id AND reviewer_id<>approver_id)
);
CREATE TABLE finance_manual_ci.audit(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id text NOT NULL REFERENCES finance_manual_ci.documents(document_id),
 revision bigint NOT NULL,
 action text NOT NULL,
 actor_id text NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(document_id,revision)
);
CREATE FUNCTION finance_manual_ci.transition_document(
 p_id text,p_expected bigint,p_action text,p_actor text,p_role text,p_reason text
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE d finance_manual_ci.documents%ROWTYPE; next_state text;
BEGIN
 IF p_reason IS NULL OR length(btrim(p_reason))<5 THEN RAISE EXCEPTION 'AUDIT_REASON_REQUIRED'; END IF;
 SELECT * INTO d FROM finance_manual_ci.documents WHERE document_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
 IF d.revision<>p_expected THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 next_state:=CASE
 WHEN d.state='DRAFT' AND p_action='SUBMIT' AND p_actor=d.maker_id AND p_role IN ('FINANCE_MAKER','FINANCE_MANAGER') THEN 'SUBMITTED'
 WHEN d.state='SUBMITTED' AND p_action='REVIEW' AND p_actor=d.reviewer_id AND p_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER') THEN 'REVIEWED'
 WHEN d.state='REVIEWED' AND p_action='APPROVE' AND p_actor=d.approver_id AND p_role IN ('FINANCE_APPROVER','DIRECTOR') THEN 'APPROVED'
 WHEN d.state='SUBMITTED' AND p_action='REJECT' AND p_actor<>d.maker_id AND p_role IN ('FINANCE_REVIEWER','FINANCE_MANAGER','FINANCE_APPROVER','DIRECTOR') THEN 'REJECTED'
 ELSE NULL END;
 IF next_state IS NULL THEN RAISE EXCEPTION 'TRANSITION_FORBIDDEN'; END IF;
 -- The role is an isolated CI input, NOT proof of real authenticated RBAC.
 UPDATE finance_manual_ci.documents SET state=next_state,revision=revision+1 WHERE document_id=p_id;
 INSERT INTO finance_manual_ci.audit(document_id,revision,action,actor_id,reason)
 VALUES(p_id,p_expected+1,p_action,p_actor,btrim(p_reason));
 RETURN next_state;
END $$;
COMMIT;
