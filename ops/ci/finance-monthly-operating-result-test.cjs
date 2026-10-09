'use strict';
const assert = require('node:assert/strict');
const {calculateMonthlyOperatingResult: calc} =
  require('../../api/dist/finance-billing/monthly-operating-result.js');
const base = {month:'2026-10',ledgerCoverageComplete:true,reconciliationComplete:true};
const entry = (entryId,kind,amountVnd) => ({
  entryId,kind,amountVnd,recognitionDate:'2026-10-08',
  posted:true,sourceVerified:true,
});
const ready=calc({...base,entries:[entry('r1','REVENUE','12000000.00'),entry('e1','EXPENSE','14000000')]});
assert.equal(ready.state,'READY');
assert.equal(ready.profitVnd,'-2000000');
assert.equal(ready.revenueVnd,'12000000');
assert.equal(ready.expenseVnd,'14000000');
assert.equal(calc({...base,reconciliationComplete:false,entries:[entry('r1','REVENUE','100')]}).profitVnd,null);
assert.equal(calc({...base,ledgerCoverageComplete:false,entries:[]}).state,'CHUA_DU_DU_LIEU');
assert.equal(calc({...base,entries:[{...entry('r1','REVENUE','100'),sourceVerified:false}]}).profitVnd,null);
assert.throws(()=>calc({...base,entries:[entry('r1','REVENUE','1'),entry('r1','EXPENSE','1')]}),/DUPLICATE/);
assert.throws(()=>calc({...base,entries:[{...entry('r1','REVENUE','1'),recognitionDate:'2026-09-30'}]}),/OUTSIDE_MONTH/);
assert.throws(()=>calc({...base,entries:[entry('r1','REVENUE','1.50')]}),/INVALID_VND/);
assert.throws(()=>calc({...base,entries:[entry('r1','CASH_RECEIPT','1')]}),/UNKNOWN_LEDGER_KIND/);
console.log('TAMANCARE_MONTHLY_RESULT_PURE_ENGINE_PASS');
