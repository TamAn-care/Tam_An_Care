#!/usr/bin/env bash
# Finance V3.8.18 — baseline/source reconciliation. Metadata only.
# Run from an admin terminal on the production-test host or over SSH.
set -euo pipefail
export LC_ALL=C
echo "VERSION=V3.8.18"
echo "MODE=READ_ONLY"
echo "HOST=$(hostname)"
echo "UTC=$(date -u +%FT%TZ)"
for kind in api frontend; do
 name="tamancare-production-test-server-${kind}-1"
 echo "COMPONENT=${kind}"
 image_id=$(docker inspect --format '{{.Image}}' "$name")
 state=$(docker inspect --format '{{.State.Status}}' "$name")
 image_ref=$(docker inspect --format '{{.Config.Image}}' "$name")
 printf 'IMAGE_ID=%s\nIMAGE_REF=%s\nSTATE=%s\n' "$image_id" "$image_ref" "$state"
 [ "$state" = running ] || { echo "BASELINE_STATE=BLOCKED"; exit 3; }
 # Image config metadata is not sufficient for a source provenance match.
 docker image inspect --format 'IMAGE_CREATED={{.Created}}' "$image_id"
done
api=tamancare-production-test-server-api-1
frontend=tamancare-production-test-server-frontend-1
echo "API_DIST_MODULE_MARKERS"
docker exec -i "$api" node - <<'NODE'
const fs=require('fs'),path=require('path');
const root='/app/dist';
if(!fs.existsSync(root)){console.log('API_DIST=ABSENT');process.exit(2);}
const matches=['FinanceReadController','FinanceWriteController','MonthlyOperatingResultService','finance_entries','billing_invoices'];
const counts=Object.fromEntries(matches.map(x=>[x,0]));
let n=0;
function walk(dir){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);
  if(e.isDirectory())walk(p);
  else if(e.isFile()&&e.name.endsWith('.js')){
   n++;const body=fs.readFileSync(p,'utf8');
   for(const x of matches)if(body.includes(x))counts[x]++;
  }
 }
}
walk(root);
console.log('API_JS_COUNT='+n);
for(const [x,count] of Object.entries(counts)) console.log('MARKER_'+x+'='+count);
NODE
echo "FRONTEND_BUNDLE_MARKERS"
docker exec -i "$frontend" sh -c '
 root=/usr/share/nginx/html
 [ -d "$root" ] || { echo FRONTEND_ROOT_ABSENT; exit 2; }
 for marker in finance-read FINANCE_INVOICE_LIST_API_NOT_READY mockInvoices; do
   if grep -r -F -l --include="*.js" "$marker" "$root" 2>/dev/null | grep -q .; then
     echo "FRONTEND_MARKER_$marker=FOUND"
   else
     echo "FRONTEND_MARKER_$marker=NOT_FOUND"
   fi
 done
'
echo "SOURCE_IMAGE_MATCH=UNVERIFIED"
echo "FINANCE_INTEGRATION_READY=NO"
echo "PRODUCTION_GO_NO_GO=NO_GO"
echo "DATABASE_WRITE=NO"
echo "MIGRATION=NO"
echo "SEED=NO"
echo "DEPLOY=NO"
echo "RESTART=NO"
echo "DOCKER_VOLUME_CHANGE=NO"
echo "BACKUP_CHANGE=NO"
echo "RESULT=TAMANCARE_FINANCE_V3818_BASELINE_AUDIT_COMPLETE"
