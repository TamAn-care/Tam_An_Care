-- Additive, isolated-only catalog for versioned service prices. No price data is seeded.
BEGIN;
CREATE TABLE public.service_price_lists (
  price_list_id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(code)) BETWEEN 2 AND 80),
  CHECK (length(trim(name)) BETWEEN 2 AND 200)
);
CREATE TABLE public.service_price_list_versions (
  price_list_id text NOT NULL REFERENCES public.service_price_lists(price_list_id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SUPERSEDED')),
  effective_from date NOT NULL,
  effective_to date,
  currency text NOT NULL DEFAULT 'VND' CHECK (currency='VND'),
  items jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text,
  submitted_at timestamptz,
  edited_by text,
  edited_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_reason text,
  PRIMARY KEY(price_list_id,version),
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  CHECK(jsonb_typeof(items)='array'),
  CHECK((status='DRAFT' AND submitted_by IS NULL AND submitted_at IS NULL AND decided_by IS NULL AND decided_at IS NULL)
    OR (status='PENDING_APPROVAL' AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL AND decided_by IS NULL AND decided_at IS NULL)
    OR (status IN ('APPROVED','REJECTED','SUPERSEDED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND length(trim(decision_reason))>=3))
);
CREATE INDEX service_price_versions_effective_lookup ON public.service_price_list_versions(status,effective_from,effective_to);
CREATE TABLE public.service_price_approval_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  price_list_id text NOT NULL,
  version integer NOT NULL,
  actor_id text NOT NULL,
  actor_role text,
  action text NOT NULL CHECK(action IN ('CREATED','EDITED','SUBMITTED','APPROVED','REJECTED','SUPERSEDED')),
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(price_list_id,version) REFERENCES public.service_price_list_versions(price_list_id,version) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION public.finance_validate_service_price_items()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE item jsonb; amount numeric;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FINANCE_PRICE_VERSION_DELETE_FORBIDDEN'; END IF;
  IF TG_OP='UPDATE' AND OLD.status <> 'DRAFT' AND
     (NEW.effective_from,NEW.effective_to,NEW.items,NEW.created_by,NEW.created_at,NEW.submitted_by,NEW.submitted_at)
       IS DISTINCT FROM
     (OLD.effective_from,OLD.effective_to,OLD.items,OLD.created_by,OLD.created_at,OLD.submitted_by,OLD.submitted_at) THEN
    RAISE EXCEPTION 'FINANCE_PRICE_VERSION_IMMUTABLE';
  END IF;
  IF NEW.status='DRAFT' OR NEW.status='PENDING_APPROVAL' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
      IF jsonb_typeof(item) <> 'object'
         OR COALESCE(item->>'serviceCode','') !~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'
         OR COALESCE(item->>'name','') = ''
         OR COALESCE(item->>'unit','') NOT IN ('MONTH','DAY','MEAL','SERVICE','HOUR','VISIT')
         OR COALESCE(item->>'scope','') NOT IN ('ROOM','CARE','MEAL','SERVICE','SURCHARGE','PACKAGE')
         OR COALESCE(item->>'amountVnd','') !~ '^(0|[1-9][0-9]{0,19})$' THEN
        RAISE EXCEPTION 'FINANCE_PRICE_ITEM_INVALID';
      END IF;
      amount := (item->>'amountVnd')::numeric;
      IF amount > 99999999999999999999 THEN RAISE EXCEPTION 'FINANCE_PRICE_AMOUNT_OUT_OF_RANGE'; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.items) AS e(price_item)
      GROUP BY price_item->>'serviceCode',price_item->>'scope' HAVING count(*)>1) THEN
      RAISE EXCEPTION 'FINANCE_PRICE_DUPLICATE_SERVICE_SCOPE';
    END IF;
  END IF;
  IF NEW.status='APPROVED' AND OLD.status='PENDING_APPROVAL' THEN
    IF NEW.decided_by=NEW.created_by OR NEW.decided_by=NEW.submitted_by THEN
      RAISE EXCEPTION 'FINANCE_PRICE_APPROVAL_SEPARATION_REQUIRED';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('service-price:' || NEW.price_list_id,0));
    IF EXISTS (
      SELECT 1 FROM public.service_price_list_versions v
       CROSS JOIN LATERAL jsonb_array_elements(v.items) old_item
       CROSS JOIN LATERAL jsonb_array_elements(NEW.items) new_item
       WHERE v.status='APPROVED' AND (v.price_list_id,v.version)<>(NEW.price_list_id,NEW.version)
         AND old_item->>'serviceCode'=new_item->>'serviceCode'
         AND old_item->>'scope'=new_item->>'scope'
         AND daterange(v.effective_from,COALESCE(v.effective_to+1,'infinity'::date),'[)')
           && daterange(NEW.effective_from,COALESCE(NEW.effective_to+1,'infinity'::date),'[)')
    ) THEN RAISE EXCEPTION 'FINANCE_PRICE_EFFECTIVE_PERIOD_CONFLICT'; END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status<>NEW.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status='PENDING_APPROVAL') OR
    (OLD.status='PENDING_APPROVAL' AND NEW.status IN ('APPROVED','REJECTED')) OR
    (OLD.status='APPROVED' AND NEW.status='SUPERSEDED')
  ) THEN RAISE EXCEPTION 'FINANCE_PRICE_STATE_TRANSITION_FORBIDDEN'; END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_service_price_version_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.service_price_list_versions
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_service_price_items();
CREATE OR REPLACE FUNCTION public.finance_service_price_audit()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.service_price_approval_audit(price_list_id,version,actor_id,actor_role,action,reason)
  VALUES(NEW.price_list_id,NEW.version,COALESCE(NEW.decided_by,NEW.submitted_by,NEW.edited_by,NEW.created_by),
    NULLIF(current_setting('taman.finance_actor_role',true),''),
    CASE WHEN TG_OP='UPDATE' AND OLD.status='DRAFT' AND NEW.status='DRAFT' THEN 'EDITED'
         WHEN NEW.status='PENDING_APPROVAL' THEN 'SUBMITTED' WHEN NEW.status='APPROVED' THEN 'APPROVED'
         WHEN NEW.status='REJECTED' THEN 'REJECTED' ELSE 'CREATED' END,
    COALESCE(NEW.decision_reason,CASE WHEN NEW.status='PENDING_APPROVAL' THEN 'Submitted for approval' WHEN NEW.edited_by IS NOT NULL THEN 'Draft revised' ELSE 'Draft created' END));
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_service_price_audit_on_insert
  AFTER INSERT ON public.service_price_list_versions FOR EACH ROW EXECUTE FUNCTION public.finance_service_price_audit();
CREATE TRIGGER finance_service_price_audit_on_draft_edit
  AFTER UPDATE OF effective_from,effective_to,items ON public.service_price_list_versions
  FOR EACH ROW WHEN (OLD.status='DRAFT' AND NEW.status='DRAFT'
    AND (OLD.effective_from,OLD.effective_to,OLD.items) IS DISTINCT FROM (NEW.effective_from,NEW.effective_to,NEW.items))
  EXECUTE FUNCTION public.finance_service_price_audit();
CREATE TRIGGER finance_service_price_audit_on_decision
  AFTER UPDATE OF status ON public.service_price_list_versions FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.finance_service_price_audit();
CREATE OR REPLACE FUNCTION public.finance_service_price_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN RAISE EXCEPTION 'FINANCE_PRICE_AUDIT_IMMUTABLE'; END $fn$;
CREATE TRIGGER finance_service_price_audit_immutable_guard
  BEFORE UPDATE OR DELETE ON public.service_price_approval_audit
  FOR EACH ROW EXECUTE FUNCTION public.finance_service_price_audit_immutable();
COMMIT;
