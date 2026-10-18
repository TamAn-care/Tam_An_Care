#!/usr/bin/env bash
set -euo pipefail

# CI-only disposable PostgreSQL 16 service; no Production Test access.
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "CI_ONLY_MIGRATION_TEST"
  exit 2
fi
export PGHOST=127.0.0.1
export PGPORT=5432
export PGUSER=finance_ci
export PGPASSWORD=finance_ci_only
export PGDATABASE=postgres

database="finance_migration_schema_ci_${GITHUB_RUN_ID:-local}_${BASHPID:-$$}"
restore_database="${database}_restore"
empty_database="${database}_empty"
if [[ ! "$database" =~ ^[a-zA-Z0-9_]+$ || ! "$restore_database" =~ ^[a-zA-Z0-9_]+$ || ! "$empty_database" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "INVALID_DISPOSABLE_DATABASE_NAME"
  exit 2
fi

psql -X -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$database\""
created=1
cleanup() {
  if [[ "${created:-0}" == 1 ]]; then
    PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$database\" WITH (FORCE)" >/dev/null
  fi
  if [[ "${restore_created:-0}" == 1 ]]; then
    PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$restore_database\" WITH (FORCE)" >/dev/null
  fi
  if [[ "${empty_created:-0}" == 1 ]]; then
    PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$empty_database\" WITH (FORCE)" >/dev/null
  fi
}
trap cleanup EXIT

export PGDATABASE="$database"

# Disposable schema-compatibility fixture based on read-only Production Test
# metadata. One synthetic legacy ledger row proves widening preserves the
# stored decimal while the NOT VALID guard rejects new fractional-VND writes.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.residents (resident_id text PRIMARY KEY);
CREATE TABLE public.admission_cases (admission_case_id text PRIMARY KEY, resident_id text NOT NULL);
CREATE TABLE public.finance_entries (
  finance_entry_id text PRIMARY KEY,
  entry_type text NOT NULL,
  category text,
  description text,
  amount_vnd numeric(18,2) NOT NULL,
  recognition_date date NOT NULL,
  cash_date date,
  resident_id text,
  source_mode text,
  source_domain text,
  source_entity_type text,
  source_entity_id text,
  status text NOT NULL,
  reference_number text,
  note text,
  created_by text,
  created_by_role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uq_finance_entries_system_source
  ON public.finance_entries(source_domain,source_entity_type,source_entity_id,entry_type)
  WHERE source_mode='SYSTEM' AND source_domain IS NOT NULL
    AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL;
INSERT INTO public.finance_entries(
  finance_entry_id,entry_type,amount_vnd,recognition_date,status,source_mode
) VALUES ('ci_legacy_amount','OPERATING_EXPENSE',123.45,DATE '2026-10-01','POSTED','MANUAL');
SQL

migrations=(
  ops/finance/v22/001_finance_foundation.sql
  ops/finance/v28/002_finance_transaction_safety.sql
  ops/finance/v29/003_finance_allocation_invariants.sql
  ops/finance/v29/004_finance_integrity_hardening.sql
  ops/finance/v30/005_shared_contract_version_history.sql
  ops/finance/v30/006_shared_contract_signoff_evidence.sql
)

for migration in "${migrations[@]}"; do
  echo "APPLY_SCHEMA_ONLY=$migration"
  psql -X -v ON_ERROR_STOP=1 -f "$migration"
done

# Exercise a real restore-based rollback candidate before applying v31. The
# archive contains only the synthetic compatibility fixture in this disposable
# CI database. Compare schema and row dumps after restore byte-for-byte.
backup_file="${RUNNER_TEMP:-/tmp}/${database}.dump"
schema_before="${RUNNER_TEMP:-/tmp}/${database}.schema.before.sql"
schema_restored="${RUNNER_TEMP:-/tmp}/${database}.schema.restored.sql"
data_before="${RUNNER_TEMP:-/tmp}/${database}.data.before.sql"
data_restored="${RUNNER_TEMP:-/tmp}/${database}.data.restored.sql"
schema_before_normalized="${RUNNER_TEMP:-/tmp}/${database}.schema.before.normalized.sql"
schema_restored_normalized="${RUNNER_TEMP:-/tmp}/${database}.schema.restored.normalized.sql"
data_before_normalized="${RUNNER_TEMP:-/tmp}/${database}.data.before.normalized.sql"
data_restored_normalized="${RUNNER_TEMP:-/tmp}/${database}.data.restored.normalized.sql"
pg_dump -Fc --no-owner --no-privileges --dbname="$database" --file="$backup_file"
pg_dump --schema-only --no-owner --no-privileges --dbname="$database" > "$schema_before"
pg_dump --data-only --column-inserts --no-owner --no-privileges --dbname="$database" > "$data_before"
PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$restore_database\""
restore_created=1
pg_restore --no-owner --no-privileges --dbname="$restore_database" "$backup_file"
pg_dump --schema-only --no-owner --no-privileges --dbname="$restore_database" > "$schema_restored"
pg_dump --data-only --column-inserts --no-owner --no-privileges --dbname="$restore_database" > "$data_restored"
sed -E '/^\\(un)?restrict /d' "$schema_before" > "$schema_before_normalized"
sed -E '/^\\(un)?restrict /d' "$schema_restored" > "$schema_restored_normalized"
sed -E '/^\\(un)?restrict /d' "$data_before" > "$data_before_normalized"
sed -E '/^\\(un)?restrict /d' "$data_restored" > "$data_restored_normalized"
cmp "$schema_before_normalized" "$schema_restored_normalized"
cmp "$data_before_normalized" "$data_restored_normalized"
echo "FINANCE_V317_RESTORE_BASELINE_EXACT=PASS"

psql -X -v ON_ERROR_STOP=1 -f ops/finance/v31/007_finance_invoice_ledger_origin.sql
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v32/008_discount_and_absence_policy.sql
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v32/009_service_price_catalog.sql
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v32/010_immutable_invoice_snapshot.sql

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
DECLARE
  expected_tables text[] := ARRAY[
    'service_contract_records',
    'billing_invoices',
    'billing_invoice_items',
    'billing_receipts',
    'billing_payment_allocations',
    'finance_source_links',
    'finance_operation_idempotency',
    'finance_operation_audit',
    'service_contract_versions',
    'service_contract_signing_evidence',
    'service_contract_approval_decisions',
    'finance_entries'
    ,'finance_discount_policies'
    ,'finance_discount_assignments'
    ,'billing_discount_applications'
    ,'finance_absence_deduction_evidence'
    ,'finance_discount_policy_audit'
  ];
  expected_triggers text[] := ARRAY[
    'finance_allocation_guard',
    'finance_allocation_immutability',
    'finance_receipt_protection',
    'finance_invoice_protection',
    'finance_linked_receipt_status_guard',
    'finance_linked_invoice_status_guard',
    'service_contract_revision_immutability',
    'immutable_contract_signature_evidence',
    'immutable_contract_approval_decision',
    'finance_invoice_issue_guard',
    'finance_invoice_state_transition_guard',
    'finance_invoice_items_immutable_after_approval'
    ,'finance_invoice_snapshot_before_issue'
    ,'finance_discount_policy_guard'
    ,'finance_discount_assignment_guard'
    ,'finance_discount_application_guard'
    ,'finance_discount_policy_audit_on_change'
    ,'finance_discount_audit_immutable'
    ,'finance_absence_evidence_guard'
  ];
  name text;
BEGIN
  FOREACH name IN ARRAY expected_tables LOOP
    IF to_regclass(format('public.%I', name)) IS NULL THEN
      RAISE EXCEPTION 'MIGRATION_TABLE_MISSING: %', name;
    END IF;
  END LOOP;

  FOREACH name IN ARRAY expected_triggers LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgname = name AND NOT tgisinternal
    ) THEN
      RAISE EXCEPTION 'MIGRATION_TRIGGER_MISSING: %', name;
    END IF;
  END LOOP;

  IF to_regclass('public.finance_operation_audit_key_idx') IS NULL
     OR to_regclass('public.uq_contract_single_active_version') IS NULL
     OR to_regclass('public.uq_billing_invoice_item_financial_origin') IS NULL
     OR to_regclass('public.uq_finance_entries_financial_origin') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_INDEX_MISSING';
  END IF;

  IF to_regclass('public.finance_discount_assignment_lookup') IS NULL
     OR to_regclass('public.billing_discount_application_invoice') IS NULL THEN
    RAISE EXCEPTION 'DISCOUNT_INDEX_MISSING';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='billing_invoices'
      AND column_name='source_snapshot' AND data_type='jsonb')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
       WHERE conrelid='public.billing_invoices'::regclass
         AND conname='billing_invoice_snapshot_tuple_ck') THEN
    RAISE EXCEPTION 'INVOICE_SNAPSHOT_SCHEMA_MISSING';
  END IF;

  IF (SELECT format_type(a.atttypid,a.atttypmod)
        FROM pg_attribute a
       WHERE a.attrelid='public.finance_entries'::regclass
         AND a.attname='amount_vnd' AND NOT a.attisdropped) <> 'numeric'
     OR (SELECT amount_vnd FROM public.finance_entries
          WHERE finance_entry_id='ci_legacy_amount') <> 123.45 THEN
    RAISE EXCEPTION 'LEDGER_AMOUNT_TYPE_OR_HISTORICAL_VALUE_CHANGED';
  END IF;
  IF (SELECT convalidated FROM pg_constraint
       WHERE conrelid='public.finance_entries'::regclass
         AND conname='finance_entries_whole_vnd_ck') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LEGACY_LEDGER_CHECK_MUST_REMAIN_NOT_VALID';
  END IF;

  IF (SELECT count(*) FROM public.service_contract_records)
     + (SELECT count(*) FROM public.billing_invoices)
     + (SELECT count(*) FROM public.billing_invoice_items)
     + (SELECT count(*) FROM public.billing_receipts)
     + (SELECT count(*) FROM public.billing_payment_allocations)
     + (SELECT count(*) FROM public.finance_source_links)
     + (SELECT count(*) FROM public.finance_operation_idempotency)
     + (SELECT count(*) FROM public.finance_operation_audit)
     + (SELECT count(*) FROM public.service_contract_versions)
     + (SELECT count(*) FROM public.service_contract_signing_evidence)
     + (SELECT count(*) FROM public.service_contract_approval_decisions) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_CREATED_BUSINESS_ROWS';
  END IF;

  IF (SELECT count(*) FROM public.finance_discount_policies)
     + (SELECT count(*) FROM public.finance_discount_assignments)
     + (SELECT count(*) FROM public.billing_discount_applications)
     + (SELECT count(*) FROM public.finance_absence_deduction_evidence)
     + (SELECT count(*) FROM public.finance_discount_policy_audit) <> 0 THEN
    RAISE EXCEPTION 'DISCOUNT_MIGRATION_CREATED_BUSINESS_ROWS';
  END IF;
