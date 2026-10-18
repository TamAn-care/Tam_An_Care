-- Finance V1.0: approved, time-bound discounts and evidenced meal deductions.
-- Additive only; isolated CI migration. No backfill or business rows.
BEGIN;

ALTER TABLE public.billing_invoice_items
  ADD COLUMN discount_scope text CHECK (
    discount_scope IN ('ROOM','CARE','SERVICE','NON_DISCOUNTABLE')
  );

CREATE TABLE public.finance_discount_policies (
  discount_id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('PERCENT','FIXED_AMOUNT')),
  discount_value numeric(20,0) NOT NULL CHECK (discount_value >= 0 AND discount_value <= 99999999999999999999),
  eligible_fee_scope text NOT NULL CHECK (eligible_fee_scope IN ('ROOM','CARE','ROOM_AND_CARE','ELIGIBLE_SERVICES')),
  application_mode text NOT NULL CHECK (application_mode IN ('PERCENT','MONTHLY_PRORATED','ONE_TIME')),
  effective_from date NOT NULL,
  effective_to date,
  approval_state text NOT NULL CHECK (approval_state IN ('PROPOSED','APPROVED','REJECTED','REVOKED')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  approval_reason text,
  decision_by text,
  decision_at timestamptz,
  decision_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (length(trim(code)) >= 2 AND length(trim(name)) >= 2 AND length(trim(created_by)) >= 2),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK ((discount_type = 'PERCENT' AND discount_value <= 100 AND application_mode = 'PERCENT') OR
         (discount_type = 'FIXED_AMOUNT' AND application_mode IN ('MONTHLY_PRORATED','ONE_TIME'))),
  CHECK (
    (approval_state='PROPOSED' AND approved_by IS NULL AND approved_at IS NULL
      AND decision_by IS NULL AND decision_at IS NULL AND decision_reason IS NULL)
    OR (approval_state='APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL
      AND length(trim(approval_reason)) >= 3 AND approved_by <> created_by
      AND decision_by=approved_by AND decision_at=approved_at AND length(trim(decision_reason)) >= 3)
    OR (approval_state='REJECTED' AND approved_by IS NULL AND approved_at IS NULL
      AND decision_by IS NOT NULL AND decision_at IS NOT NULL AND length(trim(decision_reason)) >= 3)
    OR (approval_state='REVOKED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL
      AND decision_by IS NOT NULL AND decision_at IS NOT NULL AND length(trim(decision_reason)) >= 3)
  )
);

CREATE TABLE public.finance_discount_assignments (
  assignment_id text PRIMARY KEY,
  discount_id text NOT NULL REFERENCES public.finance_discount_policies(discount_id) ON DELETE RESTRICT,
  resident_id text NOT NULL REFERENCES public.residents(resident_id) ON DELETE RESTRICT,
  contract_id text NOT NULL REFERENCES public.service_contract_records(contract_id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  effective_to date,
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  source_reference text NOT NULL,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (length(trim(assigned_by)) >= 2 AND length(trim(source_reference)) >= 8),
  UNIQUE (discount_id, resident_id, contract_id, effective_from)
);
CREATE INDEX finance_discount_assignment_lookup
  ON public.finance_discount_assignments(resident_id, contract_id, effective_from, effective_to);

CREATE OR REPLACE FUNCTION public.finance_guard_discount_assignment()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE policy_state text; contract_resident text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'FINANCE_DISCOUNT_ASSIGNMENT_IMMUTABLE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('discount-assignment:' || NEW.resident_id || ':' || NEW.contract_id, 0));
  SELECT approval_state INTO policy_state FROM public.finance_discount_policies WHERE discount_id=NEW.discount_id;
  SELECT resident_id INTO contract_resident FROM public.service_contract_records WHERE contract_id=NEW.contract_id;
  IF policy_state <> 'APPROVED' OR contract_resident IS DISTINCT FROM NEW.resident_id THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_ASSIGNMENT_SOURCE_MISMATCH';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_discount_assignments a
     WHERE a.resident_id=NEW.resident_id AND a.contract_id=NEW.contract_id
       AND daterange(a.effective_from, COALESCE(a.effective_to + 1, 'infinity'::date), '[)')
           && daterange(NEW.effective_from, COALESCE(NEW.effective_to + 1, 'infinity'::date), '[)')
  ) THEN RAISE EXCEPTION 'FINANCE_OVERLAPPING_DISCOUNTS_REQUIRE_EXPLICIT_APPROVAL'; END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_discount_assignment_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.finance_discount_assignments
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_discount_assignment();

