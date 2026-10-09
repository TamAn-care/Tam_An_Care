#!/usr/bin/env bash
set -euo pipefail
# V3.8.12: CI-only restore reconciliation, NEVER deletes business objects.
[[ "${GITHUB_ACTIONS:-}" = true ]] || { echo CI_ONLY_REQUIRED; exit 71; }
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci PGPASSWORD=finance_ci_only
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/objects/finance/documents/CI_388_DRAFT" "$root/objects/finance/documents/CI_ORPHAN" "$root/restored"
printf 'isolated-v3812-metadata-reference\n' > "$root/objects/finance/documents/CI_388_DRAFT/PROOF.pdf"
printf 'isolated-orphan\n' > "$root/objects/finance/documents/CI_ORPHAN/ORPHAN.pdf"
key='finance/documents/CI_388_DRAFT/PROOF.pdf'
digest=$(sha256sum "$root/objects/$key" | cut -d' ' -f1)
size=$(wc -c < "$root/objects/$key" | tr -d ' ')
psql -X -v ON_ERROR_STOP=1 -v checksum="$digest" -v bytes="$size" <<'SQL'
UPDATE finance_document_attachments
SET sha256=:'checksum',byte_length=:'bytes',
    storage_state='VERIFIED',verified_at=now()
WHERE attachment_id='CI_ATTACHMENT';
SQL
# Restore object directory into another folder, with consistent DB metadata snapshot.
tar -C "$root/objects" -czf "$root/backup.tar.gz" finance
tar -C "$root/restored" -xzf "$root/backup.tar.gz"
# Iterate ONLY authoritative DB keys; find missing/corrupt. Identify extras but don't delete.
psql -X -At -F '|' -v ON_ERROR_STOP=1 -c "
 SELECT object_key,trim(sha256),byte_length
 FROM finance_document_attachments
 WHERE attachment_id='CI_ATTACHMENT'" > "$root/db-manifest"
while IFS='|' read -r path hash bytes; do
  [[ -f "$root/restored/$path" ]] || { echo V3812_RESTORE_MISSING; exit 1; }
  [[ "$(sha256sum "$root/restored/$path" | cut -d' ' -f1)" = "$hash" ]] || { echo V3812_RESTORE_CORRUPT; exit 1; }
  [[ "$(wc -c < "$root/restored/$path" | tr -d ' ')" = "$bytes" ]] || exit 1
done < "$root/db-manifest"
# Corruption and missing file must both be detected, not auto repaired.
printf 'corruption' >> "$root/restored/$key"
[[ "$(sha256sum "$root/restored/$key" | cut -d' ' -f1)" != "$digest" ]] || exit 1
rm "$root/restored/$key"
[[ ! -f "$root/restored/$key" ]] || exit 1
[[ -f "$root/restored/finance/documents/CI_ORPHAN/ORPHAN.pdf" ]] || exit 1
echo FINANCE_V3812_RESTORE_RECONCILIATION_MISSING_CORRUPT_ORPHAN_PASS
