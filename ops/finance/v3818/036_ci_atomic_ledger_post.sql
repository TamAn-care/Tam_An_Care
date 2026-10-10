-- V3.8.18.36: isolated CI ledger write proof. NEVER production.
BEGIN;
DO $$ BEGIN IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF; END $$;
CREATE TABLE finance_manual_v26_ci.ledger_v36(
 ledger_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 financial_origin_key text NOT NULL UNIQUE,
 document_id text NOT NULL UNIQUE REFERENCES finance_manual_v26_ci.documents(document_id),
 recognition_date date NOT NULL,entry_type text NOT NULL CHECK(entry_type IN ('REVENUE','EXPENSE')),
 category text NOT NULL, amount_vnd numeric(18,0) NOT NULL CHECK(amount_vnd>=0),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE finance_manual_v26_ci.posting_audit_v36(
 document_id text PRIMARY KEY REFERENCES finance_manual_v26_ci.documents(document_id),
 financial_origin_key text NOT NULL UNIQUE,actor_id text NOT NULL,
 action text NOT NULL CHECK(action='POSTED'),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.post_approved_v36(
 p_document_id text,p_revision bigint,p_session_id text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE origin text;d finance_manual_v26_ci.documents%ROWTYPE;s record;
BEGIN
 -- claim_v35 locks source document and verifies approval + evidence + session.
 origin:=finance_manual_v26_ci.claim_postable_v35(p_document_id,p_revision,p_session_id);
 SELECT * INTO d FROM finance_manual_v26_ci.documents WHERE document_id=p_document_id;
 SELECT actor_id INTO s FROM finance_manual_v26_ci.auth_sessions_lab
 WHERE session_id=p_session_id AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_CHANGED'; END IF;
 INSERT INTO finance_manual_v26_ci.ledger_v36(financial_origin_key,document_id,recognition_date,entry_type,category,amount_vnd)
 VALUES(origin,d.document_id,d.recognition_date,
 CASE WHEN d.kind='REVENUE' THEN 'REVENUE' ELSE 'EXPENSE' END,d.category,d.amount_vnd);
 INSERT INTO finance_manual_v26_ci.posting_audit_v36(document_id,financial_origin_key,actor_id,action)
 VALUES(d.document_id,origin,s.actor_id,'POSTED');
 RETURN origin;
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.post_approved_v36(text,bigint,text) FROM PUBLIC;
COMMIT;
