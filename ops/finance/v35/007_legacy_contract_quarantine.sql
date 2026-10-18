-- TAMANCARE FINANCE V35 — CI/DEVELOPMENT ONLY
-- NEVER AUTO-APPLY TO PRODUCTION TEST
-- NO REAL CONTRACTS, SEED OR MOCK BUSINESS ROWS

BEGIN;

CREATE TABLE public.legacy_contract_import_quarantine (
  import_id text PRIMARY KEY,
  source_checksum char(64) NOT NULL
    CHECK(source_checksum ~ '^[0-9a-f]{64}$'),
  source_record_number integer NOT NULL
    CHECK(source_record_number > 0),
  source_system text NOT NULL
    CHECK(source_system = 'LEGACY_BROWSER_EXPORT'),
  candidate_contract_id text NOT NULL,
  candidate_contract_code text NOT NULL,
  candidate_resident_id text NOT NULL,
  payload jsonb NOT NULL,
  review_status text NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK(review_status IN
      ('PENDING_REVIEW','REJECTED','VERIFIED')),
  canonical_resident_verified boolean NOT NULL DEFAULT false,
  signed_document_verified boolean NOT NULL DEFAULT false,
  independent_approval_verified boolean NOT NULL DEFAULT false,
  financial_posting_allowed boolean NOT NULL DEFAULT false
    CHECK(financial_posting_allowed = false),
  imported_to_canonical boolean NOT NULL DEFAULT false
    CHECK(imported_to_canonical = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_checksum,source_record_number),
  UNIQUE(source_checksum,candidate_contract_id)
);

-- The quarantine is a holding area, not an activation API.
-- Reject changes or deletion once a staged record exists.
CREATE OR REPLACE FUNCTION
 public.reject_legacy_quarantine_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'LEGACY_QUARANTINE_IMMUTABLE';
END;
$$;

CREATE TRIGGER legacy_quarantine_immutable
BEFORE UPDATE OR DELETE
ON public.legacy_contract_import_quarantine
FOR EACH ROW
EXECUTE FUNCTION public.reject_legacy_quarantine_mutation();

COMMIT;
