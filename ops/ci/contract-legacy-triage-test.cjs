'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'api/src/finance-billing/contract-legacy-triage.ts'),'utf8');
function locate(folder,name){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,item.name);if(item.isDirectory()){const nested=locate(p,name);if(nested)return nested;}else if(item.name===name)return p;}}
const compiled=locate(path.join(root,'api/dist'),'contract-legacy-triage.js');
assert.ok(compiled,'Compiled contract triage module must exist');
const {classifyLegacyContract:triage}=require(compiled);
const baseline={source:'BROWSER_LOCAL_STORAGE',contractId:'real_contract_1',residentId:'resident_1',contractCode:'C1',hasSignedPaper:true,paperDocumentVerifiedByOperator:true,residentMatchedByOperator:true,appearsDemo:false};
assert.equal(triage(baseline),'READY_FOR_MANUAL_REVIEW');
assert.equal(triage({...baseline,contractId:'ctr-demo-001'}),'REJECT_DEMO');
assert.equal(triage({...baseline,appearsDemo:true}),'REJECT_DEMO');
assert.equal(triage({...baseline,hasSignedPaper:false}),'QUARANTINE_UNVERIFIED');
assert.equal(triage({...baseline,residentMatchedByOperator:false}),'QUARANTINE_UNVERIFIED');
assert.equal(triage({...baseline,source:'VERIFIED_SERVER'}),'QUARANTINE_UNVERIFIED');
assert.doesNotMatch(source,/INSERT INTO|DELETE FROM|localStorage\.setItem/);
console.log('CONTRACT_LEGACY_TRIAGE_SAFE_CLASSIFICATION_PASS');
console.log('IMPORT_EXECUTED=NO DELETE_EXECUTED=NO USER_DATA_READ=NO');
