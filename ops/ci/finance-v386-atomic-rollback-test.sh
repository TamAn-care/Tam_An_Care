#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
test "$PGHOST" = 127.0.0.1 && test "$PGDATABASE" = finance_ci
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v386/001_ci_atomic_failure_probe.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO finance_source_documents(
 document_id,source_domain,source_entity_type,source_entity_id,
 entry_type,recognition_date,amount_vnd,external_evidence_sha256,
 reference_number,prepared_by
) VALUES ('CI_ROLLBACK','SERVICE','INVOICE','CI_ROLLBACK_REF','REVENUE',
 '2026-09-15',1000000,repeat('a',64),'CI-ROLLBACK','CI_MAKER');
SELECT finance_v382_transition('CI_ROLLBACK',0,'SUBMIT','CI_MAKER','Submitted for controlled failure');
SQL
before_revision=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT revision FROM finance_source_documents WHERE document_id='CI_ROLLBACK'")
before_events=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM finance_source_document_events WHERE document_id='CI_ROLLBACK'")
if psql -X -v ON_ERROR_STOP=1 -c "SELECT finance_v386_atomic_failure_probe('CI_ROLLBACK',1)" >/dev/null 2>&1; then
 echo FINANCE_V386_FAILURE_INJECTION_NOT_TRIGGERED; exit 1
fi
after_revision=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT revision FROM finance_source_documents WHERE document_id='CI_ROLLBACK'")
after_events=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM finance_source_document_events WHERE document_id='CI_ROLLBACK'")
test "$before_revision" = 1 && test "$after_revision" = "$before_revision"
test "$before_events" = 1 && test "$after_events" = "$before_events"
test "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT state FROM finance_source_documents WHERE document_id='CI_ROLLBACK'")" = SUBMITTED
echo FINANCE_V386_ATOMIC_ROLLBACK_AUDIT_COHESION_PASS
