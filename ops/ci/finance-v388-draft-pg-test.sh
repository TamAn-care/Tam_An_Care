#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGDATABASE" == finance_ci && "$PGHOST" == 127.0.0.1 ]] || exit 61
# CI-only records. This script runs AFTER the isolated V3.8.2 schema setup.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO finance_source_documents (
 document_id,source_domain,source_entity_type,source_entity_id,entry_type,
 recognition_date,amount_vnd,external_evidence_sha256,reference_number,prepared_by
) VALUES('CI_388_DRAFT','SERVICE','INVOICE','CI_388_SOURCE','REVENUE',
 '2026-09-15',1500000,repeat('a',64),'CI-388','CI_MAKER');
COMMIT;
SQL
test "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT state||':'||revision FROM finance_source_documents WHERE document_id='CI_388_DRAFT'")" = 'DRAFT:0'
# A duplicate source must not create a second document.
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO finance_source_documents(document_id,source_domain,source_entity_type,source_entity_id,entry_type,recognition_date,amount_vnd,external_evidence_sha256,reference_number,prepared_by) VALUES('CI_388_DUP','SERVICE','INVOICE','CI_388_SOURCE','REVENUE','2026-09-15',1,repeat('b',64),'CI-388','CI_MAKER')" >/dev/null 2>&1; then
 echo FINANCE_V388_DUPLICATE_SOURCE_NOT_BLOCKED; exit 1
fi
# Error inside a transaction must undo the inserted document.
if psql -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null 2>&1
BEGIN;
INSERT INTO finance_source_documents(
 document_id,source_domain,source_entity_type,source_entity_id,entry_type,
 recognition_date,amount_vnd,external_evidence_sha256,reference_number,prepared_by
) VALUES('CI_388_ROLLBACK','SERVICE','INVOICE','CI_388_ROLLBACK_SOURCE','REVENUE',
 '2026-09-15',100,repeat('a',64),'CI-388','CI_MAKER');
SELECT 1/0;
COMMIT;
SQL
then
 echo FINANCE_V388_FAILURE_NOT_TRIGGERED; exit 1
fi
test "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM finance_source_documents WHERE document_id='CI_388_ROLLBACK'")" = 0
echo FINANCE_V388_EPHEMERAL_DRAFT_INSERT_DUPLICATE_ROLLBACK_PASS
