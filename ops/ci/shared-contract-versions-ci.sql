\set ON_ERROR_STOP on
INSERT INTO public.service_contract_records(contract_id,contract_code,resident_id,status,payload) VALUES ('CI_CONTRACT','CI_C','CI_RESIDENT','ACTIVE','{}');
INSERT INTO public.service_contract_versions(contract_id,version,payload,status,effective_date,signed_at,approved_at,approved_by)
VALUES('CI_CONTRACT',1,'{"fee":100}','ACTIVE','2026-10-01',now(),now(),'CI_APPROVER');
DO $$
BEGIN
 BEGIN
  UPDATE public.service_contract_versions SET payload='{"fee":200}' WHERE contract_id='CI_CONTRACT';
  RAISE EXCEPTION 'CI_UNEXPECTED_MUTABILITY';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%SIGNED_CONTRACT_TERMS_IMMUTABLE%' THEN RAISE;END IF;
 END;
 BEGIN
  UPDATE public.service_contract_versions SET status='DRAFT' WHERE contract_id='CI_CONTRACT';
  RAISE EXCEPTION 'CI_UNEXPECTED_REOPEN';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%CONTRACT_SIGNED_STATUS_TRANSITION_FORBIDDEN%' THEN RAISE;END IF;
 END;
 BEGIN
  DELETE FROM public.service_contract_versions WHERE contract_id='CI_CONTRACT';
  RAISE EXCEPTION 'CI_UNEXPECTED_DELETE';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%SIGNED_CONTRACT_VERSION_DELETE_FORBIDDEN%' THEN RAISE;END IF;
 END;
END;$$;
\echo CONTRACT_VERSION_HISTORY_IMMUTABLE_PASS

-- Only synthetic CI fixture: attestation references the one shared contract version.
INSERT INTO public.service_contract_signing_evidence
(contract_id,version,document_sha256,document_reference,signing_method,verified_by,signed_at)
VALUES ('CI_CONTRACT',1,repeat('a',64),'ci_document_store_key',
        'SIGNED_PAPER_ARCHIVED','CI_VERIFIER','2026-10-01T09:00:00Z');
INSERT INTO public.service_contract_approval_decisions
(contract_id,version,approved_by,approval_reason,approved_sha256,
 admission_care_level,room_id,bed_id,monthly_fee_vnd)
VALUES('CI_CONTRACT',1,'CI_DIRECTOR','CI_ONLY_VERIFIED_APPROVAL',repeat('a',64),
 'ASSISTED','CI_ROOM','CI_BED',100);
DO $$
BEGIN
 BEGIN
  UPDATE public.service_contract_signing_evidence
     SET verified_by='OTHER' WHERE contract_id='CI_CONTRACT';
  RAISE EXCEPTION 'CI_UNEXPECTED_EVIDENCE_MUTATION';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%CONTRACT_EVIDENCE_IMMUTABLE%' THEN RAISE; END IF;
 END;
 BEGIN
  DELETE FROM public.service_contract_approval_decisions WHERE contract_id='CI_CONTRACT';
  RAISE EXCEPTION 'CI_UNEXPECTED_APPROVAL_DELETE';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%CONTRACT_EVIDENCE_IMMUTABLE%' THEN RAISE; END IF;
 END;
END;$$;
\echo CONTRACT_SIGNOFF_EVIDENCE_IMMUTABLE_PASS
