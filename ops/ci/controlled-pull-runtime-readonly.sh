#!/usr/bin/env bash
# TamAnCare Production Test controlled-pull readiness — READ ONLY, operator-run.
# Never prints env, URLs, tokens, mount paths, Docker labels or business rows.
set -Eeuo pipefail
umask 077
echo "TAMANCARE_CONTROLLED_PULL_RUNTIME_AUDIT_V1"
echo "AUDIT_UTC=$(date -u +%FT%TZ)"
echo "HOST_OS=$(uname -s)"
echo "CPU_ARCH=$(uname -m)"
echo "AVAILABLE_MEMORY_KB=$(awk '/MemAvailable:/{print $2}' /proc/meminfo 2>/dev/null || echo UNKNOWN)"
echo "SWAP_FREE_KB=$(awk '/SwapFree:/{print $2}' /proc/meminfo 2>/dev/null || echo UNKNOWN)"
echo "ROOT_DISK_USED_PERCENT=$(df -P / | awk 'NR==2{gsub(/%/,\"\",$5);print $5}')"
echo "ROOT_DISK_FREE_KB=$(df -Pk / | awk 'NR==2{print $4}')"
echo "ROOT_INODES_USED_PERCENT=$(df -Pi / | awk 'NR==2{print $5}')"
for unit in docker.service nginx.service cloudflared.service;do
 state="$(systemctl is-active "$unit" 2>/dev/null || true)"
 case "$state" in active|inactive|failed|unknown|activating|deactivating) ;; *) state=other;; esac
 echo "UNIT_${unit//./_}=$state"
done
echo "SYSTEMD_TIMERS_ACTIVE_COUNT=$(systemctl list-timers --all --no-legend --no-pager 2>/dev/null | grep -c . || true)"
echo "CRON_SERVICE_ACTIVE=$(systemctl is-active cron 2>/dev/null || systemctl is-active crond 2>/dev/null || true)"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1;then
 echo "DOCKER_READ_ACCESS=YES"
 echo "RUNNING_CONTAINER_COUNT=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')"
 echo "DOCKER_DISK_USAGE_QUERY=NOT_RUN"
else
 echo "DOCKER_READ_ACCESS=NO"
 echo "RUNNING_CONTAINER_COUNT=NOT_VERIFIED"
fi
echo 'SCHEDULER_JOB_DEFINITIONS=NOT_READ'
echo 'TUNNEL_CONFIG_SECRETS=NOT_READ'
echo 'BACKUP_RESTORE=NOT_PERFORMED'
echo 'DATABASE_ROWS=NOT_READ'
echo 'DATABASE_WRITE=NO'
echo 'CONFIG_CHANGE=NO'
echo 'DEPLOY=NO'
echo 'RESULT=TAMANCARE_CONTROLLED_PULL_RUNTIME_RO_AUDIT_COMPLETE'
