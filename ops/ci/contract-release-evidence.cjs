'use strict';
/* GitHub-only deterministic release manifest. A passing workflow is NOT deployment approval. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const required=[
 'api/src/finance-billing/contract-signoff.controller.ts',
 'api/src/finance-billing/canonical-contract-draft.controller.ts',
 'api/src/finance-billing/canonical-service-contracts.controller.ts',
 'frontend/src/api/service-contracts.ts',
 'ops/finance/v30/005_shared_contract_version_history.sql',
 'ops/finance/v30/006_shared_contract_signoff_evidence.sql',
 'ops/ci/shared-contract-postgres-signoff-test.cjs',
 'ops/ci/contract-production-acceptance-gate.cjs',
];
const manifest=required.map(file=>{
 const bytes=fs.readFileSync(path.join(root,file));
 return {file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const gates={
 isolatedSourceFilesPresent:manifest.length===required.length,
 productionSchemaValidated:false,
 runtimeAuthenticatedHttpJwtE2E:false,
 signedDocumentServerHashProven:false,
 legacyRealContractsReconciled:false,
 databaseBackupRestoreProven:false,
 explicitDeployApproval:false,
};
const readiness=Object.values(gates).every(Boolean)?'GO':'NO_GO';
const result={name:'TAMANCARE_CONTRACT_GRAND_FAST_RESUME',gitSha:process.env.GITHUB_SHA||'LOCAL_CHECK',
  generatedFrom:'GITHUB_SOURCE_ONLY',manifest,gates,readiness,
  productionDeployExecuted:false,productionMutationExecuted:false};
fs.mkdirSync(path.join(root,'ops/ci/out'),{recursive:true});
fs.writeFileSync(path.join(root,'ops/ci/out/contract-release-evidence.json'),JSON.stringify(result,null,2)+'\n');
for(const [name,value] of Object.entries(gates))console.log('GATE_'+name+'='+(value?'PASS':'BLOCKED'));
console.log('CONTRACT_GRAND_RELEASE='+readiness);
console.log('PRODUCTION_DEPLOY=NO');
if(!gates.isolatedSourceFilesPresent)process.exitCode=1;
