-- V3.8.18.32. CANDIDATE ONLY. NEVER RUN ON PRODUCTION TEST.
-- Assert ephemeral CI database BEFORE any DDL; atomic install and reversible rollback.
BEGIN;
DO $$
BEGIN
 IF current_database()<>'finance_ci' OR current_user<>'finance_ci' THEN
  RAISE EXCEPTION 'V32_DENY_NON_CI_DATABASE';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='finance_manual_canonical') THEN
  RAISE EXCEPTION 'V32_DENY_EXISTING_NAMESPACE';
 END IF;
END $$;
CREATE SCHEMA finance_manual_canonical;
CREATE TABLE finance_manual_canonical.documents(
 document_id text PRIMARY KEY,
 financial_origin_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN('PAYROLL','REVENUE','DIRECT_COST','OPERATING_EXPENSE')),
 recognition_date date NOT NULL,
 amount_vnd numeric(18,0) NOT NULL CHECK(amount_vnd>=0),
 description text NOT NULL CHECK(length(btrim(description))>=8),
 evidence_type text NOT NULL,
 evidence_digest text,
 created_by text NOT NULL,
 reviewer_id text NOT NULL,
 approver_id text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK(created_by<>reviewer_id AND created_by<>approver_id AND reviewer_id<>approver_id)
);
CREATE TABLE finance_manual_canonical.audit(
 audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id text NOT NULL REFERENCES finance_manual_canonical.documents(document_id),
 document_revision bigint NOT NULL,
 action text NOT NULL,actor_id text NOT NULL,reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(document_id,document_revision)
);
REVOKE ALL ON SCHEMA finance_manual_canonical FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA finance_manual_canonical FROM PUBLIC;
COMMIT;
