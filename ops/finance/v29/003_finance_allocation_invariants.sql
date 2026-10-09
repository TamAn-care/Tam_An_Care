
-- Tâm An Care: finance database invariants.
-- Development migration only. NEVER auto-run.
-- No INSERT, demo data, seed, or modifications to existing rows.

CREATE OR REPLACE FUNCTION public.finance_validate_allocation()
RETURNS trigger
LANGUAGE plpgsql AS $body$
DECLARE
  r RECORD;
  i RECORD;
  receipt_used numeric;
  invoice_used numeric;
BEGIN
  IF NEW.amount_vnd IS NULL OR NEW.amount_vnd <= 0
     OR NEW.amount_vnd <> trunc(NEW.amount_vnd) THEN
    RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT';
  END IF;

  -- Consistent parent lock order for concurrent operations.
  SELECT receipt_id, resident_id, amount_vnd, status
    INTO r
    FROM public.billing_receipts
   WHERE receipt_id = NEW.receipt_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECEIPT_NOT_FOUND';
  END IF;

  SELECT invoice_id, resident_id, total_amount_vnd, status
    INTO i
    FROM public.billing_invoices
   WHERE invoice_id = NEW.invoice_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;

  IF r.resident_id IS DISTINCT FROM i.resident_id THEN
    RAISE EXCEPTION 'CROSS_RESIDENT_ALLOCATION_FORBIDDEN';
  END IF;

  IF r.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'RECEIPT_STATUS_NOT_ELIGIBLE';
  END IF;

  IF i.status NOT IN ('ISSUED','PARTIAL') THEN
    RAISE EXCEPTION 'INVOICE_STATUS_NOT_ELIGIBLE';
  END IF;

  SELECT COALESCE(SUM(amount_vnd),0)
    INTO receipt_used
    FROM public.billing_payment_allocations
   WHERE receipt_id = NEW.receipt_id
     AND allocation_id IS DISTINCT FROM NEW.allocation_id;

  SELECT COALESCE(SUM(amount_vnd),0)
    INTO invoice_used
    FROM public.billing_payment_allocations
   WHERE invoice_id = NEW.invoice_id
     AND allocation_id IS DISTINCT FROM NEW.allocation_id;

  IF receipt_used + NEW.amount_vnd > r.amount_vnd THEN
    RAISE EXCEPTION 'RECEIPT_BALANCE_EXCEEDED';
  END IF;

  IF invoice_used + NEW.amount_vnd > i.total_amount_vnd THEN
    RAISE EXCEPTION 'INVOICE_BALANCE_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS finance_allocation_guard
ON public.billing_payment_allocations;

CREATE TRIGGER finance_allocation_guard
BEFORE INSERT OR UPDATE
ON public.billing_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.finance_validate_allocation();


CREATE OR REPLACE FUNCTION public.finance_protect_document()
RETURNS trigger
LANGUAGE plpgsql AS $body$
DECLARE
  linked boolean;
BEGIN
  IF TG_TABLE_NAME = 'billing_receipts' THEN
    IF OLD.resident_id IS DISTINCT FROM NEW.resident_id
       OR OLD.amount_vnd IS DISTINCT FROM NEW.amount_vnd THEN

      SELECT EXISTS (
        SELECT 1 FROM public.billing_payment_allocations
        WHERE receipt_id = OLD.receipt_id
      ) INTO linked;

      IF linked THEN
        RAISE EXCEPTION 'ALLOCATED_RECEIPT_IMMUTABLE';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'billing_invoices' THEN
    IF OLD.resident_id IS DISTINCT FROM NEW.resident_id
       OR OLD.total_amount_vnd IS DISTINCT FROM NEW.total_amount_vnd THEN

      SELECT EXISTS (
        SELECT 1 FROM public.billing_payment_allocations
        WHERE invoice_id = OLD.invoice_id
      ) INTO linked;

      IF linked THEN
        RAISE EXCEPTION 'ALLOCATED_INVOICE_IMMUTABLE';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS finance_receipt_protection
ON public.billing_receipts;

CREATE TRIGGER finance_receipt_protection
BEFORE UPDATE ON public.billing_receipts
FOR EACH ROW
EXECUTE FUNCTION public.finance_protect_document();

DROP TRIGGER IF EXISTS finance_invoice_protection
ON public.billing_invoices;

CREATE TRIGGER finance_invoice_protection
BEFORE UPDATE ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.finance_protect_document();