END
$verify$;
SQL

psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO public.residents(resident_id) VALUES ('ci_resident');
INSERT INTO public.service_contract_records(
  contract_id,contract_code,resident_id,status,effective_date,payload
) VALUES ('ci_contract','CI-CONTRACT','ci_resident','ACTIVE',DATE '2026-10-01','{}');
INSERT INTO public.service_contract_versions(
  contract_id,version,payload,status,effective_date,signed_at,approved_at,approved_by
) VALUES ('ci_contract',1,'{}','ACTIVE',DATE '2026-10-01',
          TIMESTAMPTZ '2026-09-20 10:00:00+07',TIMESTAMPTZ '2026-09-21 10:00:00+07','ci_contract_approver');
INSERT INTO public.service_contract_signing_evidence(
  contract_id,version,document_sha256,document_reference,signing_method,
  verified_by,signed_at
) VALUES ('ci_contract',1,repeat('a',64),'CI-CONTRACT-SIGNED-1',
          'SIGNED_PAPER_ARCHIVED','ci_signer',TIMESTAMPTZ '2026-09-20 10:00:00+07');
INSERT INTO public.service_contract_approval_decisions(
  contract_id,version,approved_by,approved_at,approval_reason,approved_sha256,
  admission_care_level,room_id,bed_id,monthly_fee_vnd
) VALUES ('ci_contract',1,'ci_contract_approver',TIMESTAMPTZ '2026-09-21 10:00:00+07',
          'CI isolated contract approval',repeat('a',64),'STANDARD','ci_room','ci_bed',1000);
