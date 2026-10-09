#!/usr/bin/env bash
# Read-only discovery of current backup/deploy scheduling, without printing secrets or paths.
set -Eeuo pipefail
echo 'TAMANCARE_CONTROLLED_PULL_DISCOVERY_V2'
echo 'MODE=READ_ONLY'
echo '=== CRON SCHEDULE SHAPES (no commands) ==='
crontab -l 2>/dev/null | awk '
 /^[[:space:]]*#/ {if ($0 ~ /TAMANCARE|BACKUP/) print "BACKUP_COMMENT_PRESENT=YES";next}
 NF>=6 {printf "CRON_TIME_FIELDS=%s %s %s %s %s\n",$1,$2,$3,$4,$5; count++}
 END {printf "USER_CRON_JOB_COUNT=%d\n",count+0}' || true
echo '=== BACKUP AND DEPLOY SYSTEMD UNITS (names only) ==='
systemctl list-unit-files --type=service --type=timer --no-legend --no-pager 2>/dev/null |
 awk 'tolower($1) ~ /tamancare|backup|deploy|pull|cloudflared/ {print "UNIT_NAME="$1" STATE="$2}' || true
echo '=== CONTAINER STATES (names/status only) ==='
if docker info >/dev/null 2>&1;then
 docker ps --format '{{.Names}} | {{.State}}' |
 awk '/tamancare|production|backup/{print "CONTAINER="$0}'
else echo 'DOCKER_ACCESS=UNAVAILABLE';fi
echo '=== BACKUP STORAGE DISCOVERY ==='
echo 'BACKUP_FILE_LOCATION=NOT_VERIFIED'
echo 'BACKUP_SHA256=NOT_VERIFIED'
echo 'LAST_RESTORE_PASS=NOT_VERIFIED'
echo '=== CAPACITY ==='
df -P / | awk 'NR==2 {print "DISK_USED_PERCENT="$5;print "FREE_KB="$4}'
awk '/MemAvailable:/ {print "MEM_AVAILABLE_KB="$2}' /proc/meminfo
echo 'DEPLOY=NO'
echo 'MIGRATION=NO'
echo 'SEED=NO'
echo 'CONFIG_CHANGE=NO'
echo 'RESULT=READONLY_DISCOVERY_COMPLETE_NOT_BACKUP_VERIFIED'
