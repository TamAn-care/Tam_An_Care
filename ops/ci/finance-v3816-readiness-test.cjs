'use strict';
const assert=require('node:assert/strict');
const {assess,REQUIRED}=require('./finance-v3816-readiness-assessor.cjs');
const ci=REQUIRED.map((kind,i)=>({kind,environment:'ISOLATED_CI',result:'PASS',
 evidenceId:'CI_EVIDENCE_'+i,observedAt:'2026-10-10T00:00:00Z'}));
let output=assess(ci);
assert.equal(output.decision,'NO_GO');
assert.equal(output.blockers.length,REQUIRED.length+1);
assert.equal(output.productionWriteAuthorized,false);
assert.equal(output.productionDeployAuthorized,false);
const fakeLive=REQUIRED.map((kind,i)=>({...ci[i],environment:'PRODUCTION_TEST'}));
output=assess(fakeLive);
assert.deepEqual(output.blockers,['HUMAN_RELEASE_APPROVAL_REQUIRED']);
assert.equal(output.monthCloseCertified,false);
output=assess([...fakeLive,{...fakeLive[0]}]);
assert(output.blockers.includes('UNVERIFIED_SOURCE_RUNTIME_MATCH'));
console.log('FINANCE_V3816_READ_ONLY_EVIDENCE_GATE_PASS');