INSERT INTO public.billing_invoices(
  invoice_id,invoice_code,resident_id,contract_id,contract_version,billing_month,
  status,total_amount_vnd,prepared_by,reviewed_by,approved_by,approved_at,
  approval_evidence_sha256
) VALUES ('ci_invoice','CI-INV-1','ci_resident','ci_contract',1,
          DATE '2026-10-01','DRAFT',1000,'ci_maker','ci_reviewer','ci_invoice_approver',
          TIMESTAMPTZ '2026-09-22 10:00:00+07',repeat('a',64));
INSERT INTO public.billing_invoice_items(
  item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,
  line_kind,service_period_start,service_period_end,financial_origin_key,discount_scope
) VALUES ('ci_line','ci_invoice','CI base monthly fee',1,1000,1000,
          'CONTRACT_FEE',DATE '2026-10-01',DATE '2026-11-01',
          'contract-fee:ci-contract:202610','ROOM');
INSERT INTO public.finance_discount_policies(
  discount_id,code,name,discount_type,discount_value,eligible_fee_scope,application_mode,
  effective_from,effective_to,approval_state,created_by,approved_by,approved_at,approval_reason,
  decision_by,decision_at,decision_reason
) VALUES ('ci_discount','CI-10P','CI approved room discount','PERCENT',10,'ROOM','PERCENT',
  DATE '2026-10-01',NULL,'APPROVED','ci_proposer','ci_approver',now(),'CI approved isolated fixture',
  'ci_approver',now(),'Approved in isolated fixture');
