#!/usr/bin/env bash
# Tâm An Care: non-mutating on-host preflight before installing GitHub Actions runner.
# Does NOT install, register, create users, access docker socket or read business rows.
set -Eeuo pipefail
umask 077
echo 'TAMANCARE_RUNNER_SERVER_BOOTSTRAP_PREFLIGHT_V1'
echo "KERNEL=$(uname -s)"
echo "ARCH=$(uname -m)"
echo "EUID_IS_ROOT=$([[ "$EUID" == 0 ]] && echo YES || echo NO)"
echo "SYSTEMD_PRESENT=$(command -v systemctl >/dev/null && echo YES || echo NO)"
echo "CURL_PRESENT=$(command -v curl >/dev/null && echo YES || echo NO)"
echo "TAR_PRESENT=$(command -v tar >/dev/null && echo YES || echo NO)"
echo "SHA256_TOOL_PRESENT=$(command -v sha256sum >/dev/null && echo YES || echo NO)"
echo "DISK_AVAILABLE_KB=$(df -Pk /opt 2>/dev/null | awk 'NR==2{print $4}' || echo UNKNOWN)"
echo "RAM_AVAILABLE_KB=$(awk '/MemAvailable:/{print $2}' /proc/meminfo 2>/dev/null || echo UNKNOWN)"
if id tamancare-ghrunner >/dev/null 2>&1;then
 echo 'RUNNER_USER_PRESENT=YES'
 groups="$(id -nG tamancare-ghrunner)"
 for group in docker sudo adm root;do
  case " $groups " in *" $group "*) echo 'RUNNER_GROUP_SECURITY=BLOCKED';exit 10;; esac
 done
 echo 'RUNNER_GROUP_SECURITY=PASS'
else
 echo 'RUNNER_USER_PRESENT=NO'
fi
if [[ -S /var/run/docker.sock ]];then
 echo 'DOCKER_SOCKET_EXISTS=YES'
else
 echo 'DOCKER_SOCKET_EXISTS=NO'
fi
echo 'REPOSITORY_RUNNER_REGISTRATION=NOT_CHECKED'
echo 'PRODUCTION_MUTATION=NO'
echo 'RUNNER_BOOTSTRAP_PREFLIGHT=COMPLETE'
