-- Finance V3.8.2 DESIGN ONLY. Apply ONLY inside ephemeral PostgreSQL CI.
-- Production Test: migration forbidden until independently approved backup/restore,
-- role/RBAC, authorization, rollback, and real-data acceptance gates.
BEGIN;
CREATE TABLE finance_source_documents (
 document_id text PRIMARY KEY CHECK(document_id ~ '^[A-Za-z0-9_-]{1,160}$'),
 source_domain text NOT NULL CHECK(source_domain ~ '^[A-Z][A-Z0-9_]{1,63}$'),
 source_entity_type text NOT NULL CHECK(source_entity_type ~ '^[A-Z][A-Z0-9_]{1,63}$'),
 source_entity_id text NOT NULL CHECK(source_entity_id ~ '^[A-Za-z0-9_-]{1,160}$'),
 entry_type text NOT NULL CHECK(entry_type IN
 ('REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX')),
 recognition_date date NOT NULL,
 amount_vnd numeric(18,0) NOT NULL CHECK(amount_vnd >= 0),
 external_evidence_sha256 char(64) NOT NULL CHECK(external_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 approval_evidence_sha256 char(64) CHECK(approval_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reference_number text NOT NULL CHECK(length(trim(reference_number)) >= 2),
 prepared_by text NOT NULL,
 reviewed_by text,
 approved_by text,
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT finance_source_documents_unique_source
 UNIQUE(source_domain,source_entity_type,source_entity_id,entry_type),
 CONSTRAINT finance_source_documents_approval_guard CHECK (
 (state IN ('DRAFT','SUBMITTED','REJECTED') AND approved_by IS NULL)
 OR (state='REVIEWED' AND reviewed_by IS NOT NULL AND approved_by IS NULL)
 OR (state='APPROVED' AND reviewed_by IS NOT NULL AND approved_by IS NOT NULL
     AND approval_evidence_sha256 IS NOT NULL
     AND prepared_by<>reviewed_by AND reviewed_by<>approved_by AND prepared_by<>approved_by)
 )
);
CREATE TABLE finance_source_document_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id text NOT NULL REFERENCES finance_source_documents(document_id),
 revision bigint NOT NULL CHECK(revision>=1),
 from_state text NOT NULL,
 to_state text NOT NULL,
 action text NOT NULL CHECK(action IN ('SUBMIT','REVIEW','APPROVE','REJECT')),
 actor_id text NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason))>=5),
 happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(document_id,revision)
);
-- Prevent UPDATE/DELETE even by an application account granted DML.
CREATE FUNCTION finance_v382_events_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'FINANCE_DOCUMENT_AUDIT_IMMUTABLE';
END $$;
CREATE TRIGGER finance_v382_events_no_mutation
 BEFORE UPDATE OR DELETE ON finance_source_document_events
 FOR EACH ROW EXECUTE FUNCTION finance_v382_events_immutable();
-- Default deny for ordinary application users. Dedicated RLS, narrow API,
-- stable service identity and controlled transition functions are future work.
REVOKE ALL ON finance_source_documents FROM PUBLIC;
REVOKE ALL ON finance_source_document_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE finance_source_document_events_event_id_seq FROM PUBLIC;
COMMIT;
