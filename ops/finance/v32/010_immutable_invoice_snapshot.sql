-- Finance V1.0 follow-up: freeze invoice, contract, line and discount evidence atomically on issue.
-- Additive only. Existing issued documents are not backfilled or rewritten.
BEGIN;

ALTER TABLE public.billing_invoices
  ADD COLUMN source_snapshot jsonb,
  ADD COLUMN source_snapshot_sha256 char(64),
  ADD COLUMN issued_at timestamptz,
  ADD CONSTRAINT billing_invoice_snapshot_tuple_ck CHECK (
    (source_snapshot IS NULL AND source_snapshot_sha256 IS NULL AND issued_at IS NULL)
    OR
    (source_snapshot IS NOT NULL
      AND source_snapshot->>'schemaVersion'='FINANCE_INVOICE_SNAPSHOT_V1'
      AND source_snapshot_sha256 ~ '^[a-f0-9]{64}$'
      AND issued_at IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.finance_snapshot_invoice_on_issue()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  contract_evidence jsonb;
  line_evidence jsonb;
  discount_evidence jsonb;
  snapshot_value jsonb;
  line_count bigint;
  lines_total numeric;
  contract_resident text;
  contract_status text;
  contract_effective_date date;
  contract_signed_at timestamptz;
  contract_approved_at timestamptz;
  signed_hash char(64);
  approved_hash char(64);
  approved_monthly_fee numeric;
  issue_time timestamptz;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'DRAFT' OR NEW.source_snapshot IS NOT NULL
       OR NEW.source_snapshot_sha256 IS NOT NULL OR NEW.issued_at IS NOT NULL THEN
      RAISE EXCEPTION 'FINANCE_INVOICE_MUST_START_AS_DRAFT';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.source_snapshot IS NOT NULL AND
     (NEW.source_snapshot,NEW.source_snapshot_sha256,NEW.issued_at)
       IS DISTINCT FROM
     (OLD.source_snapshot,OLD.source_snapshot_sha256,OLD.issued_at) THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_SOURCE_SNAPSHOT_IMMUTABLE';
  END IF;

  IF OLD.status='APPROVED' AND NEW.status='ISSUED' THEN
    IF OLD.source_snapshot IS NOT NULL THEN
      RAISE EXCEPTION 'FINANCE_INVOICE_ALREADY_SNAPSHOTTED';
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
       OR contract_status<>'ACTIVE' OR contract_signed_at IS NULL
       OR contract_approved_at IS NULL OR contract_effective_date>NEW.billing_month
       OR signed_hash IS DISTINCT FROM approved_hash
       OR NEW.approval_evidence_sha256 IS DISTINCT FROM approved_hash
       OR NEW.approved_at<contract_approved_at THEN
      RAISE EXCEPTION 'FINANCE_INVOICE_SNAPSHOT_CONTRACT_EVIDENCE_INVALID';
    END IF;

    SELECT count(*),COALESCE(sum(line_total_vnd),0),
      COALESCE(jsonb_agg(jsonb_build_object(
        'itemId',item_id,'description',description,'quantity',quantity::text,
        'unitPriceVnd',unit_price_vnd::text,'lineTotalVnd',line_total_vnd::text,
        'lineKind',line_kind,'discountScope',discount_scope,
        'servicePeriodStart',service_period_start,'servicePeriodEndExclusive',service_period_end,
        'sourceDomain',source_domain,'sourceEntityType',source_entity_type,
        'sourceEntityId',source_entity_id,'sourceEvidenceSha256',source_evidence_sha256,
        'financialOriginKey',financial_origin_key
      ) ORDER BY item_id),'[]'::jsonb)
      INTO line_count,lines_total,line_evidence
      FROM public.billing_invoice_items WHERE invoice_id=NEW.invoice_id;
    IF line_count=0 OR lines_total<>NEW.total_amount_vnd OR lines_total<0 THEN
      RAISE EXCEPTION 'FINANCE_INVOICE_SNAPSHOT_TOTAL_INVALID';
    END IF;

    SELECT jsonb_build_object(
      'contractId',NEW.contract_id,'contractVersion',NEW.contract_version,
      'status',v.status,'effectiveDate',v.effective_date,
      'signedAt',s.signed_at,'signedDocumentSha256',s.document_sha256,
      'signingEvidenceReference',s.document_reference,
      'verifiedBy',s.verified_by,'verifiedAt',s.verified_at,
      'approvedAt',a.approved_at,'approvedBy',a.approved_by,
      'approvedDocumentSha256',a.approved_sha256,
      'approvalReason',a.approval_reason,
      'admissionCareLevel',a.admission_care_level,
      'roomId',a.room_id,'bedId',a.bed_id,
      'approvedMonthlyFeeVnd',a.monthly_fee_vnd::text
    ) INTO contract_evidence
    FROM public.service_contract_versions v
    JOIN public.service_contract_signing_evidence s USING(contract_id,version)
    JOIN public.service_contract_approval_decisions a USING(contract_id,version)
    WHERE v.contract_id=NEW.contract_id AND v.version=NEW.contract_version;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'applicationId',d.application_id,'discountId',d.discount_id,
      'policyVersion',p.version,'discountType',p.discount_type,
      'discountValue',p.discount_value::text,'eligibleFeeScope',p.eligible_fee_scope,
      'applicationMode',p.application_mode,'policyEffectiveFrom',p.effective_from,
      'policyEffectiveTo',p.effective_to,'policyApprovedBy',p.approved_by,
      'policyApprovedAt',p.approved_at,'policyApprovalReason',p.approval_reason,
      'assignmentId',d.assignment_id,'eligibleInvoiceItemId',d.eligible_invoice_item_id,
      'discountInvoiceItemId',d.invoice_item_id,'sourceKey',d.source_key,
      'effectiveFrom',d.effective_from,'effectiveTo',d.effective_to,
      'eligibleBaseVnd',d.eligible_base_vnd::text,'amountVnd',d.amount_vnd::text
    ) ORDER BY d.application_id),'[]'::jsonb)
      INTO discount_evidence
      FROM public.billing_discount_applications d
      JOIN public.finance_discount_policies p ON p.discount_id=d.discount_id
     WHERE d.invoice_id=NEW.invoice_id;

    issue_time := clock_timestamp();
    snapshot_value := jsonb_build_object(
      'schemaVersion','FINANCE_INVOICE_SNAPSHOT_V1',
      'calculationVersion','FINANCE_BILLING_V1',
      'invoice',jsonb_build_object(
        'invoiceId',NEW.invoice_id,'invoiceCode',NEW.invoice_code,
        'residentId',NEW.resident_id,'billingMonth',NEW.billing_month,
        'totalAmountVnd',NEW.total_amount_vnd::text,
        'preparedBy',NEW.prepared_by,'reviewedBy',NEW.reviewed_by,
        'approvedBy',NEW.approved_by,'approvedAt',NEW.approved_at,
        'approvalEvidenceSha256',NEW.approval_evidence_sha256,
        'issuedAt',issue_time
      ),
      'contract',contract_evidence,
      'lines',line_evidence,
      'discountApplications',discount_evidence,
      'taxTreatment',jsonb_build_object('status','NOT_CONFIGURED_IN_FINANCE_SCHEMA'),
      'evidenceRefs',jsonb_build_object(
        'contractSignedSha256',signed_hash,
        'contractApprovedSha256',approved_hash,
        'lineSources',COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'domain',source_domain,'entityType',source_entity_type,
          'entityId',source_entity_id,'evidenceSha256',source_evidence_sha256
        )) FROM public.billing_invoice_items WHERE invoice_id=NEW.invoice_id
          AND source_entity_id IS NOT NULL),'[]'::jsonb)
      )
    );
    NEW.source_snapshot := snapshot_value;
    NEW.source_snapshot_sha256 := encode(sha256(convert_to(snapshot_value::text,'UTF8')),'hex');
    NEW.issued_at := issue_time;
  ELSIF OLD.status<>'ISSUED' AND
       (NEW.source_snapshot IS NOT NULL OR NEW.source_snapshot_sha256 IS NOT NULL OR NEW.issued_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FINANCE_INVOICE_SNAPSHOT_ONLY_CREATED_ON_ISSUE';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER finance_invoice_snapshot_before_issue
  BEFORE INSERT OR UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.finance_snapshot_invoice_on_issue();

COMMIT;
