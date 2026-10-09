#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || exit 72
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
# Read-only REPEATABLE READ snapshot of isolated attachment metadata.
# This validates transaction settings, not a live backup or shared filesystem snapshot.
result=$(psql -X -At -v ON_ERROR_STOP=1 <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_setting('transaction_isolation')||'|'||current_setting('transaction_read_only');
SELECT count(*) FROM finance_document_attachments;
SELECT count(*) FROM finance_document_attachments;
COMMIT;
SQL
)
printf '%s\n' "$result" | grep -Fxq 'repeatable read|on'
test "$(printf '%s\n' "$result" | grep -E '^[0-9]+$' | wc -l | tr -d ' ')" = 2
echo FINANCE_V3815_EPHEMERAL_REPEATABLE_READ_ONLY_SNAPSHOT_PASS
