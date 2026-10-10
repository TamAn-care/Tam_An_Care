'use strict';
const assert=require('node:assert/strict');
const {planCanonicalFinanceSync:plan}=require('../../api/dist/finance-billing/finance-v38185-source-sync-planner.js');
const base={
 family:'APPROVED_INVOICE',sourceId:'inv100',sourceVersion:'v1',date:'2026-10-01',
 amountVnd:'14500000',entryType:'REVENUE',approval:'VERIFIED',evidence:'VERIFIED',
 reconciled:'VERIFIED',originKey:'contract_period_100_202610'
};
let p=plan([base]);
assert.equal(p.status,'CANDIDATES_ONLY');
assert.equal(p.postingEnabled,false);
assert.deepEqual(p.items.map(x=>x.month),['2026-10']);
for(const family of ['PAYMENT_RECEIPT','PAYMENT_ALLOCATION','CONTRACT_VERSION','KITCHEN_RECEIPT','INVENTORY_MOVEMENT','RESIDENT_CONSUMPTION']){
 p=plan([{...base,family}]);assert.equal(p.status,'BLOCKED',family);
 assert.equal(p.items.length,0);
 assert(p.blockers.includes('NON_POSTING_SOURCE:'+family));
}
p=plan([base,{...base,sourceId:'inv101',sourceVersion:'v2',originKey:base.originKey}]);
assert.equal(p.status,'BLOCKED');assert(p.blockers.some(x=>x.startsWith('DUPLICATE_ORIGIN:')));
p=plan([base,{...base,sourceVersion:'v2',originKey:'other'}]);
assert.equal(p.status,'BLOCKED');assert(p.blockers.some(x=>x.startsWith('DUPLICATE_SOURCE:')));
for(const x of [
 {...base,amountVnd:'10.5'},
 {...base,date:'2026-02-30'},
 {...base,approval:'UNVERIFIED'},
 {...base,entryType:'PAYROLL'}
]){
 p=plan([base,x]);
 assert.equal(p.status,'BLOCKED');assert.equal(p.items.length,0);
}
p=plan([{...base,family:'PAYROLL_APPROVED',entryType:'PAYROLL',sourceId:'payroll100',originKey:'salary_202610'}]);
assert.equal(p.status,'CANDIDATES_ONLY');assert.equal(p.postingEnabled,false);
console.log('TAMANCARE_FINANCE_V3818_5_SYNC_PLANNER_CI_PASS');
