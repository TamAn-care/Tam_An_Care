'use strict';
const assert=require('node:assert/strict');
const {assessV39}=require('../../api/dist/finance-billing/finance-v381839-verified-source-evidence.js');
const sources=['invoices','careFees','leaveAdjustments','inventoryConsumption','payroll','manualVouchers','otherExpenses'];
const complete=sources.map(source=>({source,catalogVerified:true,approvedRowsVerified:true,ledgerLinked:true,periodComplete:true,reviewedByServer:true}));
const counts={unpostedApprovedCount:0,duplicateOriginCount:0,unlinkedSourceCount:0};
const month='2026-10',entries=[];
function notReady(proofs,countsValue,description){
 const x=assessV39(month,entries,proofs,countsValue);
 assert.equal(x.state,'CHUA_DU_DU_LIEU',description);
 assert.equal(x.profitVnd,null,description+' must not show a false profit');
 assert.equal(x.operationalReleaseReady,false,description+' must not authorize release');
}
notReady(null,null,'no verified live source');
notReady([],counts,'empty catalog');
notReady(complete,null,'missing independently reconciled counters');
for(const source of sources){
 notReady(complete.filter(p=>p.source!==source),counts,'missing '+source);
 for(const field of ['catalogVerified','approvedRowsVerified','ledgerLinked','periodComplete','reviewedByServer']){
  notReady(complete.map(p=>p.source===source?{...p,[field]:false}:p),counts,source+' / '+field);
 }
}
notReady([...complete,complete[0]],counts,'duplicated source proof');
for(const key of Object.keys(counts))notReady(complete,{...counts,[key]:1},'nonzero '+key);
console.log('V66_7_CANONICAL_SOURCES_FAIL_CLOSED_PASS');
console.log('V66_NO_REAL_BUSINESS_DATA_ASSERTED');
