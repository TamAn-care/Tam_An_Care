'use strict';
/* V3.8.16: read-only finance production readiness assessor.
   Ingest operator-reviewed observations; NEVER execute remote commands,
   query a live DB, mutate infrastructure, or infer proofs from CI. */
const REQUIRED=['SOURCE_RUNTIME_MATCH','POSTGRES_SCHEMA_READ_ONLY',
 'SESSION_RBAC','ATTACHMENT_STORAGE','BACKUP_RESTORE_ISOLATED',
 'SOURCE_PROVENANCE'];
function assess(observations) {
 const blockers=[];
 if (!Array.isArray(observations)) observations=[];
 for (const kind of REQUIRED) {
   const items=observations.filter(x=>x&&x.kind===kind&&x.environment==='PRODUCTION_TEST');
   if(items.length!==1||items[0].result!=='PASS'||
      typeof items[0].evidenceId!=='string'||!/^[-_A-Za-z0-9]{8,160}$/.test(items[0].evidenceId)||
      typeof items[0].observedAt!=='string'||!Number.isFinite(Date.parse(items[0].observedAt))) {
     blockers.push('UNVERIFIED_'+kind);
   }
 }
 const unsupported=observations.filter(x=>!x||!REQUIRED.includes(x.kind)||
   !['PRODUCTION_TEST','ISOLATED_CI'].includes(x.environment));
 if(unsupported.length) blockers.push('UNRECOGNIZED_EVIDENCE');
 blockers.push('HUMAN_RELEASE_APPROVAL_REQUIRED');
 return {checkpoint:'TAMANCARE_FINANCE_V3816_READ_ONLY_AUDIT',
  decision:'NO_GO',blockers,checked:REQUIRED.length,
  productionWriteAuthorized:false,productionDeployAuthorized:false,
  monthCloseCertified:false};
}
module.exports={assess,REQUIRED};
