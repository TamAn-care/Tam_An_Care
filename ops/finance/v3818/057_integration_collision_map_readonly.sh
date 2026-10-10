#!/usr/bin/env bash
# V3.8.18.57 — read-only collision map; NO MERGE, no checkout.
set -euo pipefail
[[ "$(hostname -s)" == beta-docker ]] || { echo 'SAFE_STOP_WRONG_HOST'; exit 2; }
MAIN=/home/ag/tamancare-antigravity
FIN=/home/ag/tamancare-finance-safe/workspaces/finance-pnl-20261007_143559
[[ -d "$MAIN/.git" && -d "$FIN/.git" ]] || { echo 'SAFE_STOP_SOURCE_NOT_FOUND'; exit 2; }
echo 'V57_SOURCE_IDENTITIES'
for p in "$MAIN" "$FIN"; do
 echo "ROOT=$p"
 git -C "$p" rev-parse HEAD | sed 's/^/SHA=/'
 git -C "$p" branch --show-current | sed 's/^/BRANCH=/'
done
echo 'V57_SHARED_INTEGRATION_FILES'
shared=(api/src/app.module.ts api/src/finance-billing/finance-read.controller.ts api/src/finance-billing/monthly-operating-result.service.ts frontend/src/app/router.tsx frontend/src/auth/role-policy.ts frontend/src/components/navigation/AppNavigation.tsx frontend/src/features/finance/MonthlyOperatingResultPanel.tsx)
conflicts=0
for p in "${shared[@]}"; do
 ma=ABSENT; fa=ABSENT
 [[ -f "$MAIN/$p" ]] && ma="$(sha256sum "$MAIN/$p" | cut -d' ' -f1)"
 [[ -f "$FIN/$p" ]] && fa="$(sha256sum "$FIN/$p" | cut -d' ' -f1)"
 dirty=NO
 if git -C "$MAIN" ls-files --error-unmatch "$p" >/dev/null 2>&1; then
  [[ -z "$(git -C "$MAIN" status --porcelain -- "$p")" ]] || dirty=YES
 fi
 state=UNKNOWN
 if [[ "$ma" == ABSENT && "$fa" == ABSENT ]]; then state=BOTH_ABSENT
 elif [[ "$ma" == ABSENT ]]; then state=FINANCE_ONLY_CANDIDATE
 elif [[ "$fa" == ABSENT ]]; then state=MAIN_ONLY_PRESERVE
 elif [[ "$ma" == "$fa" ]]; then state=IDENTICAL
 else state=CONTENT_COLLISION; conflicts=$((conflicts+1)); fi
 echo "FILE=$p STATE=$state MAIN_SHA=$ma FIN_SHA=$fa MAIN_DIRTY=$dirty"
done
echo "CONTENT_COLLISIONS=$conflicts"
echo 'DECISION=NO_AUTO_MERGE'
echo 'IMAGE_PARITY=NOT_PROVEN'
echo 'PRODUCTION_GO_NO_GO=NO_GO'
echo 'DB_WRITE=NO SEED=NO MIGRATION=NO DEPLOY=NO'
