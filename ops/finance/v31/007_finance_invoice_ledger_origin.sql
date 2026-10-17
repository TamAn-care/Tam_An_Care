-- Finance V3.1.7: invoice provenance and whole-VND ledger invariants.
-- Versioned schema change. Isolated PostgreSQL 16 CI only until separately approved.
-- No business rows are created or backfilled by this migration.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.residents') IS NULL
     OR to_regclass('public.finance_entries') IS NULL
     OR to_regclass('public.service_contract_records') IS NULL
     OR to_regclass('public.service_contract_versions') IS NULL
     OR to_regclass('public.service_contract_signing_evidence') IS NULL
     OR to_regclass('public.service_contract_approval_decisions') IS NULL
     OR to_regclass('public.billing_invoices') IS NULL
     OR to_regclass('public.billing_invoice_items') IS NULL
     OR to_regclass('public.billing_receipts') IS NULL
     OR to_regclass('public.billing_payment_allocations') IS NULL THEN
    RAISE EXCEPTION 'FINANCE_V317_REQUIRED_SCHEMA_MISSING';
  END IF;

  -- Never infer contract versions or source origins for existing billing rows.
  IF EXISTS (SELECT 1 FROM public.billing_invoices)
     OR EXISTS (SELECT 1 FROM public.billing_invoice_items)
     OR EXISTS (SELECT 1 FROM public.billing_receipts)
     OR EXISTS (SELECT 1 FROM public.billing_payment_allocations) THEN
    RAISE EXCEPTION 'FINANCE_V317_EXISTING_BILLING_REQUIRES_RECONCILED_BACKFILL';
  END IF;

  IF EXISTS (SELECT 1 FROM public.billing_invoices WHERE total_amount_vnd <> trunc(total_amount_vnd))
     OR EXISTS (SELECT 1 FROM public.billing_invoice_items WHERE unit_price_vnd <> trunc(unit_price_vnd) OR line_total_vnd <> trunc(line_total_vnd))
     OR EXISTS (SELECT 1 FROM public.billing_receipts WHERE amount_vnd <> trunc(amount_vnd))
     OR EXISTS (SELECT 1 FROM public.billing_payment_allocations WHERE amount_vnd <> trunc(amount_vnd))
     OR EXISTS (SELECT 1 FROM public.service_contract_approval_decisions WHERE monthly_fee_vnd <> trunc(monthly_fee_vnd)) THEN
    RAISE EXCEPTION 'FINANCE_V317_FRACTIONAL_VND_REQUIRES_MANUAL_REVIEW';
  END IF;
END
$preflight$;

-- Actual Production Test uses text resident IDs and numeric(18,2) amount_vnd.
-- Remove the scale typmod without rounding, then enforce whole VND. Keeping
-- numeric(18,2) would round sufficiently small fractions before CHECK runs.
ALTER TABLE public.service_contract_records
  ADD CONSTRAINT service_contract_resident_fk
  FOREIGN KEY (resident_id) REFERENCES public.residents(resident_id) ON DELETE RESTRICT;

ALTER TABLE public.billing_invoices
  ADD COLUMN contract_version integer,
  ADD COLUMN prepared_by text,
  ADD COLUMN reviewed_by text,
  ADD COLUMN approved_by text,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN approval_evidence_sha256 char(64);

ALTER TABLE public.billing_invoice_items
  ADD COLUMN line_kind text,
  ADD COLUMN service_period_start date,
  ADD COLUMN service_period_end date,
  ADD COLUMN source_domain text,
  ADD COLUMN source_entity_type text,
  ADD COLUMN source_entity_id text,
  ADD COLUMN source_evidence_sha256 char(64),
  ADD COLUMN financial_origin_key text;

ALTER TABLE public.billing_invoices
  ALTER COLUMN total_amount_vnd TYPE numeric USING total_amount_vnd::numeric;
ALTER TABLE public.billing_invoice_items
  ALTER COLUMN unit_price_vnd TYPE numeric USING unit_price_vnd::numeric,
  ALTER COLUMN line_total_vnd TYPE numeric USING line_total_vnd::numeric;
