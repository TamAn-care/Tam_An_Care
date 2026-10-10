'use strict';
/**
 * V68 static provenance inventory — GitHub isolated runner ONLY.
 * Presence of source files does NOT establish live DB provenance.
 */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const mandatory=[
 ['invoices',['api/src/finance-billing/contract-invoice-basis.ts','api/src/finance-billing/finance-billing.service.ts']],
 ['careFees',['api/src/finance-billing/finance-v3818-monthly-recognition-contract.ts']],
 ['leaveAdjustments',['api/src/finance-billing/finance-v3818-monthly-recognition-contract.ts']],
 ['inventoryConsumption',['api/src/finance-billing/finance-v38186-real-source-adapter-contract.ts']],
 ['payroll',['api/src/finance-billing/finance-v381814-payroll-calculator.ts']],
 ['manualVouchers',['api/src/finance-billing/finance-v381813-manual-workflow.ts']],
 ['otherExpenses',['api/src/finance-billing/finance-v38186-real-source-adapter-contract.ts']]
];
const results=mandatory.map(([source,candidates])=>({
 source,
 sourceCandidates:candidates.map(p=>({path:p,sourceFilePresent:fs.existsSync(p)})),
 sourceLocatedInLiveRuntime:'NOT_PROVEN',
 actualTableAndColumnMapping:'NOT_PROVEN',
 readOnlyApprovedRowsReconciled:'NOT_PROVEN',
 monthlyPeriodComplete:'NOT_PROVEN',
 approvedPayrollAndPostings:'NOT_PROVEN',
 outcome:'BLOCK_RELEASE'
}));
assert.equal(results.length,7);
assert.equal(new Set(results.map(r=>r.source)).size,7);
for(const r of results)assert(r.sourceCandidates.every(c=>c.sourceFilePresent),'missing source candidate: '+r.source);
const report={
 gate:'TAMANCARE_FINANCE_V381868_STATIC_SOURCE_INVENTORY',
 scope:'GITHUB_ISOLATED_CI',
 sourceCommit:process.env.GITHUB_SHA||'UNSPECIFIED',
 liveServerConnected:false,liveDatabaseConnected:false,
 sourceCandidatesAreNotProductionProof:true,
 sourceInventory:results,
 runtimeSourceParity:'NOT_PROVEN',
 financeOperationalReady:false,
 monthlyProfitVnd:null,
 monthlyProfitState:'CHUA_DU_DU_LIEU',
 databaseWrite:false,migration:false,seed:false,deploy:false
};
const dest=process.env.V68_REPORT_PATH;
if(dest){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');}
console.log('V68_SOURCE_CANDIDATES='+results.length);
console.log('V68_STATIC_SOURCE_CATALOG=PASS');
console.log('V68_PRODUCTION_REAL_SOURCE_PROVENANCE=NOT_PROVEN');
console.log('V68_RUNTIME_SOURCE_PARITY=NOT_PROVEN');
console.log('V68_RELEASE_READY=NO');
console.log('RESULT=TAMANCARE_FINANCE_V381868_ISOLATED_STATIC_INVENTORY_PASS');
