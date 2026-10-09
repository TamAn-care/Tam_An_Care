#!/usr/bin/env bash
set -euo pipefail
# Must run ONLY with the ephemeral GitHub Actions finance_ci database.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci
export PGPASSWORD=finance_ci_only
if [[ "${PGDATABASE:-}" != finance_ci || "${PGUSER:-}" != finance_ci ||
      "${PGHOST:-}" != 127.0.0.1 ]]; then
  echo FINANCE_V382_ISOLATION_GATE_FAIL; exit 31
fi
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v382/001_finance_source_documents_design.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO finance_source_documents (
 document_id,source_domain,source_entity_type,source_entity_id,
 entry_type,recognition_date,amount_vnd,external_evidence_sha256,
 reference_number,prepared_by
) VALUES ('CI_DOC','SERVICE','INVOICE','CI_REFERENCE','REVENUE',
 '2026-09-15',1000000,repeat('a',64),'CI-REF','MAKER');
UPDATE finance_source_documents SET state='SUBMITTED',revision=revision+1
 WHERE document_id='CI_DOC' AND state='DRAFT' AND revision=0;
INSERT INTO finance_source_document_events
 (document_id,revision,from_state,to_state,action,actor_id,reason)
 VALUES('CI_DOC',1,'DRAFT','SUBMITTED','SUBMIT','MAKER','CI workflow approval evidence');
DO $$
DECLARE touched integer;
BEGIN
 UPDATE finance_source_documents SET state='REVIEWED',revision=revision+1,
 reviewed_by='CHECKER'
 WHERE document_id='CI_DOC' AND state='SUBMITTED' AND revision=0;
 GET DIAGNOSTICS touched = ROW_COUNT;
 IF touched <> 0 THEN RAISE EXCEPTION 'STALE_REVISION_ACCEPTED'; END IF;
END $$;
SQL
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO finance_source_documents(document_id,source_domain,source_entity_type,source_entity_id,entry_type,recognition_date,amount_vnd,external_evidence_sha256,reference_number,prepared_by) VALUES ('CI_DUP','SERVICE','INVOICE','CI_REFERENCE','REVENUE','2026-09-15',1,repeat('a',64),'CI-REF','MAKER')" >/dev/null 2>&1; then
 echo FINANCE_V382_DUPLICATE_SOURCE_FAIL; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM finance_source_document_events WHERE document_id='CI_DOC'" >/dev/null 2>&1; then
 echo FINANCE_V382_AUDIT_IMMUTABILITY_FAIL; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "UPDATE finance_source_document_events SET reason='MUTATED' WHERE document_id='CI_DOC'" >/dev/null 2>&1; then
 echo FINANCE_V382_AUDIT_UPDATE_FAIL; exit 1
fi
test "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM finance_source_document_events WHERE document_id='CI_DOC'")" = 1
# Dedicated row-locked transition test; source is an isolated CI record only.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO finance_source_documents(
 document_id,source_domain,source_entity_type,source_entity_id,
 entry_type,recognition_date,amount_vnd,external_evidence_sha256,
 reference_number,prepared_by
) VALUES ('CI_FLOW','SERVICE','INVOICE','CI_FLOW_REF','REVENUE',
 '2026-09-15',1000000,repeat('a',64),'CI-FLOW','MAKER');
SELECT finance_v382_transition('CI_FLOW',0,'SUBMIT','MAKER','Submitted by maker');
SELECT finance_v382_transition('CI_FLOW',1,'REVIEW','CHECKER','Reviewed separately');
SELECT finance_v382_transition('CI_FLOW',2,'APPROVE','DIRECTOR','Approved independently',repeat('b',64));
DO $
BEGIN
 IF (SELECT state FROM finance_source_documents WHERE document_id='CI_FLOW')<>'APPROVED'
   OR (SELECT count(*) FROM finance_source_document_events WHERE document_id='CI_FLOW')<>3
 THEN RAISE EXCEPTION 'FINANCE_V382_ATOMIC_TRANSITION_INTEGRITY_FAIL'; END IF;
END $;
SQL
if psql -X -v ON_ERROR_STOP=1 -c "SELECT finance_v382_transition('CI_FLOW',1,'REVIEW','ANOTHER','Stale revision')" >/dev/null 2>&1; then
 echo FINANCE_V382_STALE_TRANSITION_FAIL; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "SELECT finance_v382_transition('CI_DOC',1,'REVIEW','MAKER','Self review')" >/dev/null 2>&1; then
 echo FINANCE_V382_SELF_REVIEW_FAIL; exit 1
fi
echo FINANCE_V382_EPHEMERAL_POSTGRES_GATE_PASS
