'use strict';
const assert = require('node:assert/strict');
const { calculateMonthlyOperatingResult: calculate } =
  require('../../api/dist/finance-billing/monthly-operating-result.js');
const base={month:'2026-10',ledgerCoverageComplete:true,reconciliationComplete:true};
function entry(id,kind,amountVnd,date='2026-10-12'){
 return {entryId:id,kind,amountVnd,recognitionDate:date,posted:true,sourceVerified:true};
}
const revenue=entry('revenue','REVENUE','16000000');
const costs=[
 entry('direct','DIRECT_COST','4500000'),
 entry('payroll','PAYROLL','7000000'),
 entry('opex','OPERATING_EXPENSE','2000000'),
 entry('depreciation','DEPRECIATION','500000'),
 entry('interest','INTEREST','250000'),
 entry('tax','TAX','750000')
];
const calculated=calculate({...base,entries:[revenue,...costs]});
assert.equal(calculated.state,'READY');
assert.equal(calculated.revenueVnd,'16000000');
assert.equal(calculated.expenseVnd,'15000000');
assert.equal(calculated.profitVnd,'1000000');
assert.equal(calculated.expenseEntries,6);
assert.equal(calculated.grossProfitVnd,'11500000');
assert.equal(calculated.ebitdaVnd,'2500000');
assert.equal(calculated.profitBeforeTaxVnd,'1750000');
assert.equal(calculated.netProfitVnd,'1000000');
assert.equal(calculate({...base,entries:[entry('r','REVENUE','1'),entry('e','DIRECT_COST','3')]}).profitVnd,'-2');
const notProven=[
 {...base,ledgerCoverageComplete:false,entries:[revenue]},
 {...base,reconciliationComplete:false,entries:[revenue]},
 {...base,entries:[{...revenue,posted:false}]},
 {...base,entries:[{...revenue,sourceVerified:false}]}
];
for(const spec of notProven){
 const result=calculate(spec);
 assert.equal(result.state,'CHUA_DU_DU_LIEU');
 assert.equal(result.revenueVnd,null);
 assert.equal(result.expenseVnd,null);
 assert.equal(result.profitVnd,null);
}
assert.throws(()=>calculate({...base,entries:[entry('x','REVENUE','100'),entry('x','DIRECT_COST','20')]}),/DUPLICATE/);
assert.throws(()=>calculate({...base,entries:[entry('outside','REVENUE','100','2026-09-30')]}),/OUTSIDE_MONTH/);
assert.throws(()=>calculate({...base,entries:[entry('badDate','REVENUE','100','2026-10-32')]}),/INVALID_RECOGNITION_DATE/);
for(const amount of ['-1','1.01','1e3','1,000','10000000000000000']){
 assert.throws(()=>calculate({...base,entries:[entry('bad','DIRECT_COST',amount)]}),/INVALID_VND|OVERFLOW/);
}
assert.throws(()=>calculate({...base,entries:[entry('receipt','CASH_RECEIPT','100')]}),/UNKNOWN_LEDGER_KIND/);
console.log('FINANCE_MONTHLY_RESULT_ARITHMETIC_AND_FAIL_CLOSED_GATE=PASS');
console.log('FINANCE_REAL_LEDGER_PROVENANCE=NOT_PROVEN');
console.log('PRODUCTION_GO_NO_GO=NO_GO');
