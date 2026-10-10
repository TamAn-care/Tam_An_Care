#!/usr/bin/env bash
# V3.8.18.56 — SERVER-SIDE READ-ONLY source/runtime reconciliation.
set -euo pipefail
[[ "$(hostname -s)" == "beta-docker" ]] || { echo 'STOP_WRONG_HOST'; exit 2; }
echo 'GATE56_MIGRATION_LOCATION'
# Filename-only inventory, bounded to known work roots; no contents exposed.
for root in /home/ag/tamancare-finance-safe /home/ag/tamancare-antigravity /home/ag/tamancare-pr3-review-NwI8G3oC /opt/tamancare /srv/tamancare; do
 [[ -d "$root" ]] || continue
 find "$root" -maxdepth 10 -type f \( -name '001_finance_foundation.sql' -o -name '002_finance_transaction_safety.sql' -o -name '003_finance_allocation_invariants.sql' -o -name '004_finance_integrity_hardening.sql' \) -print 2>/dev/null | while IFS= read -r file; do
   echo "MIGRATION_FILE=$file"
   sha256sum "$file" | awk '{print "MIGRATION_SHA256=" $1}'
 done
done
echo 'GATE56_REPOSITORY_TRACKED_CHANGE_NAMES'
for repo in /home/ag/tamancare-antigravity /home/ag/tamancare-finance-safe/workspaces/finance-pnl-20261007_143559 /home/ag/tamancare-pr3-review-NwI8G3oC/source; do
 [[ -d "$repo/.git" ]] || continue
 echo "REPO=$repo"
 git -C "$repo" rev-parse HEAD | sed 's/^/SHA=/'
 git -C "$repo" diff --name-only HEAD -- | sed 's/^/MODIFIED_TRACKED=/' | head -100
 git -C "$repo" diff --cached --name-only -- | sed 's/^/STAGED_TRACKED=/' | head -100
done
echo 'GATE56_RUNTIME_IMAGE_PROVENANCE'
for container in tamancare-production-test-server-api-1 tamancare-production-test-server-frontend-1; do
 if [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" != true ]]; then
  echo "RUNTIME_NOT_RUNNING=$container"; continue
 fi
 docker inspect --format 'CONTAINER={{.Name}} IMAGE_ID={{.Image}} IMAGE_REF={{.Config.Image}}' "$container"
 img="$(docker inspect --format '{{.Image}}' "$container")"
 docker image inspect --format 'IMAGE_ID={{.Id}} BUILT={{.Created}} LABEL_REVISION={{index .Config.Labels "org.opencontainers.image.revision"}}' "$img" 2>/dev/null || :
done
echo 'RESULT=TAMANCARE_FINANCE_V381856_DISCOVERY_EXECUTED'
echo 'SOURCE_RUNTIME_PARITY=NOT_PROVEN'
echo 'DB_WRITE=NO MIGRATION=NO SEED=NO DEPLOY=NO'
echo 'GO_NO_GO=NO_GO'