INSERT INTO public.finance_discount_assignments(
  assignment_id,discount_id,resident_id,contract_id,effective_from,assigned_by,source_reference
) VALUES ('ci_assignment','ci_discount','ci_resident','ci_contract',DATE '2026-10-01','ci_assigner','ci-approval-record-1');
UPDATE public.billing_invoices SET total_amount_vnd=900 WHERE invoice_id='ci_invoice';
INSERT INTO public.billing_invoice_items(
  item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,line_kind,
  service_period_start,service_period_end,source_domain,source_entity_type,source_entity_id,
  source_evidence_sha256,financial_origin_key
) VALUES ('ci_discount_line','ci_invoice','CI room discount',1,-100,-100,'DISCOUNT',
  DATE '2026-10-01',DATE '2026-11-01','DISCOUNT','POLICY','ci_discount',repeat('b',64),
  'discount-line:ci-discount:202610');
INSERT INTO public.billing_discount_applications(
  application_id,discount_id,assignment_id,invoice_id,eligible_invoice_item_id,invoice_item_id,source_key,
  effective_from,effective_to,eligible_base_vnd,amount_vnd,created_by
) VALUES ('ci_application','ci_discount','ci_assignment','ci_invoice','ci_line','ci_discount_line','ci-invoice-discount-1',
  DATE '2026-10-01',DATE '2026-10-31',1000,100,'ci_billing_actor');