CREATE TABLE public.billing_discount_applications (
  application_id text PRIMARY KEY,
  discount_id text NOT NULL REFERENCES public.finance_discount_policies(discount_id) ON DELETE RESTRICT,
  assignment_id text NOT NULL REFERENCES public.finance_discount_assignments(assignment_id) ON DELETE RESTRICT,
  invoice_id text NOT NULL REFERENCES public.billing_invoices(invoice_id) ON DELETE RESTRICT,
  eligible_invoice_item_id text NOT NULL REFERENCES public.billing_invoice_items(item_id) ON DELETE RESTRICT,
  invoice_item_id text NOT NULL REFERENCES public.billing_invoice_items(item_id) ON DELETE RESTRICT,
  source_key text NOT NULL UNIQUE,
  effective_from date NOT NULL,
  effective_to date NOT NULL,
  eligible_base_vnd numeric(20,0) NOT NULL CHECK (eligible_base_vnd >= 0),
  amount_vnd numeric(20,0) NOT NULL CHECK (amount_vnd >= 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to >= effective_from),
  CHECK (amount_vnd <= eligible_base_vnd),
  CHECK (source_key ~ '^[A-Za-z0-9:_-]{8,200}$')
);
CREATE INDEX billing_discount_application_invoice ON public.billing_discount_applications(invoice_id);

-- Evidence binds an existing leave source; family confirmation and update dates are explicit.
-- This table records qualification evidence, it does not infer meal unit prices.
CREATE TABLE public.finance_absence_deduction_evidence (
  evidence_id text PRIMARY KEY,
  source_domain text NOT NULL,
  source_id text NOT NULL,
  resident_id text NOT NULL REFERENCES public.residents(resident_id) ON DELETE RESTRICT,
  absence_from date NOT NULL,
  absence_to date NOT NULL,
  notified_at timestamptz NOT NULL,
  family_confirmed_at timestamptz,
  family_confirmation_reference text,
  required_update_dates date[] NOT NULL DEFAULT '{}',
  approved_by text,
  approved_at timestamptz,
  approval_reason text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_domain, source_id),
  CHECK (absence_to >= absence_from),
  CHECK ((family_confirmed_at IS NULL AND family_confirmation_reference IS NULL) OR
         (family_confirmed_at IS NOT NULL AND length(trim(family_confirmation_reference)) >= 3)),
  CHECK ((approved_by IS NULL AND approved_at IS NULL) OR
         (approved_by IS NOT NULL AND approved_at IS NOT NULL AND length(trim(approval_reason)) >= 3
          AND approved_by <> created_by AND family_confirmed_at IS NOT NULL
          AND family_confirmation_reference IS NOT NULL))
);

CREATE TABLE public.finance_discount_policy_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  discount_id text NOT NULL REFERENCES public.finance_discount_policies(discount_id) ON DELETE RESTRICT,
  version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATED','APPROVED','REJECTED','REVOKED','SUPERSEDED')),
  actor_id text NOT NULL,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (discount_id, version, action)
);

CREATE OR REPLACE FUNCTION public.finance_guard_absence_evidence()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE update_date date;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'FINANCE_ABSENCE_EVIDENCE_IMMUTABLE'; END IF;
  IF NEW.source_domain !~ '^[A-Z][A-Z0-9_]{1,63}$' OR length(trim(NEW.source_id)) < 2 THEN
    RAISE EXCEPTION 'FINANCE_ABSENCE_SOURCE_INVALID';
  END IF;
  FOREACH update_date IN ARRAY NEW.required_update_dates LOOP
    IF update_date < NEW.absence_from OR update_date > NEW.absence_to THEN
      RAISE EXCEPTION 'FINANCE_ABSENCE_UPDATE_DATE_OUTSIDE_RANGE';
    END IF;
  END LOOP;
  IF cardinality(NEW.required_update_dates) <>
     (SELECT count(DISTINCT d) FROM unnest(NEW.required_update_dates) AS d) THEN
    RAISE EXCEPTION 'FINANCE_ABSENCE_UPDATE_DATE_DUPLICATE';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_absence_evidence_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.finance_absence_deduction_evidence
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_absence_evidence();

