-- FINANCE CI LAB ONLY. Reconstructed behavioral fixture from verified V2.9.74.7 report.
-- NOT the canonical four SQL migration sources. NEVER deploy or auto-migrate.
CREATE TABLE billing_invoices (
 invoice_id text PRIMARY KEY, resident_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('DRAFT','APPROVED','ISSUED','PARTIAL','PAID','VOID')),
 total_amount_vnd numeric(18,2) NOT NULL CHECK(total_amount_vnd >= 0)
);
CREATE TABLE billing_receipts (
 receipt_id text PRIMARY KEY, resident_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('DRAFT','CONFIRMED','VOID')),
 amount_vnd numeric(18,2) NOT NULL CHECK(amount_vnd > 0)
);
CREATE TABLE billing_payment_allocations (
 allocation_id text PRIMARY KEY,
 receipt_id text NOT NULL REFERENCES billing_receipts(receipt_id),
 invoice_id text NOT NULL REFERENCES billing_invoices(invoice_id),
 amount_vnd numeric(18,2) NOT NULL CHECK(amount_vnd > 0),
 UNIQUE(receipt_id,invoice_id)
);
CREATE TABLE finance_operation_idempotency (
 operation_key text PRIMARY KEY, operation_type text NOT NULL,
 request_hash char(64) NOT NULL, actor_id text NOT NULL,
 status text NOT NULL DEFAULT 'IN_PROGRESS'
  CHECK(status IN ('IN_PROGRESS','COMPLETED')),
 completed_at timestamptz,
 CHECK((status='IN_PROGRESS' AND completed_at IS NULL) OR
       (status='COMPLETED' AND completed_at IS NOT NULL))
);
CREATE TABLE finance_entries (
 finance_entry_id text PRIMARY KEY,
 source_mode text NOT NULL CHECK(source_mode IN ('MANUAL','SYSTEM')),
 source_domain text, source_entity_type text, source_entity_id text,
 entry_type text NOT NULL
);
CREATE UNIQUE INDEX uq_finance_entries_system_source
ON finance_entries(source_domain,source_entity_type,source_entity_id,entry_type)
WHERE source_mode='SYSTEM'
AND source_domain IS NOT NULL
AND source_entity_type IS NOT NULL
AND source_entity_id IS NOT NULL;
CREATE OR REPLACE FUNCTION finance_validate_allocation() RETURNS trigger
LANGUAGE plpgsql AS $body$
DECLARE r record; i record; receipt_used numeric; invoice_used numeric;
BEGIN
 IF NEW.amount_vnd IS NULL OR NEW.amount_vnd <= 0 OR NEW.amount_vnd <> trunc(NEW.amount_vnd)
 THEN RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT'; END IF;
 SELECT receipt_id,resident_id,amount_vnd,status INTO r FROM billing_receipts
 WHERE receipt_id=NEW.receipt_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RECEIPT_NOT_FOUND'; END IF;
 SELECT invoice_id,resident_id,total_amount_vnd,status INTO i FROM billing_invoices
 WHERE invoice_id=NEW.invoice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;
 IF r.resident_id IS DISTINCT FROM i.resident_id THEN
  RAISE EXCEPTION 'CROSS_RESIDENT_ALLOCATION_FORBIDDEN'; END IF;
 IF r.status <> 'CONFIRMED' THEN RAISE EXCEPTION 'RECEIPT_STATUS_NOT_ELIGIBLE'; END IF;
 IF i.status NOT IN ('ISSUED','PARTIAL') THEN RAISE EXCEPTION 'INVOICE_STATUS_NOT_ELIGIBLE'; END IF;
 SELECT COALESCE(SUM(amount_vnd),0) INTO receipt_used FROM billing_payment_allocations
 WHERE receipt_id=NEW.receipt_id AND allocation_id IS DISTINCT FROM NEW.allocation_id;
 SELECT COALESCE(SUM(amount_vnd),0) INTO invoice_used FROM billing_payment_allocations
 WHERE invoice_id=NEW.invoice_id AND allocation_id IS DISTINCT FROM NEW.allocation_id;
 IF receipt_used+NEW.amount_vnd > r.amount_vnd THEN
  RAISE EXCEPTION 'RECEIPT_BALANCE_EXCEEDED'; END IF;
 IF invoice_used+NEW.amount_vnd > i.total_amount_vnd THEN
  RAISE EXCEPTION 'INVOICE_BALANCE_EXCEEDED'; END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER finance_allocation_guard BEFORE INSERT OR UPDATE
ON billing_payment_allocations FOR EACH ROW EXECUTE FUNCTION finance_validate_allocation();
CREATE OR REPLACE FUNCTION finance_reject_allocation_mutation() RETURNS trigger
LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FINANCE_ALLOCATION_DELETE_FORBIDDEN'; END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'FINANCE_ALLOCATION_UPDATE_FORBIDDEN'; END IF;
 RAISE EXCEPTION 'UNSUPPORTED_ALLOCATION_MUTATION';
END;
$body$;
CREATE TRIGGER finance_allocation_immutability BEFORE UPDATE OR DELETE
ON billing_payment_allocations FOR EACH ROW
EXECUTE FUNCTION finance_reject_allocation_mutation();
