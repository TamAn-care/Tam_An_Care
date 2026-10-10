-- Finance V3.8.18.26. ISOLATED CI SCHEMA ONLY, never a production migration.
-- This is a candidate canonical manual-document model after V381825 catalog PASS.
BEGIN;
CREATE SCHEMA finance_manual_v26_ci;
CREATE TABLE finance_manual_v26_ci.documents (
 document_id text PRIMARY KEY,
 financial_origin_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK (kind IN ('PAYROLL','REVENUE','DIRECT_COST','OPERATING_EXPENSE')),
 recognition_date date NOT NULL,
 amount_vnd numeric(18,0) NOT NULL CHECK (amount_vnd BETWEEN 0 AND 9999999999999999),
 category text NOT NULL CHECK (length(btrim(category)) >= 2),
 description text NOT NULL CHECK (length(btrim(description)) >= 8),
 counterparty_ref text NOT NULL,
 pay_basis text NOT NULL CHECK (pay_basis IN ('AGREED_AMOUNT','APPROVED_TIMESHEET','MANUAL_OTHER','NOT_APPLICABLE')),
 evidence_type text NOT NULL CHECK (evidence_type IN ('SUPPLIER_INVOICE','INTERNAL_VOUCHER','SIGNED_AGREEMENT','RECEIPT_OTHER')),
 evidence_digest text,
 created_by text NOT NULL,
 reviewer_id text NOT NULL,
 approver_id text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED')),
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (created_by<>reviewer_id AND created_by<>approver_id AND reviewer_id<>approver_id),
 CHECK ((kind='PAYROLL' AND pay_basis<>'NOT_APPLICABLE') OR (kind<>'PAYROLL' AND pay_basis='NOT_APPLICABLE')),
 CHECK (evidence_digest IS NULL OR evidence_digest ~ '^[a-f0-9]{64}$')
);
CREATE TABLE finance_manual_v26_ci.audit (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id text NOT NULL REFERENCES finance_manual_v26_ci.documents(document_id),
 document_revision bigint NOT NULL,
 action text NOT NULL,
 actor_id text NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (document_id, document_revision)
);
CREATE TABLE finance_manual_v26_ci.payroll_components (
 document_id text NOT NULL REFERENCES finance_manual_v26_ci.documents(document_id),
 component_key text NOT NULL CHECK (component_key IN ('BASE_AGREED','ALLOWANCE','BONUS','DEDUCTION','EMPLOYER_COST')),
 amount_vnd numeric(18,0) NOT NULL CHECK (amount_vnd BETWEEN 0 AND 9999999999999999),
 PRIMARY KEY (document_id, component_key)
);
-- Explicitly no ledger auto-posting, no foreign table attachments, no background jobs.
COMMIT;