CREATE OR REPLACE FUNCTION public.finance_guard_discount_policy()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'FINANCE_DISCOUNT_POLICY_DELETE_FORBIDDEN'; END IF;
  IF OLD.approval_state IN ('APPROVED','REVOKED') AND
     (NEW.code, NEW.name, NEW.discount_type, NEW.discount_value, NEW.eligible_fee_scope, NEW.application_mode,
      NEW.effective_from, NEW.effective_to, NEW.created_by, NEW.approved_by, NEW.approved_at,
      NEW.approval_reason, NEW.version) IS DISTINCT FROM
     (OLD.code, OLD.name, OLD.discount_type, OLD.discount_value, OLD.eligible_fee_scope, OLD.application_mode,
      OLD.effective_from, OLD.effective_to, OLD.created_by, OLD.approved_by, OLD.approved_at,
      OLD.approval_reason, OLD.version) THEN
    RAISE EXCEPTION 'FINANCE_APPROVED_DISCOUNT_TERMS_IMMUTABLE';
  END IF;
  IF OLD.approval_state=NEW.approval_state AND
     (NEW.decision_by,NEW.decision_at,NEW.decision_reason) IS DISTINCT FROM
     (OLD.decision_by,OLD.decision_at,OLD.decision_reason) THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_DECISION_IMMUTABLE';
  END IF;
  IF OLD.approval_state='PROPOSED' AND
     (NEW.code,NEW.name,NEW.discount_type,NEW.discount_value,NEW.eligible_fee_scope,
      NEW.application_mode,NEW.effective_from,NEW.effective_to) IS DISTINCT FROM
     (OLD.code,OLD.name,OLD.discount_type,OLD.discount_value,OLD.eligible_fee_scope,
      OLD.application_mode,OLD.effective_from,OLD.effective_to) AND NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_REVISION_REQUIRES_NEW_VERSION';
  END IF;
  IF OLD.approval_state <> 'PROPOSED' AND NEW.approval_state=OLD.approval_state AND
     (NEW.discount_type,NEW.discount_value,NEW.eligible_fee_scope,NEW.application_mode,
      NEW.effective_from,NEW.effective_to) IS DISTINCT FROM
     (OLD.discount_type,OLD.discount_value,OLD.eligible_fee_scope,OLD.application_mode,
      OLD.effective_from,OLD.effective_to) THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_NONPROPOSED_TERMS_IMMUTABLE';
  END IF;
  IF OLD.approval_state <> NEW.approval_state AND NOT (
       (OLD.approval_state='PROPOSED' AND NEW.approval_state IN ('APPROVED','REJECTED')) OR
       (OLD.approval_state='APPROVED' AND NEW.approval_state='REVOKED')) THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_STATE_TRANSITION_FORBIDDEN';
  END IF;
  IF OLD.approval_state <> NEW.approval_state AND
     (NEW.decision_by IS NULL OR NEW.decision_at IS NULL OR length(trim(NEW.decision_reason)) < 3) THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_DECISION_EVIDENCE_REQUIRED';
  END IF;
  IF NEW.approval_state='APPROVED' AND OLD.approval_state <> 'APPROVED' AND NEW.version <> OLD.version THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_APPROVAL_VERSION_MISMATCH';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_discount_policy_guard
  BEFORE UPDATE OR DELETE ON public.finance_discount_policies
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_discount_policy();

