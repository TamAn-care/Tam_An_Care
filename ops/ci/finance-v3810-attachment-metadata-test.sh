#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
[[ "$PGHOST" = 127.0.0.1 && "$PGDATABASE" = finance_ci ]] || exit 68
psql -X -v ON_ERROR_STOP=1 -f ops/finance/v3810/001_attachment_metadata_ci_design.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO finance_document_attachments
(attachment_id,document_id,object_key,sha256,byte_length,content_type,created_by)
VALUES ('CI_ATTACHMENT','CI_388_DRAFT',
'finance/documents/CI_388_DRAFT/PROOF.pdf',repeat('a',64),1048,'application/pdf','CI_MAKER');
SQL
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO finance_document_attachments (attachment_id,document_id,object_key,sha256,byte_length,content_type,created_by) VALUES ('CI_BAD','CI_388_DRAFT','finance/documents/OTHER/PROOF.pdf',repeat('a',64),1048,'application/pdf','CI_MAKER')" >/dev/null 2>&1; then
 echo FINANCE_V3810_CROSS_DOCUMENT_ALLOWED;exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO finance_document_attachments (attachment_id,document_id,object_key,sha256,byte_length,content_type,created_by) VALUES ('CI_DUP','CI_388_DRAFT','finance/documents/CI_388_DRAFT/PROOF.pdf',repeat('b',64),1048,'application/pdf','CI_MAKER')" >/dev/null 2>&1; then
 echo FINANCE_V3810_DUPLICATE_KEY_ALLOWED;exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO finance_document_attachments (attachment_id,document_id,object_key,sha256,byte_length,content_type,created_by) VALUES ('CI_MISSING','DOES_NOT_EXIST','finance/documents/DOES_NOT_EXIST/FILE.pdf',repeat('a',64),1048,'application/pdf','CI_MAKER')" >/dev/null 2>&1; then
 echo FINANCE_V3810_ORPHAN_ATTACHMENT_ALLOWED;exit 1
fi
test "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM finance_document_attachments WHERE document_id='CI_388_DRAFT'")" = 1
echo FINANCE_V3810_ATTACHMENT_METADATA_SCOPE_CI_PASS
