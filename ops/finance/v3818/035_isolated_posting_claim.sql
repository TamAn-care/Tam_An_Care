-- V3.8.18.35: isolated Finance posting eligibility & idempotency prototype.
-- IMPORTANT: CI ONLY, never migrate or post to Production Test.
BEGIN;
DO $$
BEGIN
 IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN
  RAISE EXCEPTION 'FINANCE_V35_CI_ONLY';
 END IF;
END $$;
CREATE TABLE finance_manual_v26_ci.posting_claims_v35 (
 financial_origin_key text PRIMARY KEY,
 document_id text NOT NULL UNIQUE REFERENCES finance_manual_v26_ci.documents(document_id),
 approved_revision bigint NOT NULL CHECK (approved_revision >= 1),
 claim_created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.claim_postable_v35(
 p_document_id text, p_expected_revision bigint, p_session_id text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE d finance_manual_v26_ci.documents%ROWTYPE; s record;
BEGIN
 IF p_document_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1
 OR p_session_id IS NULL THEN RAISE EXCEPTION 'INVALID_POSTING_COMMAND'; END IF;
 SELECT actor_id,actor_role INTO s FROM finance_manual_v26_ci.auth_sessions_lab
 WHERE session_id=p_session_id AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND OR s.actor_role NOT IN ('DIRECTOR','FINANCE_APPROVER')
 THEN RAISE EXCEPTION 'POSTING_PERMISSION_DENIED'; END IF;
 SELECT * INTO d FROM finance_manual_v26_ci.documents WHERE document_id=p_document_id FOR UPDATE;
 IF NOT FOUND OR d.status<>'APPROVED' OR d.revision<>p_expected_revision
 OR s.actor_id<>d.approver_id OR d.evidence_digest IS NULL
 THEN RAISE EXCEPTION 'DOCUMENT_NOT_POSTABLE'; END IF;
 INSERT INTO finance_manual_v26_ci.posting_claims_v35(
 financial_origin_key,document_id,approved_revision)
 VALUES(d.financial_origin_key,d.document_id,d.revision)
 ON CONFLICT (financial_origin_key) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'DUPLICATE_POSTING_ORIGIN'; END IF;
 RETURN d.financial_origin_key;
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.claim_postable_v35(text,bigint,text) FROM PUBLIC;
COMMIT;
