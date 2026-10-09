#!/usr/bin/env bash
set -euo pipefail
# CI-only proof of backup + isolated restore for attachment object bytes.
# Never uses any production path, bucket, backup schedule or live customer data.
[[ "${GITHUB_ACTIONS:-}" = true ]] || { echo FINANCE_V3810_NOT_GITHUB_CI; exit 70; }
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/objects/finance/documents/CI_DOC" "$root/backups" "$root/restore"
printf 'synthetic bytes for isolated CI only\n' > "$root/objects/finance/documents/CI_DOC/PROOF.pdf"
sha256sum "$root/objects/finance/documents/CI_DOC/PROOF.pdf" | awk '{print $1}' > "$root/evidence.sha256"
tar -C "$root/objects" -czf "$root/backups/finance-attachments.tar.gz" finance
tar -C "$root/restore" -xzf "$root/backups/finance-attachments.tar.gz"
actual=$(sha256sum "$root/restore/finance/documents/CI_DOC/PROOF.pdf" | awk '{print $1}')
expected=$(cat "$root/evidence.sha256")
[[ "$actual" = "$expected" ]] || { echo FINANCE_V3810_RESTORE_HASH_FAILED; exit 1; }
[[ "$(find "$root/restore" -type f | wc -l | tr -d ' ')" = 1 ]] || exit 1
echo FINANCE_V3810_EPHEMERAL_ATTACHMENT_BACKUP_RESTORE_PASS
