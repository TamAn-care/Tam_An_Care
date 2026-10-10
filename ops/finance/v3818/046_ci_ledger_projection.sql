-- V3.8.18.46 CI ONLY: canonical ledger-shaped projection, NEVER public.finance_entries.
BEGIN;
DO $$ BEGIN IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN RAISE EXCEPTION 'CI_ONLY'; END IF; END $$;
CREATE TABLE finance_manual_v26_ci.ledger_projection_v46 (
 finance_entry_id text PRIMARY KEY,
 entry_type text NOT NULL CHECK(entry_type IN ('REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX')),
 category text NOT NULL,description text NOT NULL,
 amount_vnd numeric(18,0) NOT NULL CHECK(amount_vnd>=0),
 recognition_date date NOT NULL,cash_date date,
 source_mode text NOT NULL CHECK(source_mode='MANUAL'),
 source_domain text NOT NULL,source_entity_type text NOT NULL,source_entity_id text NOT NULL,
 status text NOT NULL CHECK(status='POSTED'),reference_number text,
 created_by text NOT NULL,
 UNIQUE(source_domain,source_entity_type,source_entity_id,entry_type),
 UNIQUE(source_entity_id)
);
CREATE TABLE finance_manual_v26_ci.posting_evidence_v46(
 document_id text PRIMARY KEY REFERENCES finance_manual_v26_ci.documents(document_id),
 finance_entry_id text NOT NULL UNIQUE REFERENCES finance_manual_v26_ci.ledger_projection_v46(finance_entry_id),
 approver_id text NOT NULL, approved_revision bigint NOT NULL,
 evidence_digest text NOT NULL CHECK(evidence_digest ~ '^[a-f0-9]{64}$'),
 posted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION finance_manual_v26_ci.project_manual_v46(p_document_id text,p_expected_revision bigint,p_session text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE d finance_manual_v26_ci.documents%ROWTYPE;s record;eid text;
BEGIN
 IF p_document_id IS NULL OR p_session IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1
 THEN RAISE EXCEPTION 'INVALID_PROJECT_COMMAND'; END IF;
 SELECT actor_id,actor_role INTO s FROM finance_manual_v26_ci.auth_sessions_lab
 WHERE session_id=p_session AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF NOT FOUND OR s.actor_role NOT IN ('DIRECTOR','FINANCE_APPROVER') THEN RAISE EXCEPTION 'PROJECT_PERMISSION_DENIED'; END IF;
 SELECT * INTO d FROM finance_manual_v26_ci.documents WHERE document_id=p_document_id FOR UPDATE;
 IF NOT FOUND OR d.status<>'APPROVED' OR d.revision<>p_expected_revision
 OR d.approver_id<>s.actor_id OR d.evidence_digest IS NULL
 THEN RAISE EXCEPTION 'PROJECT_SOURCE_UNVERIFIED'; END IF;
 -- Demand actual V44 idempotency claim rather than silently creating one.
 IF NOT EXISTS(SELECT 1 FROM finance_manual_v26_ci.manual_posting_v44 p
 WHERE p.document_id=d.document_id AND p.voucher_origin_key=d.financial_origin_key
 AND p.approved_revision=d.revision AND p.canonical_entry_type=d.kind)
 THEN RAISE EXCEPTION 'POSTING_CLAIM_NOT_VERIFIED'; END IF;
 eid:='MANUAL_'||d.document_id;
 INSERT INTO finance_manual_v26_ci.ledger_projection_v46(
 finance_entry_id,entry_type,category,description,amount_vnd,recognition_date,
 source_mode,source_domain,source_entity_type,source_entity_id,status,reference_number,created_by)
 VALUES(eid,d.kind,d.category,d.description,d.amount_vnd,d.recognition_date,
 'MANUAL','MANUAL_VOUCHER','FINANCE_MANUAL_DOCUMENT',d.financial_origin_key,'POSTED',d.document_id,d.created_by);
 INSERT INTO finance_manual_v26_ci.posting_evidence_v46(
 document_id,finance_entry_id,approver_id,approved_revision,evidence_digest)
 VALUES(d.document_id,eid,s.actor_id,d.revision,d.evidence_digest);
 RETURN eid;
END $$;
REVOKE ALL ON FUNCTION finance_manual_v26_ci.project_manual_v46(text,bigint,text) FROM PUBLIC;
COMMIT;
