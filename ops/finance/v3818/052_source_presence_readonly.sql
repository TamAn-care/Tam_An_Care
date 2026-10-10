-- TÂM AN CARE V3.8.18.52 — metadata & bounded presence counts only.
-- Must run inside BEGIN TRANSACTION READ ONLY; never reads personal data columns.
DO $$
DECLARE x record; n bigint; cap integer:=10001;
BEGIN
 IF current_database()<>'taman_care' OR current_user<>'taman' OR
 current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'V52_WRONG_TARGET_OR_NOT_READ_ONLY'; END IF;
 RAISE NOTICE 'V52_START database=% mode=READ_ONLY count_cap=%',current_database(),cap;
 FOR x IN
  SELECT c.relname AS relation
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='public' AND c.relkind IN ('r','p')
    AND (
      c.relname IN (
        'finance_entries','finance_entry_audit','finance_manual_documents',
        'admission_cases','admission_care_classifications','resident_leave_requests',
        'kitchen_receiving_batches','kitchen_receiving_batch_items',
        'inventory_transactions','resident_consumption_events'
      )
      OR c.relname ~* '(contract|invoice|payment|receipt|fee|charge|billing|payroll|salary|wage|leave|stock|expense|cost|revenue|finance)'
    )
    AND has_table_privilege(c.oid,'SELECT')
  ORDER BY c.relname
 LOOP
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I LIMIT %s) v',x.relation,cap) INTO n;
  RAISE NOTICE 'V52_SOURCE relation=% sampled_rows=% truncated=%',
   x.relation,n,(n>=cap);
 END LOOP;
 RAISE NOTICE 'V52_COMPLETE: presence only; no approval/recognition implied';
END $$;
