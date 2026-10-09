-- Shared canonical contract attestations: development migration, CI ONLY.
-- No seed, no read/write of existing business rows.
BEGIN;
CREATE TABLE IF NOT EXISTS public.service_contract_signing_evidence (
 contract_id text NOT NULL,
 version integer NOT NULL,
 document_sha256 char(64) NOT NULL CHECK (document_sha256 ~ '^[0-9a-f]{64}$'),
 document_reference text NOT NULL CHECK (length(document_reference) BETWEEN 8 AND 200),
 signing_method text NOT NULL CHECK (signing_method IN ('SIGNED_PAPER_ARCHIVED','EXTERNAL_VERIFIED')),
 verified_by text NOT NULL,
 signed_at timestamptz NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(contract_id,version),
 FOREIGN KEY(contract_id,version) REFERENCES public.service_contract_versions(contract_id,version) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.service_contract_approval_decisions (
 contract_id text NOT NULL,
 version integer NOT NULL,
 approved_by text NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(),
 approval_reason text NOT NULL CHECK (length(approval_reason) BETWEEN 10 AND 2000),
 approved_sha256 char(64) NOT NULL CHECK (approved_sha256 ~ '^[0-9a-f]{64}$'),
 admission_care_level text NOT NULL,
 room_id text NOT NULL,
 bed_id text NOT NULL,
 monthly_fee_vnd numeric(18,2) NOT NULL CHECK (monthly_fee_vnd >= 0),
 PRIMARY KEY(contract_id,version),
 FOREIGN KEY(contract_id,version) REFERENCES public.service_contract_versions(contract_id,version) ON DELETE RESTRICT,
 FOREIGN KEY(contract_id,version) REFERENCES public.service_contract_signing_evidence(contract_id,version) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION public.reject_contract_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 RAISE EXCEPTION 'CONTRACT_EVIDENCE_IMMUTABLE';
END;
$fn$;
DROP TRIGGER IF EXISTS immutable_contract_signature_evidence ON public.service_contract_signing_evidence;
CREATE TRIGGER immutable_contract_signature_evidence
 BEFORE UPDATE OR DELETE ON public.service_contract_signing_evidence
 FOR EACH ROW EXECUTE FUNCTION public.reject_contract_evidence_mutation();
DROP TRIGGER IF EXISTS immutable_contract_approval_decision ON public.service_contract_approval_decisions;
CREATE TRIGGER immutable_contract_approval_decision
 BEFORE UPDATE OR DELETE ON public.service_contract_approval_decisions
 FOR EACH ROW EXECUTE FUNCTION public.reject_contract_evidence_mutation();
COMMIT;
