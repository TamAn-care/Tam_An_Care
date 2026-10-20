-- Tâm An Care Finance V42.8. Additive isolated migration.
-- No seed data. Never apply to Production Test without separate approval.
BEGIN;

ALTER TABLE public.billing_invoices
  DROP CONSTRAINT IF EXISTS billing_invoices_status_check;
ALTER TABLE public.billing_invoices
  ADD CONSTRAINT billing_invoices_status_check
  CHECK (status IN ('DRAFT','REVIEWED','APPROVED','ISSUED','PARTIAL','PAID','VOID'));

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS issued_by text,
  ADD COLUMN IF NOT EXISTS invoice_kind text NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS billing_origin_key text;

DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='billing_invoice_kind_ck') THEN
    ALTER TABLE public.billing_invoices ADD CONSTRAINT billing_invoice_kind_ck
      CHECK (invoice_kind IN ('GENERAL','FAMILY_MEAL'));
  END IF;
END $constraint$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoice_origin
  ON public.billing_invoices(billing_origin_key)
  WHERE billing_origin_key IS NOT NULL;

ALTER TABLE public.billing_receipts
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS supporting_document_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_receipt_external_reference
  ON public.billing_receipts(external_reference)
  WHERE external_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.finance_document_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_type text NOT NULL CHECK (document_type IN ('INVOICE','RECEIPT','ADJUSTMENT','PERIOD')),
  document_id text NOT NULL,
  action text NOT NULL,
  actor_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_periods (
  period_month date PRIMARY KEY CHECK (EXTRACT(DAY FROM period_month)=1),
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED')) DEFAULT 'OPEN',
  closed_by text,
  closed_at timestamptz,
  reopened_by text,
  reopened_at timestamptz,
  reopen_reason text,
  CHECK ((status='OPEN' AND closed_by IS NULL AND closed_at IS NULL)
      OR (status='CLOSED' AND closed_by IS NOT NULL AND closed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.finance_adjustments (
  adjustment_id text PRIMARY KEY,
  period_month date NOT NULL REFERENCES public.finance_periods(period_month),
  document_id text NOT NULL,
  amount_vnd numeric NOT NULL CHECK (amount_vnd<>0 AND amount_vnd=trunc(amount_vnd)),
  reason text NOT NULL CHECK (length(trim(reason))>=10),
  status text NOT NULL CHECK (status IN ('DRAFT','APPROVED','POSTED','VOID')) DEFAULT 'DRAFT',
  requested_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, period_month)
);

CREATE OR REPLACE FUNCTION public.finance_reject_closed_period_mutation()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE period_date date;
BEGIN
  IF TG_TABLE_NAME='finance_periods' THEN RETURN NEW; END IF;
  period_date := CASE
    WHEN TG_TABLE_NAME='billing_invoices' THEN COALESCE((to_jsonb(NEW)->>'billing_month')::date,(to_jsonb(OLD)->>'billing_month')::date)
    WHEN TG_TABLE_NAME='billing_receipts' THEN date_trunc('month',COALESCE((to_jsonb(NEW)->>'received_date')::date,(to_jsonb(OLD)->>'received_date')::date))::date
    WHEN TG_TABLE_NAME='finance_entries' THEN date_trunc('month',COALESCE((to_jsonb(NEW)->>'recognition_date')::date,(to_jsonb(OLD)->>'recognition_date')::date))::date
    WHEN TG_TABLE_NAME='finance_adjustments' THEN COALESCE((to_jsonb(NEW)->>'period_month')::date,(to_jsonb(OLD)->>'period_month')::date)
    ELSE NULL END;
  IF period_date IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.finance_periods WHERE period_month=period_date AND status='CLOSED'
  ) THEN RAISE EXCEPTION 'FINANCE_PERIOD_CLOSED'; END IF;
  RETURN COALESCE(NEW,OLD);
END $fn$;

DROP TRIGGER IF EXISTS finance_invoice_closed_period_guard ON public.billing_invoices;
CREATE TRIGGER finance_invoice_closed_period_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.billing_invoices
FOR EACH ROW EXECUTE FUNCTION public.finance_reject_closed_period_mutation();
DROP TRIGGER IF EXISTS finance_receipt_closed_period_guard ON public.billing_receipts;
CREATE TRIGGER finance_receipt_closed_period_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.billing_receipts
FOR EACH ROW EXECUTE FUNCTION public.finance_reject_closed_period_mutation();
DROP TRIGGER IF EXISTS finance_entry_closed_period_guard ON public.finance_entries;
CREATE TRIGGER finance_entry_closed_period_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_entries
FOR EACH ROW EXECUTE FUNCTION public.finance_reject_closed_period_mutation();
DROP TRIGGER IF EXISTS finance_adjustment_closed_period_guard ON public.finance_adjustments;
CREATE TRIGGER finance_adjustment_closed_period_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_adjustments
FOR EACH ROW EXECUTE FUNCTION public.finance_reject_closed_period_mutation();

CREATE OR REPLACE FUNCTION public.finance_guard_invoice_state_transition()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.status <> NEW.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status IN ('REVIEWED','APPROVED','VOID')) OR
    (OLD.status='REVIEWED' AND NEW.status IN ('APPROVED','VOID')) OR
    (OLD.status='APPROVED' AND NEW.status IN ('ISSUED','VOID')) OR
    (OLD.status='ISSUED' AND NEW.status IN ('PARTIAL','PAID','VOID')) OR
    (OLD.status='PARTIAL' AND NEW.status='PAID')
  ) THEN RAISE EXCEPTION 'FINANCE_INVOICE_STATUS_TRANSITION_FORBIDDEN'; END IF;
  IF OLD.status NOT IN ('DRAFT','REVIEWED') AND (
    OLD.invoice_code IS DISTINCT FROM NEW.invoice_code OR OLD.resident_id IS DISTINCT FROM NEW.resident_id OR
    OLD.contract_id IS DISTINCT FROM NEW.contract_id OR OLD.contract_version IS DISTINCT FROM NEW.contract_version OR
    OLD.billing_month IS DISTINCT FROM NEW.billing_month OR OLD.total_amount_vnd IS DISTINCT FROM NEW.total_amount_vnd OR
    OLD.prepared_by IS DISTINCT FROM NEW.prepared_by OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by OR
    OLD.approved_by IS DISTINCT FROM NEW.approved_by OR OLD.approved_at IS DISTINCT FROM NEW.approved_at OR
    OLD.approval_evidence_sha256 IS DISTINCT FROM NEW.approval_evidence_sha256
  ) THEN RAISE EXCEPTION 'FINANCE_APPROVED_INVOICE_IMMUTABLE'; END IF;
  RETURN NEW;
END $fn$;

COMMIT;
