'use strict';
const assert=require('node:assert/strict');
const {calculateAgreedPayroll:calculate}=require('../../api/dist/finance-billing/finance-v381814-payroll-calculator.js');
let v=calculate({baseAgreedVnd:'9000000',allowancesVnd:'1000000',bonusesVnd:'500000',deductionsVnd:'750000',employerCostVnd:'1500000'});
assert.equal(v.ok,true);assert.equal(v.grossVnd,'10500000');assert.equal(v.netPayableVnd,'9750000');assert.equal(v.employerTotalExpenseVnd,'12000000');assert.equal(v.postingEnabled,false);
for(const invalid of [{baseAgreedVnd:'9000.50'},{deductionsVnd:'99999999'},{baseAgreedVnd:'9999999999999999',bonusesVnd:'1'}]){
 const item=calculate({...{baseAgreedVnd:'9000000',allowancesVnd:'0',bonusesVnd:'0',deductionsVnd:'0',employerCostVnd:'0'},...invalid});
 assert.equal(item.ok,false);assert.equal(item.netPayableVnd,null);assert.equal(item.postingEnabled,false);
}
console.log('TAMANCARE_FINANCE_V3818_14_AGREED_PAYROLL_CALCULATOR_PASS');
