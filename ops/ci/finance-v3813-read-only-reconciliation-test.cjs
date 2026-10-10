'use strict';
require('./finance-v3818-baseline-safety-test.cjs');
require('./finance-v3817-9-runtime-guard-test.cjs');
require('./finance-v3817-forensic-safety-test.cjs');
require('./finance-v3816-readiness-test.cjs');
const {assessFinanceEvidencePacket:assessV3815}=require('../../api/dist/finance-billing/finance-evidence-packet.js');
const ciProofs=['POSTGRES_SNAPSHOT','AUTHZ','RESTORE','PARENT_PATH','OBJECT_CONSISTENCY','SOURCE_PROVENANCE'].map(kind=>({kind,environment:'ISOLATED_CI',observedAt:'2026-10-10T00:00:00Z',reference:'isolated-ci-proof',verified:true}));
const v3815=assessV3815(ciProofs);
if(v3815.decision!=='NO_GO'||v3815.missing.length!==7||v3815.productionDeployAuthorized!==false)throw Error('V3815_CI_NOT_FAIL_CLOSED');
console.log('FINANCE_V3815_PRODUCTION_PROOF_REQUIREMENTS_PASS');
require('./finance-v3814-readiness-report-test.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {reconcileFinanceAttachmentsReadOnly:scan}=require('../../api/dist/finance-billing/finance-attachment-reconciliation.js');
async function main(){
const root=await fs.mkdtemp(path.join(os.tmpdir(),'finance-v3813-ci-'));
try{
const key='finance/documents/CI_DOC/PROOF.pdf';
const file=path.join(root,key);await fs.mkdir(path.dirname(file),{recursive:true});
const bytes=Buffer.from('CI test evidence');await fs.writeFile(file,bytes);
const descriptor={documentId:'CI_DOC',objectKey:key,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length};
let result=await scan(root,[descriptor]);assert.equal(result.status,'CLEAN');
await fs.writeFile(file,Buffer.from('tampered'));
result=await scan(root,[descriptor]);assert(result.incidents.some(x=>x.code==='CORRUPT'));
await fs.unlink(file);
result=await scan(root,[descriptor]);assert(result.incidents.some(x=>x.code==='MISSING'));
await fs.writeFile(path.join(root,'finance/documents/CI_DOC/EXTRA.pdf'),Buffer.from('orphan'));
result=await scan(root,[descriptor]);assert(result.incidents.some(x=>x.code==='ORPHAN'));
const invalid=await scan(root,[{...descriptor,objectKey:'../escape.pdf'}]);assert.equal(invalid.status,'INVALID');
const outside=path.join(root,'outside-target');await fs.writeFile(outside,'untouched');
await fs.symlink(outside,file);
result=await scan(root,[descriptor]);assert(result.incidents.some(x=>x.code==='CORRUPT'||x.code==='UNSAFE_PATH'));
assert.equal(await fs.readFile(outside,'utf8'),'untouched');
const {evaluateFinanceReleaseReadiness:evaluate}=require('../../api/dist/finance-billing/finance-release-readiness-report.js');
const evidence={snapshotConsistent:true,authenticatedRoleGatePassed:true,realSourceVerified:true,backupIsolatedRestorePassed:true,parentSymlinkSafetyPassed:true,durableMetadataObjectConsistencyPassed:true,productionMigrationAuthorized:true};
const gate=evaluate({incidents:[],scanned:1,evidence});
assert.equal(gate.decision,'NO_GO');
assert.equal(gate.productionDeployAuthorized,false);
assert.equal(gate.monthlyCloseCertified,false);
console.log('FINANCE_V3814_RELEASE_READINESS_FAIL_CLOSED_PASS');
console.log('FINANCE_V3813_READ_ONLY_RECONCILIATION_PASS');
}finally{await fs.rm(root,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e);process.exitCode=1});
