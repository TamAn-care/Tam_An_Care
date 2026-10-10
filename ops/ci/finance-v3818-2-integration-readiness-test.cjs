'use strict';
/* V3.8.18.2: isolated, no-write integration readiness.
   This file never accesses a running server. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('api/src/app.module.ts');
const components=[
 ['FinanceReadController','api/src/finance-billing/finance-read.controller.ts'],
 ['FinanceWriteController','api/src/finance-billing/finance-write.controller.ts'],
 ['FinanceBillingService','api/src/finance-billing/finance-billing.service.ts'],
 ['MonthlyOperatingResultService','api/src/finance-billing/monthly-operating-result.service.ts']
];
for(const [name,file] of components){
 assert(app.includes(name),'APP_MODULE_MISSING_'+name);
 assert(fs.existsSync(path.join(root,file)),'SOURCE_MISSING_'+file);
}
const readController=read('api/src/finance-billing/finance-read.controller.ts');
assert(readController.includes("operating-result/month/:month"));
assert(readController.includes('FINANCE_VERIFIED_IDENTITY_REQUIRED'));
const writeController=read('api/src/finance-billing/finance-write.controller.ts');
assert(writeController.includes("TAMANCARE_FINANCE_WRITE_ENABLED !== 'true'"));
const service=read('api/src/finance-billing/monthly-operating-result.service.ts');
assert(service.includes('verifyIndependentMonthlyClose'));
assert(service.includes('sourceVerified: false'));
const panel=read('frontend/src/features/finance/MonthlyOperatingResultPanel.tsx');
assert(panel.includes('CHƯA ĐỦ DỮ LIỆU'));
const legacy=read('frontend/src/api/billing.ts');
assert(legacy.includes('mockInvoices'));
assert(legacy.includes('FINANCE_INVOICE_LIST_API_NOT_READY'));
console.log('FINANCE_V3818_2_SOURCE_COMPONENTS=FOUND');
console.log('FINANCE_V3818_2_RUNTIME_IMAGE_MATCH=UNVERIFIED');
console.log('FINANCE_V3818_2_REAL_REVENUE_EXPENSE_COVERAGE=UNVERIFIED');
console.log('FINANCE_V3818_2_ISOLATED_RESTORE=UNVERIFIED');
console.log('FINANCE_V3818_2_DEPLOY_READY=NO');
console.log('FINANCE_V3818_2_NO_DB_WRITE_NO_SEED_NO_DEPLOY=YES');
console.log('RESULT=TAMANCARE_FINANCE_V3818_2_ISOLATED_SOURCE_GATE_PASS');
