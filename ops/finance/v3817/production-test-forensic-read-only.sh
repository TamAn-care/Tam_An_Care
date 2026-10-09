#!/usr/bin/env bash
# V3.8.17 Production Test forensic audit: ONLY read operations.
set -euo pipefail
printf 'AUDIT=V3817\nMODE=READ_ONLY\nUTC=%s\n' "$(date -u +%FT%TZ)"
printf 'SERVER=%s\n' "$(hostname)"
printf '\n[DISK]\n'; df -hP / 2>/dev/null || true
printf '\n[RUNTIME]\n'
if command -v docker >/dev/null; then
 docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null || echo RUNTIME_UNAVAILABLE
else echo DOCKER_NOT_AVAILABLE; fi
printf '\n[CANONICAL_GIT]\n'
for p in /opt/tamancare /srv/tamancare /home/ag/Tam_An_Care /home/ag/tamancare; do
 if [ -d "$p/.git" ]; then
  (cd "$p" && printf '%s|%s|%s\n' "$p" "$(git rev-parse HEAD 2>/dev/null || echo UNKNOWN)" "$(git branch --show-current 2>/dev/null || echo UNKNOWN)")
 fi
done
printf '\n[STORAGE_DIRECTORY_CANDIDATES]\n'
for p in /srv/tamancare/attachments /opt/tamancare/attachments /home/ag/tamancare/attachments; do
 if [ -e "$p" ] || [ -L "$p" ]; then
  stat -c '%F|%a|%U:%G|%n' "$p" 2>/dev/null || echo STAT_UNAVAILABLE
 fi
done
printf '\n[BACKUP_SCHEDULER_METADATA]\n'
if command -v systemctl >/dev/null; then
 systemctl list-timers --all --no-pager --plain 2>/dev/null | grep -Ei 'backup|snapshot|taman' | head -25 || true
fi
printf '\n[POSTGRES_PROOF]\n'
echo POSTGRES_SCHEMA=UNVERIFIED_NO_AUTHENTICATED_READ_ONLY_CONNECTION
echo ATTACHMENT_METADATA=UNVERIFIED_NO_CANONICAL_DATABASE
echo BACKUP_RESTORE=UNVERIFIED_NO_ISOLATED_RESTORE
echo SESSION_RBAC=UNVERIFIED_NO_NEGATIVE_TEST
echo LIVE_SOURCE_MATCH=UNVERIFIED_UNTIL_IMAGE_SOURCE_PROVEN
echo V3817_FINAL=NO_GO
echo DB_WRITE=NO
echo SEED=NO
echo MIGRATION=NO
echo DEPLOY=NO
echo RESTART=NO
echo FILE_DELETE=NO
