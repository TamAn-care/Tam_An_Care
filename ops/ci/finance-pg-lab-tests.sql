\set ON_ERROR_STOP on
\echo FINANCE_PG_LAB_BEGIN
INSERT INTO billing_invoices VALUES ('I1','R1','ISSUED',100),('I2','R1','ISSUED',50),('I3','R2','ISSUED',100),('I4','R1','DRAFT',100);
INSERT INTO billing_receipts VALUES ('P1','R1','CONFIRMED',100),('P2','R1','CONFIRMED',80),('P3','R2','CONFIRMED',50),('P4','R1','DRAFT',100);
CREATE OR REPLACE PROCEDURE expect_rejected(sql_text text, expected_message text)
LANGUAGE plpgsql AS $body$
BEGIN
 EXECUTE sql_text;
 RAISE EXCEPTION 'UNEXPECTED_SUCCESS: %',sql_text;
EXCEPTION WHEN OTHERS THEN
 IF SQLERRM = 'UNEXPECTED_SUCCESS: ' || sql_text THEN RAISE; END IF;
 IF position(expected_message in SQLERRM) = 0 THEN
   RAISE EXCEPTION 'WRONG_REJECTION expected %, got %',expected_message,SQLERRM;
 END IF;
END;
$body$;
INSERT INTO billing_payment_allocations VALUES ('A1','P1','I1',70);
CALL expect_rejected($q$INSERT INTO billing_payment_allocations VALUES ('A2','P1','I2',40)$q$,'RECEIPT_BALANCE_EXCEEDED');
CALL expect_rejected($q$INSERT INTO billing_payment_allocations VALUES ('A3','P2','I1',40)$q$,'INVOICE_BALANCE_EXCEEDED');
CALL expect_rejected($q$INSERT INTO billing_payment_allocations VALUES ('A4','P3','I1',10)$q$,'CROSS_RESIDENT_ALLOCATION_FORBIDDEN');
CALL expect_rejected($q$INSERT INTO billing_payment_allocations VALUES ('A5','P4','I2',10)$q$,'RECEIPT_STATUS_NOT_ELIGIBLE');
CALL expect_rejected($q$INSERT INTO billing_payment_allocations VALUES ('A6','P2','I4',10)$q$,'INVOICE_STATUS_NOT_ELIGIBLE');
CALL expect_rejected($q$INSERT INTO billing_payment_allocations VALUES ('A7','P2','I2',1.5)$q$,'INVALID_ALLOCATION_AMOUNT');
CALL expect_rejected($q$INSERT INTO billing_payment_allocations VALUES ('A1','P2','I2',10)$q$,'duplicate key');
CALL expect_rejected($q$UPDATE billing_payment_allocations SET amount_vnd=10 WHERE allocation_id='A1'$q$,'FINANCE_ALLOCATION_UPDATE_FORBIDDEN');
CALL expect_rejected($q$DELETE FROM billing_payment_allocations WHERE allocation_id='A1'$q$,'FINANCE_ALLOCATION_DELETE_FORBIDDEN');
INSERT INTO finance_operation_idempotency(operation_key,operation_type,request_hash,actor_id) VALUES ('retry-1','RECEIPT',repeat('a',64),'tester');
CALL expect_rejected($q$INSERT INTO finance_operation_idempotency(operation_key,operation_type,request_hash,actor_id) VALUES ('retry-1','RECEIPT',repeat('a',64),'tester')$q$,'duplicate key');
INSERT INTO finance_entries VALUES ('F1','SYSTEM','BILLING','INVOICE','I1','REVENUE');
CALL expect_rejected($q$INSERT INTO finance_entries VALUES ('F2','SYSTEM','BILLING','INVOICE','I1','REVENUE')$q$,'duplicate key');
-- Unique index does not cover manual rows. Record scope precisely without claiming full double-revenue prevention.
INSERT INTO finance_entries VALUES ('F3','MANUAL',NULL,NULL,NULL,'REVENUE'),('F4','MANUAL',NULL,NULL,NULL,'REVENUE');
DO $body$
BEGIN
 IF (SELECT count(*) FROM billing_payment_allocations)<>1 THEN
  RAISE EXCEPTION 'ALLOCATION_ASSERTION_FAILED'; END IF;
 IF (SELECT sum(amount_vnd) FROM billing_payment_allocations WHERE receipt_id='P1')<>70 THEN
  RAISE EXCEPTION 'AMOUNT_ASSERTION_FAILED'; END IF;
END;
$body$;
CALL expect_rejected($q$UPDATE billing_receipts SET status='VOID' WHERE receipt_id='P1'$q$,'ALLOCATED_RECEIPT_STATUS_FORBIDDEN');
CALL expect_rejected($q$UPDATE billing_invoices SET status='VOID' WHERE invoice_id='I1'$q$,'ALLOCATED_INVOICE_STATUS_FORBIDDEN');
UPDATE billing_invoices SET status='PARTIAL' WHERE invoice_id='I1';
UPDATE billing_invoices SET status='ISSUED' WHERE invoice_id='I1';
DO $body$
BEGIN
 IF (SELECT status FROM billing_receipts WHERE receipt_id='P1') <> 'CONFIRMED' THEN
  RAISE EXCEPTION 'RECEIPT_STATUS_GUARD_ASSERTION_FAILED'; END IF;
 IF (SELECT status FROM billing_invoices WHERE invoice_id='I1') <> 'ISSUED' THEN
  RAISE EXCEPTION 'INVOICE_STATUS_GUARD_ASSERTION_FAILED'; END IF;
END;
$body$;
\echo FINANCE_PG_LAB_SERIAL_PASS
