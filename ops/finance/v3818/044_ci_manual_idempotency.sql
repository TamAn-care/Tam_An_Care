-- V3.8.18.44 — CI-only manual voucher posting idempotency.
-- Independently keyed per canonical voucher origin; no live finance_entries.
BEGIN;
DO $$ BEGIN IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF; END $$;
CREATE TABLE finance_manual_v26_ci.manual_posting_v44(
 voucher_origin_key text PRIMARY KEY,
 document_id text NOT NULL UNIQUE REFERENCES finance_manual_v26_ci.documents(document_id),
 canonical_entry_type text NOT NULL CHECK(canonical_entry_type IN('REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE')),
 approved_revision bigint NOT NULL CHECK(approved_revision>0),
 posted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.manual_post_v44(p_doc text,p_revision bigint,p_session text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE d finance_manual_v26_ci.documents%ROWTYPE;s record;
BEGIN
 IF p_doc IS NULL OR p_session IS NULL OR p_revision IS NULL OR p_revision<1 THEN RAISE EXCEPTION 'INVALID_POSTING_INPUT'; END IF;
 SELECT actor_id,actor_role INTO s FROM finance_manual_v26_ci.auth_sessions_lab
 WHERE session_id=p_session AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND OR s.actor_role NOT IN ('DIRECTOR','FINANCE_APPROVER') THEN RAISE EXCEPTION 'SESSION_NOT_AUTHORIZED'; END IF;
 SELECT * INTO d FROM finance_manual_v26_ci.documents WHERE document_id=p_doc FOR UPDATE;
 IF NOT FOUND OR d.status<>'APPROVED' OR d.revision<>p_revision OR d.evidence_digest IS NULL
 OR s.actor_id<>d.approver_id THEN RAISE EXCEPTION 'DOCUMENT_NOT_POSTABLE'; END IF;
 INSERT INTO finance_manual_v26_ci.manual_posting_v44(voucher_origin_key,document_id,canonical_entry_type,approved_revision)
 VALUES(d.financial_origin_key,d.document_id,d.kind,d.revision)
 ON CONFLICT (voucher_origin_key) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'DUPLICATE_MANUAL_ORIGIN'; END IF;
 RETURN d.financial_origin_key;
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.manual_post_v44(text,bigint,text) FROM PUBLIC;
COMMIT;