DO $discount_constraint_tests$
BEGIN
  BEGIN
    INSERT INTO public.finance_discount_policies(
      discount_id,code,name,discount_type,discount_value,eligible_fee_scope,application_mode,
      effective_from,approval_state,created_by
    ) VALUES ('ci_bad_percent','CI-BAD-P','Bad percent','PERCENT',101,'ROOM','PERCENT',
      DATE '2026-10-01','PROPOSED','ci_actor');
    RAISE EXCEPTION 'EXPECTED_PERCENT_RANGE_REJECTION';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.finance_discount_policies(
      discount_id,code,name,discount_type,discount_value,eligible_fee_scope,application_mode,
      effective_from,approval_state,created_by
    ) VALUES ('ci_proposed','CI-PROP','CI proposed policy','FIXED_AMOUNT',1000,'CARE','MONTHLY_PRORATED',
      DATE '2026-10-01','PROPOSED','ci_actor');
    UPDATE public.finance_discount_policies SET approval_state='REVOKED' WHERE discount_id='ci_proposed';
    RAISE EXCEPTION 'EXPECTED_DISCOUNT_TRANSITION_REJECTION';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_DISCOUNT_STATE_TRANSITION_FORBIDDEN' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.finance_discount_policies SET discount_value=11 WHERE discount_id='ci_discount';
    RAISE EXCEPTION 'EXPECTED_APPROVED_POLICY_IMMUTABILITY';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_APPROVED_DISCOUNT_TERMS_IMMUTABLE' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.finance_discount_policy_audit WHERE discount_id='ci_discount';
    RAISE EXCEPTION 'EXPECTED_AUDIT_IMMUTABILITY';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_DISCOUNT_AUDIT_IMMUTABLE' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.billing_discount_applications(
      application_id,discount_id,assignment_id,invoice_id,eligible_invoice_item_id,invoice_item_id,source_key,
      effective_from,effective_to,eligible_base_vnd,amount_vnd,created_by
    ) VALUES ('ci_duplicate_application','ci_discount','ci_assignment','ci_invoice','ci_line','ci_discount_line','ci-invoice-discount-2',
      DATE '2026-10-10',DATE '2026-10-20',1000,100,'ci_billing_actor');
    RAISE EXCEPTION 'EXPECTED_DISCOUNT_NONSTACKING';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_DISCOUNT_STACKING_FORBIDDEN' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.finance_absence_deduction_evidence(
      evidence_id,source_domain,source_id,resident_id,absence_from,absence_to,notified_at,
      approved_by,approved_at,approval_reason,created_by
    ) VALUES ('ci_bad_absence','RESIDENT_LEAVE','leave-ci-bad','ci_resident',DATE '2026-10-10',
      DATE '2026-10-11',TIMESTAMPTZ '2026-10-08 00:00:00+07','ci_approver',now(),
      'Missing family confirmation','ci_creator');
    RAISE EXCEPTION 'EXPECTED_UNCONFIRMED_ABSENCE_REJECTION';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.finance_absence_deduction_evidence(
    evidence_id,source_domain,source_id,resident_id,absence_from,absence_to,notified_at,
    family_confirmed_at,family_confirmation_reference,required_update_dates,
    approved_by,approved_at,approval_reason,created_by
  ) VALUES ('ci_absence','RESIDENT_LEAVE','leave-ci-1','ci_resident',DATE '2026-10-10',
    DATE '2026-10-12',TIMESTAMPTZ '2026-10-08 00:00:00+07',now(),'family-confirmation-ci',
    ARRAY[DATE '2026-10-11'],'ci_absence_approver',now(),'CI evidence approved','ci_creator');
  BEGIN
    UPDATE public.finance_absence_deduction_evidence SET approval_reason='mutated'
      WHERE evidence_id='ci_absence';
    RAISE EXCEPTION 'EXPECTED_ABSENCE_EVIDENCE_IMMUTABILITY';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_ABSENCE_EVIDENCE_IMMUTABLE' THEN RAISE; END IF;
  END;
END
$discount_constraint_tests$;
UPDATE public.billing_invoices SET status='APPROVED' WHERE invoice_id='ci_invoice';
COMMIT;

UPDATE public.billing_invoices SET status='ISSUED' WHERE invoice_id='ci_invoice';
DO $snapshot_tests$
DECLARE before_hash char(64); before_snapshot jsonb; before_issued_at timestamptz;
BEGIN
  SELECT source_snapshot_sha256,source_snapshot,issued_at
    INTO before_hash,before_snapshot,before_issued_at
    FROM public.billing_invoices WHERE invoice_id='ci_invoice';
  IF length(trim(before_hash))<>64 OR before_issued_at IS NULL
     OR before_snapshot->>'schemaVersion'<>'FINANCE_INVOICE_SNAPSHOT_V1'
     OR before_snapshot#>>'{invoice,totalAmountVnd}'<>'900'
     OR jsonb_array_length(before_snapshot->'lines')<>2
     OR jsonb_array_length(before_snapshot->'discountApplications')<>1
     OR before_snapshot#>>'{contract,contractVersion}'<>'1' THEN
    RAISE EXCEPTION 'INVOICE_SNAPSHOT_CONTENT_INVALID';
  END IF;
  UPDATE public.billing_invoices SET status='ISSUED' WHERE invoice_id='ci_invoice';
  IF NOT EXISTS (SELECT 1 FROM public.billing_invoices
    WHERE invoice_id='ci_invoice' AND source_snapshot_sha256=before_hash
      AND source_snapshot=before_snapshot AND issued_at=before_issued_at) THEN
    RAISE EXCEPTION 'INVOICE_SNAPSHOT_REPLAY_CHANGED_EVIDENCE';
  END IF;
  BEGIN
    UPDATE public.billing_invoices
       SET source_snapshot=jsonb_set(source_snapshot,'{invoice,totalAmountVnd}','"1"'::jsonb)
     WHERE invoice_id='ci_invoice';
    RAISE EXCEPTION 'EXPECTED_INVOICE_SNAPSHOT_IMMUTABILITY';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'FINANCE_INVOICE_SOURCE_SNAPSHOT_IMMUTABLE' THEN RAISE; END IF;
  END;
