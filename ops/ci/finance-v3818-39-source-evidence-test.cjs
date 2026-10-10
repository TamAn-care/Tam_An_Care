'use strict';
const assert=require('node:assert/strict');
const {assessV39}=require('../../api/dist/finance-billing/finance-v381839-verified-source-evidence.js');
const sources=['invoices','careFees','leaveAdjustments','inventoryConsumption','payroll','manualVouchers','otherExpenses'];
const proofs=sources.map(source=>({source,catalogVerified:true,approvedRowsVerified:true,ledgerLinked:true,periodComplete:true,reviewedByServer:true}));
const counts={unpostedApprovedCount:0,duplicateOriginCount:0,unlinkedSourceCount:0};
const entries=[{entryId:'e39',kind:'REVENUE',recognitionDate:'2026-09-08',amountVnd:'100000',posted:true,sourceVerified:true}];
assert.equal(assessV39('2026-09',entries,proofs,counts).state,'READY');
assert.equal(assessV39('2026-09',entries,proofs,null).state,'CHUA_DU_DU_LIEU');
assert.equal(assessV39('2026-09',entries,proofs.slice(1),counts).profitVnd,null);
assert.equal(assessV39('2026-09',entries,[...proofs,proofs[0]],counts).state,'CHUA_DU_DU_LIEU');
for(const key of ['catalogVerified','approvedRowsVerified','ledgerLinked','periodComplete','reviewedByServer']){
 const altered=proofs.map(p=>p.source==='payroll'?{...p,[key]:false}:p);
 assert.equal(assessV39('2026-09',entries,altered,counts).state,'CHUA_DU_DU_LIEU');
}
assert.equal(assessV39('2026-09',entries,proofs,{...counts,duplicateOriginCount:1}).state,'CHUA_DU_DU_LIEU');
assert.equal(assessV39('2026-09',entries,proofs,counts).operationalReleaseReady,false);
console.log('FINANCE_V381839_SOURCE_PROOF_FAIL_CLOSED_PASS');