CREATE OR REPLACE FUNCTION public.finance_guard_discount_application()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  invoice_status text;
  policy_state text;
  invoice_resident text;
  assignment_resident text;
  policy_id text;
  policy_start date;
  policy_end date;
  assignment_start date;
  assignment_end date;
  item_start date;
  item_end date;
  item_total numeric;
  discount_item_total numeric;
  discount_item_kind text;
  discount_type_value text;
  discount_mode_value text;
  discount_value_value numeric;
  billing_month_value date;
  expected_discount numeric;
  eligible_item_kind text;
  eligible_item_scope text;
  policy_fee_scope text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'FINANCE_DISCOUNT_APPLICATION_IMMUTABLE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('discount-application:' || NEW.eligible_invoice_item_id, 0));
  SELECT i.status,i.resident_id,p.approval_state,p.discount_id,a.resident_id,
         p.effective_from,p.effective_to,a.effective_from,a.effective_to,
         base.service_period_start,base.service_period_end,base.line_total_vnd,
         base.line_kind,base.discount_scope,
         discount.line_total_vnd,discount.line_kind,p.discount_type,p.application_mode,
         p.discount_value,i.billing_month,p.eligible_fee_scope
    INTO invoice_status,invoice_resident,policy_state,policy_id,assignment_resident,
         policy_start,policy_end,assignment_start,assignment_end,item_start,item_end,item_total,
         eligible_item_kind,eligible_item_scope,
         discount_item_total,discount_item_kind,discount_type_value,discount_mode_value,
         discount_value_value,billing_month_value,policy_fee_scope
    FROM public.billing_invoices i
    JOIN public.finance_discount_assignments a ON a.assignment_id=NEW.assignment_id
    JOIN public.finance_discount_policies p ON p.discount_id=a.discount_id
    JOIN public.billing_invoice_items base ON base.item_id=NEW.eligible_invoice_item_id AND base.invoice_id=i.invoice_id
    JOIN public.billing_invoice_items discount ON discount.item_id=NEW.invoice_item_id AND discount.invoice_id=i.invoice_id
   WHERE i.invoice_id=NEW.invoice_id AND a.discount_id=NEW.discount_id;
  IF NOT FOUND OR invoice_status <> 'DRAFT' OR policy_state <> 'APPROVED' OR
     invoice_resident <> assignment_resident OR NEW.effective_from < policy_start OR
     (policy_end IS NOT NULL AND NEW.effective_to > policy_end) OR
     NEW.effective_from < assignment_start OR
     (assignment_end IS NOT NULL AND NEW.effective_to > assignment_end) OR
     NEW.effective_from < item_start OR NEW.effective_to >= item_end OR
     eligible_item_kind NOT IN ('CONTRACT_FEE','APPROVED_SERVICE') OR
     eligible_item_scope IS NULL OR eligible_item_scope='NON_DISCOUNTABLE' OR
     NOT ((policy_fee_scope='ROOM' AND eligible_item_scope='ROOM') OR
          (policy_fee_scope='CARE' AND eligible_item_scope='CARE') OR
          (policy_fee_scope='ROOM_AND_CARE' AND eligible_item_scope IN ('ROOM','CARE')) OR
          (policy_fee_scope='ELIGIBLE_SERVICES' AND eligible_item_scope='SERVICE')) OR
     NEW.eligible_base_vnd > item_total OR NEW.amount_vnd > NEW.eligible_base_vnd THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_APPLICATION_NOT_ELIGIBLE';
  END IF;
  IF discount_item_kind <> 'DISCOUNT' OR discount_item_total <> -NEW.amount_vnd THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_LINE_MISMATCH';
  END IF;
  IF discount_type_value='PERCENT' THEN
    expected_discount := LEAST(NEW.eligible_base_vnd, round(NEW.eligible_base_vnd * discount_value_value / 100));
  ELSIF discount_mode_value='MONTHLY_PRORATED' THEN
    expected_discount := LEAST(NEW.eligible_base_vnd,
      round(discount_value_value * (NEW.effective_to - NEW.effective_from + 1)::numeric /
        ((billing_month_value + INTERVAL '1 month')::date - billing_month_value)));
  ELSE
    expected_discount := LEAST(NEW.eligible_base_vnd, discount_value_value);
  END IF;
  IF NEW.amount_vnd <> expected_discount THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_AMOUNT_CALCULATION_MISMATCH';
  END IF;
  IF EXISTS (SELECT 1 FROM public.billing_discount_applications x
      WHERE x.eligible_invoice_item_id=NEW.eligible_invoice_item_id
        AND daterange(x.effective_from,x.effective_to + 1,'[)')
            && daterange(NEW.effective_from,NEW.effective_to + 1,'[)')) THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_STACKING_FORBIDDEN';
  END IF;
  IF (SELECT COALESCE(sum(amount_vnd),0) FROM public.billing_discount_applications
       WHERE eligible_invoice_item_id=NEW.eligible_invoice_item_id) + NEW.amount_vnd > NEW.eligible_base_vnd THEN
    RAISE EXCEPTION 'FINANCE_DISCOUNT_EXCEEDS_ELIGIBLE_BASE';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_discount_application_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_discount_applications
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_discount_application();

CREATE OR REPLACE FUNCTION public.finance_audit_discount_policy()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE action_value text;
BEGIN
  action_value := CASE NEW.approval_state WHEN 'APPROVED' THEN 'APPROVED' WHEN 'REJECTED' THEN 'REJECTED' WHEN 'REVOKED' THEN 'REVOKED' ELSE 'CREATED' END;
  INSERT INTO public.finance_discount_policy_audit(discount_id,version,action,actor_id,reason)
  VALUES (NEW.discount_id,NEW.version,action_value,
    CASE WHEN NEW.approval_state='PROPOSED' THEN NEW.created_by ELSE NEW.decision_by END,
    CASE WHEN NEW.approval_state='PROPOSED' THEN 'Policy proposed' ELSE NEW.decision_reason END)
  ON CONFLICT (discount_id,version,action) DO NOTHING;
  RETURN NEW;
END $fn$;
CREATE TRIGGER finance_discount_policy_audit_on_change
  AFTER INSERT OR UPDATE ON public.finance_discount_policies
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_discount_policy();

CREATE OR REPLACE FUNCTION public.finance_freeze_discount_audit()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN RAISE EXCEPTION 'FINANCE_DISCOUNT_AUDIT_IMMUTABLE'; END $fn$;
CREATE TRIGGER finance_discount_audit_immutable
  BEFORE UPDATE OR DELETE ON public.finance_discount_policy_audit
  FOR EACH ROW EXECUTE FUNCTION public.finance_freeze_discount_audit();

COMMIT;