END
$snapshot_tests$;
SELECT 'FINANCE_INVOICE_SNAPSHOT_ISSUE_REPLAY_IMMUTABILITY_PASS';

BEGIN;
INSERT INTO public.finance_entries(
  finance_entry_id,entry_type,amount_vnd,recognition_date,status,source_mode,
  source_domain,source_entity_type,source_entity_id,financial_origin_key
) VALUES ('ci_origin_ledger_1','REVENUE',1000,DATE '2026-10-01','POSTED','SYSTEM',
  'BILLING','INVOICE_LINE','ci_line','ledger-origin-ci-0001');

DO $constraint_tests$
BEGIN
  BEGIN
    INSERT INTO public.finance_entries(
      finance_entry_id,entry_type,amount_vnd,recognition_date,status
    ) VALUES ('ci_fractional_ledger','DIRECT_COST',100.005,DATE '2026-10-01','DRAFT');
    RAISE EXCEPTION 'EXPECTED_FRACTIONAL_LEDGER_REJECTION';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.finance_entries(
      finance_entry_id,entry_type,amount_vnd,recognition_date,status,source_mode,
      source_domain,source_entity_type,source_entity_id,financial_origin_key
    ) VALUES ('ci_duplicate_origin','REVENUE',1000,DATE '2026-10-01','POSTED','MANUAL',
      'BILLING','INVOICE_LINE','ci_line','ledger-origin-ci-0001');
    RAISE EXCEPTION 'EXPECTED_DUPLICATE_ORIGIN_REJECTION';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.billing_invoices(
      invoice_id,invoice_code,resident_id,contract_id,contract_version,billing_month,
      status,total_amount_vnd
    ) VALUES ('ci_bad_fraction_invoice','CI-INV-FRACTION','ci_resident','ci_contract',1,
      DATE '2026-10-01','DRAFT',10);
    INSERT INTO public.billing_invoice_items(
      item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,
      line_kind,service_period_start,service_period_end,financial_origin_key
    ) VALUES ('ci_bad_fraction_line','ci_bad_fraction_invoice','CI fraction probe',1,
      10.005,10.005,'CONTRACT_FEE',DATE '2026-10-01',DATE '2026-11-01',
      'ci-fraction-origin-0001');
    RAISE EXCEPTION 'EXPECTED_FRACTIONAL_INVOICE_REJECTION';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.billing_invoice_items SET line_total_vnd=999
     WHERE item_id='ci_line';
    RAISE EXCEPTION 'EXPECTED_APPROVED_LINE_IMMUTABILITY';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_ISSUED_INVOICE_LINES_IMMUTABLE' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.billing_invoices SET status='DRAFT' WHERE invoice_id='ci_invoice';
    RAISE EXCEPTION 'EXPECTED_INVALID_INVOICE_STATE_TRANSITION';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_INVOICE_STATUS_TRANSITION_FORBIDDEN' THEN RAISE; END IF;
  END;
END
$constraint_tests$;

-- A final invoice whose total does not equal its lines must be rejected at
-- deferred constraint-check time, not accepted based on an intermediate state.
DO $total_test$
BEGIN
  BEGIN
    INSERT INTO public.billing_invoices(
      invoice_id,invoice_code,resident_id,contract_id,contract_version,billing_month,
      status,total_amount_vnd,prepared_by,reviewed_by,approved_by,approved_at,
      approval_evidence_sha256
    ) VALUES ('ci_bad_total_invoice','CI-INV-TOTAL','ci_resident','ci_contract',1,
      DATE '2026-10-01','DRAFT',999,'ci_maker2','ci_reviewer2','ci_approver2',
      TIMESTAMPTZ '2026-09-22 10:00:00+07',repeat('a',64));
    INSERT INTO public.billing_invoice_items(
      item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,
      line_kind,service_period_start,service_period_end,financial_origin_key
    ) VALUES ('ci_bad_total_line','ci_bad_total_invoice','CI base fee',1,1000,1000,
      'CONTRACT_FEE',DATE '2026-10-01',DATE '2026-11-01','ci-bad-total-origin-0001');
    UPDATE public.billing_invoices SET status='APPROVED'
      WHERE invoice_id='ci_bad_total_invoice';
    SET CONSTRAINTS finance_invoice_issue_guard IMMEDIATE;
    RAISE EXCEPTION 'EXPECTED_INVOICE_TOTAL_MISMATCH';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_INVOICE_TOTAL_DOES_NOT_MATCH_LINES' THEN RAISE; END IF;
  END;
