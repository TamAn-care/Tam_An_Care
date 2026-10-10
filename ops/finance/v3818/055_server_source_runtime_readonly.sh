#!/usr/bin/env bash
# V3.8.18.55 — run on beta-docker only; inspect Git/source/runtime without writes.
set -euo pipefail
[[ "$(hostname -s)" == beta-docker ]] || { echo 'SAFE_STOP_WRONG_HOST'; exit 2; }
for x in git docker sha256sum find; do command -v "$x" >/dev/null || { echo "MISSING_TOOL=$x"; exit 2; }; done
echo 'GATE55_SOURCE_RUNTIME_READONLY_BEGIN'
echo 'GIT_REPOSITORIES (paths and revision only; no secrets):'
for root in /home/ag /opt/tamancare /srv/tamancare; do
 [[ -d "$root" ]] || continue
 while IFS= read -r -d '' gitdir; do
  repo="${gitdir%/.git}"
  [[ -d "$repo" ]] || continue
  echo "REPO=$repo"
  git -C "$repo" rev-parse --verify HEAD 2>/dev/null | sed 's/^/HEAD_SHA=/' || :
  git -C "$repo" branch --show-current 2>/dev/null | sed 's/^/BRANCH=/' || :
  git -C "$repo" status --porcelain --untracked-files=no 2>/dev/null | awk 'END{print "TRACKED_CHANGES=" NR}'
  for name in ops/finance/v22/001_finance_foundation.sql ops/finance/v28/002_finance_transaction_safety.sql ops/finance/v29/003_finance_allocation_invariants.sql ops/finance/v29/004_finance_integrity_hardening.sql; do
   if [[ -f "$repo/$name" ]]; then sha256sum "$repo/$name" | awk -v n="$name" '{print "MIGRATION_SHA256 " n " " $1}'; else echo "MIGRATION_MISSING=$name"; fi
  done
 done < <(find "$root" -maxdepth 5 -type d -name .git -print0 2>/dev/null)
done
echo 'RUNNING_CONTAINER_IDENTITIES (no inspect/env/logs):'
docker ps --format '{{.Names}}|{{.Image}}|{{.ID}}|{{.Status}}' | while IFS='|' read -r name image id status; do
 case "$name" in *tamancare*|*production-test*)
   echo "CONTAINER_NAME=$name IMAGE_REF=$image CONTAINER_ID=$id STATUS=$status"
   docker inspect --format 'IMAGE_ID={{.Image}} CREATED={{.Created}}' "$id"
 ;;
 esac
done
echo 'GATE55_EVIDENCE_ONLY=PASS'
echo 'SOURCE_RUNTIME_PARITY=NOT_PROVEN'
echo 'DATABASE_WRITE=NO MIGRATION=NO SEED=NO DEPLOY=NO'
echo 'PRODUCTION_GO_NO_GO=NO_GO'
