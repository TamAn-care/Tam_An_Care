#!/usr/bin/env bash
# V58: prove safe integration baseline BEFORE any worktree/build/copy.
set -euo pipefail
[[ "$(hostname -s)" == beta-docker ]] || { echo 'STOP_WRONG_HOST'; exit 2; }
MAIN=/home/ag/tamancare-antigravity
FIN=/home/ag/tamancare-finance-safe/workspaces/finance-pnl-20261007_143559
for root in "$MAIN" "$FIN"; do git -C "$root" rev-parse --is-inside-work-tree 2>/dev/null | grep -qx true || { echo "STOP_MISSING_REPO=$root"; exit 2; }; done
echo 'V58_PROTECTED_SOURCE_INVENTORY'
for root in "$MAIN" "$FIN"; do
 echo "ROOT=$root"
 git -C "$root" rev-parse HEAD | sed 's/^/HEAD=/'
 git -C "$root" status --porcelain --untracked-files=no | awk 'END {print "TRACKED_MODIFICATIONS=" NR}'
done
echo 'V58_CANONICAL_FINANCE_MODULES'
required=(api/src/finance-billing/finance-read.controller.ts api/src/finance-billing/monthly-operating-result.service.ts frontend/src/features/finance/MonthlyOperatingResultPanel.tsx)
missing=0
for file in "${required[@]}"; do
 if [[ -f "$FIN/$file" ]]; then echo "SERVER_FINANCE_FILE_PRESENT=$file"; else echo "SERVER_FINANCE_FILE_MISSING=$file"; missing=$((missing+1)); fi
done
echo 'V58_PRODUCTION_RUNTIME_IMAGE_IDENTITIES'
for ctr in tamancare-production-test-server-api-1 tamancare-production-test-server-frontend-1; do
 docker inspect --format 'CONTAINER={{.Name}} IMAGE={{.Image}} REF={{.Config.Image}}' "$ctr" || { echo 'STOP_RUNTIME_UNKNOWN'; exit 2; }
done
# CRITICAL: Never create candidate from unrelated/stale source without provenance.
echo "MISSING_FINANCE_FILES=$missing"
echo 'BASELINE_PROVENANCE=NOT_PROVEN'
echo 'CANDIDATE_CREATION=BLOCKED'
echo 'REQUIRED=VERIFIED_RUNTIME_SOURCE_AND_CLEAN_ISOLATED_GITHUB_FINANCE_CLONE'
echo 'DB_WRITE=NO MIGRATION=NO SEED=NO DEPLOY=NO'
echo 'PRODUCTION_GO_NO_GO=NO_GO'
