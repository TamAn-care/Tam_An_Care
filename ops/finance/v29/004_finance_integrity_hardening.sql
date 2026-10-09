
-- TAMANCARE FINANCE V2.9.14
-- DEVELOPMENT ONLY - DO NOT AUTO-DEPLOY
-- This migration adds integrity constraints without
-- creating or changing business data.

CREATE OR REPLACE FUNCTION
public.finance_reject_allocation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'FINANCE_ALLOCATION_DELETE_FORBIDDEN';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'FINANCE_ALLOCATION_UPDATE_FORBIDDEN';
  END IF;

  RAISE EXCEPTION 'UNSUPPORTED_ALLOCATION_MUTATION';
END;
$body$;

DROP TRIGGER IF EXISTS
finance_allocation_immutability
ON public.billing_payment_allocations;

CREATE TRIGGER finance_allocation_immutability
BEFORE UPDATE OR DELETE
ON public.billing_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION
public.finance_reject_allocation_mutation();


CREATE OR REPLACE FUNCTION
public.finance_protect_linked_status()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
DECLARE
  linked boolean;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'billing_receipts' THEN

    SELECT EXISTS (
      SELECT 1
      FROM public.billing_payment_allocations
      WHERE receipt_id = OLD.receipt_id
    ) INTO linked;

    IF linked AND NEW.status <> 'CONFIRMED' THEN
      RAISE EXCEPTION
        'ALLOCATED_RECEIPT_STATUS_FORBIDDEN';
    END IF;

  ELSIF TG_TABLE_NAME = 'billing_invoices' THEN

    SELECT EXISTS (
      SELECT 1
      FROM public.billing_payment_allocations
      WHERE invoice_id = OLD.invoice_id
    ) INTO linked;

    IF linked AND NEW.status NOT IN
       ('ISSUED','PARTIAL','PAID') THEN
      RAISE EXCEPTION
        'ALLOCATED_INVOICE_STATUS_FORBIDDEN';
    END IF;

  ELSE
    RAISE EXCEPTION
      'UNSUPPORTED_FINANCE_DOCUMENT';
  END IF;

  RETURN NEW;
END;
$body$;


DROP TRIGGER IF EXISTS
finance_linked_receipt_status_guard
ON public.billing_receipts;

CREATE TRIGGER finance_linked_receipt_status_guard
BEFORE UPDATE OF status
ON public.billing_receipts
FOR EACH ROW
EXECUTE FUNCTION
public.finance_protect_linked_status();


DROP TRIGGER IF EXISTS
finance_linked_invoice_status_guard
ON public.billing_invoices;

CREATE TRIGGER finance_linked_invoice_status_guard
BEFORE UPDATE OF status
ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION
public.finance_protect_linked_status();