ALTER TABLE public.billing_receipts
  ALTER COLUMN amount_vnd TYPE numeric USING amount_vnd::numeric;
ALTER TABLE public.billing_payment_allocations
  ALTER COLUMN amount_vnd TYPE numeric USING amount_vnd::numeric;
ALTER TABLE public.service_contract_approval_decisions
  ALTER COLUMN monthly_fee_vnd TYPE numeric USING monthly_fee_vnd::numeric;
ALTER TABLE public.finance_entries
  ALTER COLUMN amount_vnd TYPE numeric USING amount_vnd::numeric;

ALTER TABLE public.billing_invoices
  ADD CONSTRAINT billing_invoice_whole_vnd_ck CHECK (
    total_amount_vnd = trunc(total_amount_vnd)
    AND total_amount_vnd BETWEEN 0 AND 9999999999999999
  );
ALTER TABLE public.billing_invoice_items
  ADD CONSTRAINT billing_invoice_item_whole_vnd_ck CHECK (
    unit_price_vnd = trunc(unit_price_vnd)
    AND line_total_vnd = trunc(line_total_vnd)
    AND unit_price_vnd BETWEEN -9999999999999999 AND 9999999999999999
    AND line_total_vnd BETWEEN -9999999999999999 AND 9999999999999999
  );
ALTER TABLE public.billing_receipts
  ADD CONSTRAINT billing_receipt_whole_vnd_ck CHECK (
    amount_vnd = trunc(amount_vnd)
    AND amount_vnd BETWEEN 0 AND 9999999999999999
  );
ALTER TABLE public.billing_payment_allocations
  ADD CONSTRAINT billing_allocation_whole_vnd_ck CHECK (
    amount_vnd = trunc(amount_vnd)
    AND amount_vnd BETWEEN 0 AND 9999999999999999
  );
ALTER TABLE public.service_contract_approval_decisions
  ADD CONSTRAINT service_contract_approval_whole_vnd_ck CHECK (
    monthly_fee_vnd = trunc(monthly_fee_vnd)
    AND monthly_fee_vnd BETWEEN 0 AND 9999999999999999
  );

ALTER TABLE public.billing_invoices
  ALTER COLUMN contract_id SET NOT NULL,
  ALTER COLUMN contract_version SET NOT NULL,
  ADD CONSTRAINT billing_invoice_contract_version_fk
    FOREIGN KEY (contract_id, contract_version)
    REFERENCES public.service_contract_versions(contract_id, version) ON DELETE RESTRICT,
  ADD CONSTRAINT billing_invoice_approval_evidence_ck CHECK (
    status NOT IN ('APPROVED','ISSUED','PARTIAL','PAID') OR
    (prepared_by IS NOT NULL AND reviewed_by IS NOT NULL
     AND approved_by IS NOT NULL AND approved_at IS NOT NULL
     AND approval_evidence_sha256 IS NOT NULL
     AND prepared_by <> reviewed_by AND prepared_by <> approved_by
     AND reviewed_by <> approved_by
     AND approval_evidence_sha256 ~ '^[a-f0-9]{64}$')
  );

