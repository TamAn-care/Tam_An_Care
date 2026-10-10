'use strict';
const assert=require('node:assert/strict');
const {calculateV38MonthlyClose:run}=require('../../api/dist/finance-billing/finance-v381838-month-close-gate.js');
const evidence={invoices:true,careFees:true,leaveAdjustments:true,inventoryConsumption:true,payroll:true,manualVouchers:true,otherExpenses:true,unpostedApprovedCount:0,duplicateOriginCount:0,unlinkedSourceCount:0};
const entries=[{entryId:'rev38',kind:'REVENUE',recognitionDate:'2026-09-01',amountVnd:'1000000',posted:true,sourceVerified:true},{entryId:'exp38',kind:'EXPENSE',recognitionDate:'2026-09-29',amountVnd:'650000',posted:true,sourceVerified:true}];
const good=run('2026-09',entries,evidence);
assert.equal(good.state,'READY');assert.equal(good.profitVnd,'350000');assert.equal(good.operationalReleaseReady,false);
for(const key of ['invoices','careFees','leaveAdjustments','inventoryConsumption','payroll','manualVouchers','otherExpenses']){
 const result=run('2026-09',entries,{...evidence,[key]:false});
 assert.equal(result.state,'CHUA_DU_DU_LIEU');assert.equal(result.profitVnd,null);
}
for(const key of ['unpostedApprovedCount','duplicateOriginCount','unlinkedSourceCount']){
 const result=run('2026-09',entries,{...evidence,[key]:1});
 assert.equal(result.state,'CHUA_DU_DU_LIEU');assert.equal(result.revenueVnd,null);
}
assert.equal(run('2026-09',[{...entries[0],posted:false},entries[1]],evidence).state,'CHUA_DU_DU_LIEU');
assert.equal(run('2026-09',entries,{...evidence,unpostedApprovedCount:-1}).state,'CHUA_DU_DU_LIEU');
assert.equal(run('2026-09',entries,{...evidence,payroll:undefined}).state,'CHUA_DU_DU_LIEU');
assert.equal(run('2026-09',entries,null).state,'CHUA_DU_DU_LIEU');
console.log('FINANCE_V381838_MONTH_CLOSE_COVERAGE_FAIL_CLOSED_PASS');