END
$total_test$;
ROLLBACK;
SQL

psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO public.service_price_lists(price_list_id,code,name,created_by)
VALUES ('ci_price_list','CI-PRICE','CI price list','ci_creator');
INSERT INTO public.service_price_list_versions(price_list_id,version,status,effective_from,effective_to,items,created_by)
VALUES ('ci_price_list',1,'DRAFT',DATE '2026-10-01',NULL,
 '[{"serviceCode":"ROOM_STANDARD","name":"CI room","unit":"MONTH","scope":"ROOM","amountVnd":"123456"}]'::jsonb,'ci_creator');
UPDATE public.service_price_list_versions SET status='PENDING_APPROVAL',submitted_by='ci_submitter',submitted_at=now()
 WHERE price_list_id='ci_price_list' AND version=1;
UPDATE public.service_price_list_versions SET status='APPROVED',decided_by='ci_approver',decided_at=now(),decision_reason='Independent isolated approval'
 WHERE price_list_id='ci_price_list' AND version=1;
DO $pricing_constraint_tests$
BEGIN
  BEGIN
    UPDATE public.service_price_list_versions SET items='[{"serviceCode":"ROOM_STANDARD","name":"changed","unit":"MONTH","scope":"ROOM","amountVnd":"1"}]'::jsonb WHERE price_list_id='ci_price_list' AND version=1;
    RAISE EXCEPTION 'EXPECTED_APPROVED_PRICE_IMMUTABILITY';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_PRICE_VERSION_IMMUTABLE' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.service_price_list_versions(price_list_id,version,status,effective_from,effective_to,items,created_by)
    VALUES ('ci_price_list',2,'DRAFT',DATE '2026-10-15',NULL,
     '[{"serviceCode":"ROOM_STANDARD","name":"overlap","unit":"MONTH","scope":"ROOM","amountVnd":"1"}]'::jsonb,'ci_creator2');
    UPDATE public.service_price_list_versions SET status='PENDING_APPROVAL',submitted_by='ci_submitter2',submitted_at=now() WHERE price_list_id='ci_price_list' AND version=2;
    UPDATE public.service_price_list_versions SET status='APPROVED',decided_by='ci_approver2',decided_at=now(),decision_reason='Overlapping approval must fail' WHERE price_list_id='ci_price_list' AND version=2;
    RAISE EXCEPTION 'EXPECTED_PRICE_OVERLAP_REJECTION';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_PRICE_EFFECTIVE_PERIOD_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.service_price_list_versions(price_list_id,version,status,effective_from,items,created_by)
    VALUES ('ci_price_list',3,'DRAFT',DATE '2026-11-01',
      '[{"serviceCode":"ROOM_BAD","name":"bad","unit":"MONTH","scope":"ROOM","amountVnd":"-1"}]'::jsonb,'ci_creator3');
    RAISE EXCEPTION 'EXPECTED_NEGATIVE_PRICE_REJECTION';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_PRICE_ITEM_INVALID' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.service_price_list_versions(price_list_id,version,status,effective_from,items,created_by)
    VALUES ('ci_price_list',4,'DRAFT',DATE '2027-01-01',
      '[{"serviceCode":"CARE_STANDARD","name":"care","unit":"MONTH","scope":"CARE","amountVnd":"100"}]'::jsonb,'ci_self_approver');
    UPDATE public.service_price_list_versions SET status='PENDING_APPROVAL',submitted_by='ci_submitter4',submitted_at=now() WHERE price_list_id='ci_price_list' AND version=4;
    UPDATE public.service_price_list_versions SET status='APPROVED',decided_by='ci_self_approver',decided_at=now(),decision_reason='Self approval must fail' WHERE price_list_id='ci_price_list' AND version=4;
    RAISE EXCEPTION 'EXPECTED_PRICE_SELF_APPROVAL_REJECTION';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FINANCE_PRICE_APPROVAL_SEPARATION_REQUIRED' THEN RAISE; END IF;
  END;