ALTER TABLE public.billing_invoice_items
  ALTER COLUMN line_kind SET NOT NULL,
  ALTER COLUMN service_period_start SET NOT NULL,
  ALTER COLUMN service_period_end SET NOT NULL,
  ALTER COLUMN financial_origin_key SET NOT NULL,
  ADD CONSTRAINT billing_invoice_item_kind_ck CHECK (
    line_kind IN ('CONTRACT_FEE','APPROVED_SERVICE','LEAVE_ADJUSTMENT',
                  'APPROVED_ADJUSTMENT','DISCOUNT','SURCHARGE')
  ),
  ADD CONSTRAINT billing_invoice_item_period_ck CHECK (service_period_start < service_period_end),
  ADD CONSTRAINT billing_invoice_item_origin_ck CHECK (
    financial_origin_key ~ '^[A-Za-z0-9:_-]{8,200}$'
  ),
  ADD CONSTRAINT billing_invoice_item_source_evidence_ck CHECK (
    (line_kind = 'CONTRACT_FEE' AND source_domain IS NULL
      AND source_entity_type IS NULL AND source_entity_id IS NULL
      AND source_evidence_sha256 IS NULL)
    OR
    (line_kind <> 'CONTRACT_FEE'
      AND source_domain IS NOT NULL
      AND source_entity_type IS NOT NULL
      AND source_entity_id IS NOT NULL
      AND source_evidence_sha256 IS NOT NULL
      AND source_domain ~ '^[A-Z][A-Z0-9_]{1,63}$'
      AND source_entity_type ~ '^[A-Z][A-Z0-9_]{1,63}$'
      AND source_entity_id ~ '^[A-Za-z0-9_-]{1,160}$'
      AND source_evidence_sha256 ~ '^[a-f0-9]{64}$')
  ),
  ADD CONSTRAINT billing_invoice_item_exact_vnd_ck CHECK (
    line_total_vnd = quantity * unit_price_vnd
    AND (line_kind <> 'CONTRACT_FEE' OR line_total_vnd >= 0)
    AND (line_kind <> 'DISCOUNT' OR line_total_vnd <= 0)
  );

CREATE UNIQUE INDEX uq_billing_invoice_item_financial_origin
  ON public.billing_invoice_items(financial_origin_key);

-- Existing ledger amounts remain numeric(18,2) for compatibility. These
-- NOT VALID checks constrain every new/updated row without rewriting history.
ALTER TABLE public.finance_entries
  ADD COLUMN financial_origin_key text,
  ADD CONSTRAINT finance_entries_whole_vnd_ck
    CHECK (amount_vnd = trunc(amount_vnd)
      AND amount_vnd BETWEEN -9999999999999999 AND 9999999999999999) NOT VALID,
  ADD CONSTRAINT finance_entries_posted_origin_ck CHECK (
    status <> 'POSTED' OR
    (financial_origin_key IS NOT NULL
     AND source_mode IS NOT NULL
     AND source_domain IS NOT NULL
     AND source_entity_type IS NOT NULL
     AND source_entity_id IS NOT NULL
     AND financial_origin_key ~ '^[A-Za-z0-9:_-]{8,200}$'
     AND source_mode IN ('SYSTEM','MANUAL')
     AND source_domain ~ '^[A-Z][A-Z0-9_]{1,63}$'
     AND source_entity_type ~ '^[A-Z][A-Z0-9_]{1,63}$'
     AND source_entity_id ~ '^[A-Za-z0-9_-]{1,160}$')
  ) NOT VALID;

CREATE UNIQUE INDEX uq_finance_entries_financial_origin
  ON public.finance_entries(financial_origin_key)
  WHERE financial_origin_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.finance_validate_invoice_before_issue()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  contract_resident text;
  contract_status text;
  contract_effective_date date;
  contract_signed_at timestamptz;
  contract_approved_at timestamptz;
  signed_hash char(64);
  approved_hash char(64);
  approved_monthly_fee numeric(18,0);
  line_total numeric(20,0);
  contract_fee_total numeric(20,0);
  line_count bigint;
  month_end date;
