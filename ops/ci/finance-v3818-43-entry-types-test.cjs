'use strict';
const assert=require('node:assert/strict');
const {classifyV43,manualVoucherKindV43,V43_KINDS}=require('../../api/dist/finance-billing/finance-v381843-canonical-entry-types.js');
assert.equal(V43_KINDS.length,7);
for(const kind of V43_KINDS){
 const x=classifyV43(kind);
 assert.equal(x.valid,true);assert.equal(x.canonicalKind,kind);
 assert.equal(x.monthlyGroup,kind==='REVENUE'?'REVENUE':'EXPENSE');
 assert.equal(x.livePostingEnabled,false);
}
assert.deepEqual(classifyV43('EXPENSE'),{valid:false,canonicalKind:null,monthlyGroup:null,livePostingEnabled:false});
assert.equal(classifyV43('PAYMENT').valid,false);
assert.equal(manualVoucherKindV43('EXPENSE').valid,false);
assert.equal(manualVoucherKindV43('DEPRECIATION').valid,false);
assert.equal(manualVoucherKindV43('PAYROLL').canonicalKind,'PAYROLL');
console.log('TAMANCARE_FINANCE_V381843_CANONICAL_LEDGER_TYPES_PASS');
