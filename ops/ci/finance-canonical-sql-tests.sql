\set ON_ERROR_STOP on
-- CI ONLY: arbitrary synthetic rows in a disposable GitHub service database.
INSERT INTO public.service_contract_records(contract_id,contract_code,resident_id,status,payload)
 VALUES ('CI_C1','CI_CONTRACT','CI_R1','ACTIVE','{}');
INSERT INTO public.billing_invoices(invoice_id,invoice_code,resident_id,contract_id,billing_month,status,total_amount_vnd)
 VALUES ('CI_I1','CI_INV1','CI_R1','CI_C1','2026-10-01','ISSUED',100),
        ('CI_I2','CI_INV2','CI_R1','CI_C1','2026-10-01','ISSUED',50),
        ('CI_I3','CI_INV3','CI_R2',NULL,'2026-10-01','ISSUED',50);
INSERT INTO public.billing_invoice_items(item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd)
 VALUES ('CI_LINE1','CI_I1','CI_ONLY',1,100,100);
INSERT INTO public.billing_receipts(receipt_id,receipt_code,resident_id,amount_vnd,received_date,status)
 VALUES ('CI_RP1','CI_RECEIPT1','CI_R1',100,'2026-10-09','CONFIRMED'),
        ('CI_RP2','CI_RECEIPT2','CI_R1',50,'2026-10-09','CONFIRMED'),
        ('CI_RP3','CI_RECEIPT3','CI_R2',50,'2026-10-09','CONFIRMED');
CREATE OR REPLACE PROCEDURE ci_expect_rejected(stmt text, marker text)
LANGUAGE plpgsql AS $body$
BEGIN
 EXECUTE stmt;
 RAISE EXCEPTION 'CI_UNEXPECTED_SUCCESS';
EXCEPTION WHEN OTHERS THEN
 IF SQLERRM='CI_UNEXPECTED_SUCCESS' OR position(marker in SQLERRM)=0 THEN
   RAISE EXCEPTION 'CI_WRONG_RESULT %, expected %', SQLERRM,marker;
 END IF;
END;
$body$;
INSERT INTO public.billing_payment_allocations(allocation_id,receipt_id,invoice_id,amount_vnd)
 VALUES ('CI_A1','CI_RP1','CI_I1',70);
CALL ci_expect_rejected($q$INSERT INTO public.billing_payment_allocations VALUES ('CI_A2','CI_RP1','CI_I2',40)$q$,'RECEIPT_BALANCE_EXCEEDED');
CALL ci_expect_rejected($q$INSERT INTO public.billing_payment_allocations VALUES ('CI_A3','CI_RP2','CI_I1',40)$q$,'INVOICE_BALANCE_EXCEEDED');
CALL ci_expect_rejected($q$INSERT INTO public.billing_payment_allocations VALUES ('CI_A4','CI_RP3','CI_I1',1)$q$,'CROSS_RESIDENT_ALLOCATION_FORBIDDEN');
CALL ci_expect_rejected($q$UPDATE public.billing_payment_allocations SET amount_vnd=5 WHERE allocation_id='CI_A1'$q$,'FINANCE_ALLOCATION_UPDATE_FORBIDDEN');
CALL ci_expect_rejected($q$DELETE FROM public.billing_payment_allocations WHERE allocation_id='CI_A1'$q$,'FINANCE_ALLOCATION_DELETE_FORBIDDEN');
CALL ci_expect_rejected($q$UPDATE public.billing_receipts SET status='VOID' WHERE receipt_id='CI_RP1'$q$,'ALLOCATED_RECEIPT_STATUS_FORBIDDEN');
CALL ci_expect_rejected($q$UPDATE public.billing_invoices SET status='VOID' WHERE invoice_id='CI_I1'$q$,'ALLOCATED_INVOICE_STATUS_FORBIDDEN');
INSERT INTO public.finance_operation_idempotency(operation_key,operation_type,request_hash,actor_id)
 VALUES ('CI_OP1','ALLOCATE',repeat('a',64),'CI_ACTOR');
CALL ci_expect_rejected($q$INSERT INTO public.finance_operation_idempotency(operation_key,operation_type,request_hash,actor_id) VALUES('CI_OP1','ALLOCATE',repeat('a',64),'CI_ACTOR')$q$,'duplicate key');
DO $body$
BEGIN
 IF (SELECT count(*) FROM billing_payment_allocations) <> 1 THEN
  RAISE EXCEPTION 'CI_ALLOCATION_COUNT_INVALID';
 END IF;
END;
$body$;
\echo FINANCE_CANONICAL_SQL_ISOLATED_PASS
