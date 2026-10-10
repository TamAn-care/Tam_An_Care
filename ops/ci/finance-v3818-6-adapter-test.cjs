'use strict';
const assert=require('node:assert/strict');
const {assessAdapterBatch}=require('../../api/dist/finance-billing/finance-v38186-real-source-adapter-contract.js');
const row={family:'APPROVED_INVOICE',sourceId:'inv3',sourceVersion:'v1',date:'2026-10-01',amountVnd:'14000000',entryType:'REVENUE',approval:'VERIFIED',evidence:'VERIFIED',reconciled:'VERIFIED',originKey:'approved_202610_inv3'};
const base={adapterId:'BILLING_CANONICAL',authoritativeSource:'POSTGRESQL',snapshotId:'snapshot1',cursorBefore:'1',cursorAfter:'2',sourceAvailability:'VERIFIED',schemaVerified:'VERIFIED',sessionRbacVerified:'VERIFIED',evidenceChainVerified:'VERIFIED',rows:[row]};
let result=assessAdapterBatch(base);
assert.equal(result.status,'CANDIDATES_ONLY');
assert.equal(result.commitEnabled,false);
assert.equal(result.candidatePlan.postingEnabled,false);
assert.equal(result.nextCursor,'2');
for(const change of [
 {authoritativeSource:'BROWSER'},
 {cursorBefore:'3',cursorAfter:'2'},
 {sourceAvailability:'MISSING'},
 {schemaVerified:'UNVERIFIED'},
 {sessionRbacVerified:'UNVERIFIED'},
 {evidenceChainVerified:'UNVERIFIED'},
 {rows:[row,{...row,sourceId:'inv4'}]},
 {rows:[{...row,family:'PAYMENT_RECEIPT'}]}
]){
 result=assessAdapterBatch({...base,...change});
 assert.equal(result.status,'BLOCKED',JSON.stringify(change));
 assert.equal(result.nextCursor,null);
 assert.equal(result.candidatePlan.items.length,0);
}
console.log('TAMANCARE_FINANCE_V3818_6_REAL_SOURCE_ADAPTER_CI_PASS');