BEGIN
  IF NEW.status NOT IN ('APPROVED','ISSUED','PARTIAL','PAID') THEN
    RETURN NEW;
  END IF;

  SELECT c.resident_id,v.status,v.effective_date,v.signed_at,v.approved_at,
         s.document_sha256,a.approved_sha256,a.monthly_fee_vnd
    INTO contract_resident,contract_status,contract_effective_date,
         contract_signed_at,contract_approved_at,signed_hash,approved_hash,
         approved_monthly_fee
    FROM public.service_contract_records c
    JOIN public.service_contract_versions v
      ON v.contract_id=c.contract_id AND v.version=NEW.contract_version
    JOIN public.service_contract_signing_evidence s
      ON s.contract_id=v.contract_id AND s.version=v.version
    JOIN public.service_contract_approval_decisions a
      ON a.contract_id=v.contract_id AND a.version=v.version
   WHERE c.contract_id=NEW.contract_id;

  IF NOT FOUND OR contract_resident IS DISTINCT FROM NEW.resident_id
     OR contract_status <> 'ACTIVE' OR contract_signed_at IS NULL
     OR contract_approved_at IS NULL OR contract_effective_date > NEW.billing_month
     OR signed_hash IS DISTINCT FROM approved_hash
     OR NEW.approval_evidence_sha256 IS DISTINCT FROM approved_hash THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_CONTRACT_APPROVAL_MISMATCH';
  END IF;
  IF NEW.approved_at < contract_approved_at
     OR length(trim(NEW.prepared_by)) < 2
     OR length(trim(NEW.reviewed_by)) < 2
     OR length(trim(NEW.approved_by)) < 2 THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_APPROVAL_ACTORS_INVALID';
  END IF;

  month_end := (NEW.billing_month + INTERVAL '1 month')::date;
  SELECT count(*),COALESCE(sum(line_total_vnd),0),
         COALESCE(sum(line_total_vnd) FILTER (WHERE line_kind='CONTRACT_FEE'),0)
    INTO line_count,line_total,contract_fee_total
    FROM public.billing_invoice_items WHERE invoice_id=NEW.invoice_id;
  IF line_count=0 OR line_total <> NEW.total_amount_vnd THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_TOTAL_DOES_NOT_MATCH_LINES';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.billing_invoice_items
     WHERE invoice_id=NEW.invoice_id
       AND (service_period_start < NEW.billing_month
            OR service_period_end > month_end)
  ) THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_SERVICE_PERIOD_OUTSIDE_BILLING_MONTH';
  END IF;
  IF contract_fee_total <> 0 AND contract_fee_total <> approved_monthly_fee THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_BASE_FEE_DIFFERS_FROM_APPROVED_CONTRACT';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE CONSTRAINT TRIGGER finance_invoice_issue_guard
  AFTER INSERT OR UPDATE ON public.billing_invoices
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_invoice_before_issue();

CREATE OR REPLACE FUNCTION public.finance_guard_invoice_state_transition()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.status <> NEW.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status IN ('APPROVED','VOID')) OR
    (OLD.status='APPROVED' AND NEW.status IN ('ISSUED','VOID')) OR
    (OLD.status='ISSUED' AND NEW.status IN ('PARTIAL','PAID','VOID')) OR
    (OLD.status='PARTIAL' AND NEW.status='PAID')
  ) THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_STATUS_TRANSITION_FORBIDDEN';
  END IF;
  IF OLD.status <> 'DRAFT' AND (
    OLD.invoice_code IS DISTINCT FROM NEW.invoice_code OR
    OLD.resident_id IS DISTINCT FROM NEW.resident_id OR
    OLD.contract_id IS DISTINCT FROM NEW.contract_id OR
    OLD.contract_version IS DISTINCT FROM NEW.contract_version OR
    OLD.billing_month IS DISTINCT FROM NEW.billing_month OR
    OLD.total_amount_vnd IS DISTINCT FROM NEW.total_amount_vnd OR
    OLD.prepared_by IS DISTINCT FROM NEW.prepared_by OR
    OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by OR
    OLD.approved_by IS DISTINCT FROM NEW.approved_by OR
    OLD.approved_at IS DISTINCT FROM NEW.approved_at OR
    OLD.approval_evidence_sha256 IS DISTINCT FROM NEW.approval_evidence_sha256
  ) THEN
    RAISE EXCEPTION 'FINANCE_APPROVED_INVOICE_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER finance_invoice_state_transition_guard
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_invoice_state_transition();

CREATE OR REPLACE FUNCTION public.finance_freeze_issued_invoice_items()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  parent_status text;
  invoice_id_value text;
BEGIN
  invoice_id_value := CASE WHEN TG_OP='DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  SELECT status INTO parent_status FROM public.billing_invoices
   WHERE invoice_id=invoice_id_value FOR KEY SHARE;
  IF parent_status IN ('APPROVED','ISSUED','PARTIAL','PAID','VOID') THEN
    RAISE EXCEPTION 'FINANCE_ISSUED_INVOICE_LINES_IMMUTABLE';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER finance_invoice_items_immutable_after_approval
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.finance_freeze_issued_invoice_items();

COMMIT;