END
$pricing_constraint_tests$;
ROLLBACK;
SQL

# The same canonical sequence must install into an empty isolated schema.
PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$empty_database\""
empty_created=1
PGDATABASE="$empty_database" psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.residents (resident_id text PRIMARY KEY);
CREATE TABLE public.finance_entries (
  finance_entry_id text PRIMARY KEY, entry_type text NOT NULL, category text,
  description text, amount_vnd numeric(18,2) NOT NULL, recognition_date date NOT NULL,
  cash_date date, resident_id text, source_mode text, source_domain text,
  source_entity_type text, source_entity_id text, status text NOT NULL,
  reference_number text, note text, created_by text, created_by_role text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uq_finance_entries_system_source
  ON public.finance_entries(source_domain,source_entity_type,source_entity_id,entry_type)
  WHERE source_mode='SYSTEM' AND source_domain IS NOT NULL
    AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL;
SQL
empty_migrations=(
  ops/finance/v22/001_finance_foundation.sql
  ops/finance/v28/002_finance_transaction_safety.sql
  ops/finance/v29/003_finance_allocation_invariants.sql
  ops/finance/v29/004_finance_integrity_hardening.sql
  ops/finance/v30/005_shared_contract_version_history.sql
  ops/finance/v30/006_shared_contract_signoff_evidence.sql
  ops/finance/v31/007_finance_invoice_ledger_origin.sql
  ops/finance/v32/008_discount_and_absence_policy.sql
  ops/finance/v32/009_service_price_catalog.sql
  ops/finance/v32/010_immutable_invoice_snapshot.sql
)
for migration in "${empty_migrations[@]}"; do
  echo "APPLY_EMPTY_SCHEMA=$migration"
  PGDATABASE="$empty_database" psql -X -v ON_ERROR_STOP=1 -f "$migration"
done
PGDATABASE="$empty_database" psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $empty_check$
BEGIN
  IF to_regclass('public.finance_discount_policies') IS NULL
     OR to_regclass('public.billing_discount_applications') IS NULL
     OR to_regclass('public.finance_absence_deduction_evidence') IS NULL
     OR (SELECT count(*) FROM public.finance_discount_policies) <> 0
     OR (SELECT count(*) FROM public.billing_discount_applications) <> 0
     OR (SELECT count(*) FROM public.finance_absence_deduction_evidence) <> 0 THEN
    RAISE EXCEPTION 'FINANCE_EMPTY_SCHEMA_MIGRATION_INVALID';
  END IF;
  IF to_regclass('public.service_price_list_versions') IS NULL
     OR (SELECT count(*) FROM public.service_price_list_versions) <> 0 THEN
    RAISE EXCEPTION 'FINANCE_EMPTY_PRICE_CATALOG_MIGRATION_INVALID';
  END IF;
END
$empty_check$;
SQL
echo "FINANCE_V320_EMPTY_SCHEMA_MIGRATIONS=PASS"
echo "FINANCE_V320_SERVICE_PRICE_CONSTRAINTS=PASS"

echo "FINANCE_BILLING_MIGRATION_SCHEMA_ONLY_PASS"
echo "FINANCE_BILLING_MIGRATION_CREATED_BUSINESS_ROWS=0"
echo "FINANCE_V317_INVOICE_LEDGER_CONSTRAINTS=PASS"
echo "FINANCE_V317_SYNTHETIC_ROWS=DISPOSABLE_CI_ONLY"
echo "FINANCE_V317_RESTORE_BASELINE_EXACT=PASS"
echo "FINANCE_V320_DISCOUNT_ABSENCE_CONSTRAINTS=PASS"
echo "FINANCE_V317_ROLLBACK_CANDIDATE=RESTORE_PREMIGRATION_BACKUP"
echo "FINANCE_BILLING_MIGRATION_DISPOSABLE_DATABASE=$database"
