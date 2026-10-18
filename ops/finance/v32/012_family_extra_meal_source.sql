-- Additive source-of-truth for family extra meals. No price or business rows seeded.
-- Resident meals remain part of the signed contract package and are not represented here.
BEGIN;

CREATE TABLE public.family_extra_meal_orders (
  order_id text PRIMARY KEY,
  resident_id text NOT NULL REFERENCES public.residents(resident_id) ON DELETE RESTRICT,
  contract_id text REFERENCES public.service_contract_records(contract_id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('BREAKFAST','LUNCH','AFTERNOON_SNACK','DINNER')),
  registered_quantity integer NOT NULL CHECK (registered_quantity > 0 AND registered_quantity <= 100),
  status text NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED','CONFIRMED')),
  registered_by text NOT NULL,
  registered_role text NOT NULL CHECK (registered_role='GUARDIAN'),
  registered_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE,
  confirmed_quantity integer,
  confirmed_by text,
  confirmed_role text,
  confirmed_at timestamptz,
  price_list_id text,
  price_list_version integer,
  service_code text,
  unit_price_vnd bigint,
  amount_vnd bigint,
  confirmation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status='REGISTERED' AND confirmed_quantity IS NULL AND confirmed_by IS NULL AND confirmed_at IS NULL AND price_list_id IS NULL AND price_list_version IS NULL AND service_code IS NULL AND unit_price_vnd IS NULL AND amount_vnd IS NULL)
    OR
    (status='CONFIRMED' AND confirmed_quantity IS NOT NULL AND confirmed_quantity > 0 AND confirmed_quantity <= registered_quantity AND confirmed_by IS NOT NULL AND confirmed_role IS NOT NULL AND confirmed_at IS NOT NULL AND price_list_id IS NOT NULL AND price_list_version IS NOT NULL AND price_list_version > 0 AND service_code='FAMILY_EXTRA_MEAL' AND unit_price_vnd IS NOT NULL AND unit_price_vnd >= 0 AND amount_vnd IS NOT NULL AND amount_vnd=confirmed_quantity*unit_price_vnd AND confirmation_reason IS NOT NULL AND length(trim(confirmation_reason)) >= 5)
  )
);
ALTER TABLE public.family_extra_meal_orders
  ADD CONSTRAINT family_extra_meal_price_version_fk
  FOREIGN KEY(price_list_id,price_list_version)
  REFERENCES public.service_price_list_versions(price_list_id,version)
  ON DELETE RESTRICT;
CREATE INDEX family_extra_meal_orders_period_idx ON public.family_extra_meal_orders(resident_id,service_date,status);
CREATE UNIQUE INDEX family_extra_meal_confirmed_charge_once ON public.family_extra_meal_orders(order_id) WHERE status='CONFIRMED';

CREATE TABLE public.family_extra_meal_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.family_extra_meal_orders(order_id) ON DELETE RESTRICT,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL CHECK(action IN ('REGISTERED','CONFIRMED')),
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.guard_family_extra_meal_order() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FAMILY_EXTRA_MEAL_DELETE_FORBIDDEN'; END IF;
  IF OLD.status='CONFIRMED' THEN RAISE EXCEPTION 'FAMILY_EXTRA_MEAL_CONFIRMATION_IMMUTABLE'; END IF;
  IF NEW.status<>'CONFIRMED' OR OLD.status<>'REGISTERED' THEN
    RAISE EXCEPTION 'FAMILY_EXTRA_MEAL_TRANSITION_INVALID';
  END IF;
  IF NEW.order_id<>OLD.order_id OR NEW.resident_id<>OLD.resident_id OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
    OR NEW.service_date<>OLD.service_date OR NEW.meal_type<>OLD.meal_type OR NEW.registered_quantity<>OLD.registered_quantity
    OR NEW.registered_by<>OLD.registered_by OR NEW.registered_at<>OLD.registered_at OR NEW.idempotency_key<>OLD.idempotency_key THEN
    RAISE EXCEPTION 'FAMILY_EXTRA_MEAL_REGISTRATION_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER family_extra_meal_order_guard BEFORE UPDATE OR DELETE ON public.family_extra_meal_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_family_extra_meal_order();
CREATE FUNCTION public.guard_family_extra_meal_audit() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FAMILY_EXTRA_MEAL_AUDIT_IMMUTABLE'; END $$;
CREATE TRIGGER family_extra_meal_audit_immutable BEFORE UPDATE OR DELETE ON public.family_extra_meal_audit
FOR EACH ROW EXECUTE FUNCTION public.guard_family_extra_meal_audit();
REVOKE ALL ON public.family_extra_meal_orders, public.family_extra_meal_audit FROM PUBLIC;
COMMIT;
