-- Development-only addition. NEVER auto-apply on Production Test.
-- One contract identity: service_contract_records; each amendment references this contract.
-- No business/demo rows are inserted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.service_contract_versions (
  contract_id text NOT NULL REFERENCES public.service_contract_records(contract_id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  payload jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('DRAFT','SIGNED','ACTIVE','SUPERSEDED','REJECTED')),
  effective_date date NOT NULL,
  signed_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(contract_id,version),
  CHECK (
    (status IN ('DRAFT','REJECTED') OR
     (signed_at IS NOT NULL AND approved_at IS NOT NULL AND approved_by IS NOT NULL))
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_single_active_version
 ON public.service_contract_versions(contract_id) WHERE status='ACTIVE';
CREATE OR REPLACE FUNCTION public.service_contract_prevent_signed_revision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='DELETE' AND OLD.status IN ('SIGNED','ACTIVE','SUPERSEDED') THEN
  RAISE EXCEPTION 'SIGNED_CONTRACT_VERSION_DELETE_FORBIDDEN';
 END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('SIGNED','ACTIVE','SUPERSEDED') AND
  NOT ((OLD.status='SIGNED' AND NEW.status IN ('SIGNED','ACTIVE')) OR
       (OLD.status='ACTIVE' AND NEW.status IN ('ACTIVE','SUPERSEDED')) OR
       (OLD.status='SUPERSEDED' AND NEW.status='SUPERSEDED')) THEN
   RAISE EXCEPTION 'CONTRACT_SIGNED_STATUS_TRANSITION_FORBIDDEN';
 END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('SIGNED','ACTIVE','SUPERSEDED')
   AND (NEW.payload IS DISTINCT FROM OLD.payload OR
        NEW.effective_date IS DISTINCT FROM OLD.effective_date OR
        NEW.signed_at IS DISTINCT FROM OLD.signed_at OR
        NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
        NEW.approved_by IS DISTINCT FROM OLD.approved_by) THEN
  RAISE EXCEPTION 'SIGNED_CONTRACT_TERMS_IMMUTABLE';
 END IF;
 RETURN COALESCE(NEW,OLD);
END;
$fn$;
DROP TRIGGER IF EXISTS service_contract_revision_immutability
 ON public.service_contract_versions;
CREATE TRIGGER service_contract_revision_immutability
 BEFORE UPDATE OR DELETE ON public.service_contract_versions
 FOR EACH ROW EXECUTE FUNCTION public.service_contract_prevent_signed_revision_mutation();
COMMIT;
