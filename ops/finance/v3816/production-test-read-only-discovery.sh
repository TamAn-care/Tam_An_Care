#!/usr/bin/env bash
# V3.8.16 LIVE PRODUCTION TEST DISCOVERY — READ ONLY.
# Execute through SSH as a nonprivileged operator. Emits no secret values.
set -euo pipefail
echo "V3816_AUDIT_MODE=READ_ONLY"
echo "HOSTNAME=$(hostname)"
echo "OBSERVED_UTC=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "KERNEL=$(uname -s)"
echo "--- DISK PRESSURE ---"
df -hP / || true
echo "--- RUNNING CONTAINERS (NAMES/IMAGES/STATUS; NO ENV) ---"
if command -v docker >/dev/null 2>&1; then
 docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}' 2>/dev/null || echo DOCKER_DISCOVERY_UNAVAILABLE
else echo DOCKER_NOT_INSTALLED; fi
echo "--- REPO CANDIDATES (NO CONFIG/SECRETS) ---"
for d in /opt/tamancare /srv/tamancare /home/ag/Tam_An_Care /home/ag/tamancare; do
 if [[ -d "$d/.git" ]]; then
  (cd "$d" && printf 'repo=%s\ncommit=%s\nbranch=%s\n' "$d" "$(git rev-parse --verify HEAD 2>/dev/null || echo UNKNOWN)" "$(git branch --show-current 2>/dev/null || echo UNKNOWN)")
 fi
done
echo "--- DATABASE METADATA / BACKUP RESTORE ---"
echo POSTGRES_SCHEMA=NOT_VERIFIED_WITHOUT_READ_ONLY_DB_CREDENTIALS
echo ACTUAL_BACKUP_RESTORE=NOT_VERIFIED_WITHOUT_ISOLATED_RESTORE_EVIDENCE
echo ATTACHMENT_ROOT=NOT_VERIFIED_WITHOUT_VERIFIED_CANONICAL_PATH
echo SESSION_RBAC=NOT_VERIFIED_WITHOUT_AUTHENTICATED_NEGATIVE_TEST
echo SOURCE_PROVENANCE=NOT_VERIFIED
echo RELEASE_DECISION=NO_GO
echo DATABASE_WRITE=NO
echo FILE_DELETE=NO
echo MIGRATION=NO
echo SEED=NO
echo DEPLOY=NO
echo RESTART=NO
