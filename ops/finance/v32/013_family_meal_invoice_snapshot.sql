-- Extend the existing immutable invoice snapshot with fixed resident meal policy
-- and verified family-extra-meal source evidence. Additive and isolated-only.
BEGIN;
ALTER TABLE public.billing_invoice_items
  ADD COLUMN service_code text,
  ADD COLUMN price_list_id text,
  ADD COLUMN price_list_version integer,
  ADD CONSTRAINT billing_invoice_item_price_version_fk
    FOREIGN KEY(price_list_id,price_list_version)
    REFERENCES public.service_price_list_versions(price_list_id,version) ON DELETE RESTRICT,
  ADD CONSTRAINT billing_invoice_item_family_meal_source_ck CHECK (
    (source_domain='NUTRITION' AND source_entity_type='FAMILY_EXTRA_MEAL')
      = (service_code='FAMILY_EXTRA_MEAL' AND price_list_id IS NOT NULL AND price_list_version IS NOT NULL AND price_list_version>0)
  );

CREATE FUNCTION public.finance_snapshot_family_meal_policy()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE family_lines jsonb;
DECLARE expected_family_meals bigint;
BEGIN
  IF NOT (OLD.status='APPROVED' AND NEW.status='ISSUED') THEN RETURN NEW; END IF;
  IF NEW.source_snapshot IS NULL THEN RAISE EXCEPTION 'FINANCE_FAMILY_MEAL_SNAPSHOT_REQUIRED'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sourceEventId',i.source_entity_id,
    'serviceCode',i.service_code,
    'serviceDate',o.service_date,
    'mealType',o.meal_type,
    'confirmedQuantity',o.confirmed_quantity,
    'unitPriceVnd',o.unit_price_vnd::text,
    'amountVnd',o.amount_vnd::text,
    'priceListId',i.price_list_id,
    'priceListVersion',i.price_list_version,
    'confirmedBy',o.confirmed_by,
    'confirmedRole',o.confirmed_role,
    'confirmedAt',o.confirmed_at,
    'confirmationReason',o.confirmation_reason,
    'evidenceSha256',i.source_evidence_sha256
  ) ORDER BY o.service_date,o.order_id),'[]'::jsonb)
    INTO family_lines
    FROM public.billing_invoice_items i
    JOIN public.family_extra_meal_orders o ON o.order_id=i.source_entity_id
   WHERE i.invoice_id=NEW.invoice_id
     AND i.source_domain='NUTRITION'
     AND i.source_entity_type='FAMILY_EXTRA_MEAL'
     AND i.service_code='FAMILY_EXTRA_MEAL'
     AND o.status='CONFIRMED'
     AND o.resident_id=NEW.resident_id
     AND o.contract_id=NEW.contract_id
     AND i.quantity=o.confirmed_quantity
     AND i.unit_price_vnd=o.unit_price_vnd
     AND i.service_period_start=o.service_date
     AND i.service_period_end=(o.service_date+1)
     AND o.price_list_id=i.price_list_id
     AND o.price_list_version=i.price_list_version
     AND o.amount_vnd=i.line_total_vnd;
  IF jsonb_array_length(family_lines) < (
    SELECT count(*) FROM public.billing_invoice_items
     WHERE invoice_id=NEW.invoice_id AND source_domain='NUTRITION'
       AND source_entity_type='FAMILY_EXTRA_MEAL'
  ) THEN RAISE EXCEPTION 'FINANCE_FAMILY_MEAL_SOURCE_MISMATCH'; END IF;
  SELECT count(*) INTO expected_family_meals
    FROM public.family_extra_meal_orders o
   WHERE o.resident_id=NEW.resident_id
     AND o.contract_id=NEW.contract_id
     AND o.status='CONFIRMED'
     AND o.service_date>=NEW.billing_month
     AND o.service_date<(NEW.billing_month + INTERVAL '1 month')::date;
  IF jsonb_array_length(family_lines)<>expected_family_meals THEN
    RAISE EXCEPTION 'FINANCE_FAMILY_MEAL_SOURCE_OMITTED';
  END IF;
  NEW.source_snapshot := jsonb_set(NEW.source_snapshot,'{residentMealPolicy}',
    '{"includedInContractPackage":true,"separatelyBillable":false}'::jsonb,true);
  NEW.source_snapshot := jsonb_set(NEW.source_snapshot,'{familyExtraMeals}',family_lines,true);
  NEW.source_snapshot_sha256 := encode(sha256(convert_to(NEW.source_snapshot::text,'UTF8')),'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER zz_finance_snapshot_family_meals
  BEFORE UPDATE OF status ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.finance_snapshot_family_meal_policy();
COMMIT;
