'use strict';
/**
 * V67 release-gap evidence; fail-closed, no live database and no synthetic ledger.
 * These are the seven source contracts required by the V39 monthly-close gate.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {assessV39}=require('../../api/dist/finance-billing/finance-v381839-verified-source-evidence.js');
const mandatory=[
 ['invoices','Hợp đồng, hóa đơn, kỳ ghi nhận doanh thu'],
 ['careFees','Phí chăm sóc, điều chỉnh dịch vụ'],
 ['leaveAdjustments','Điều chỉnh tiền ăn khi vắng mặt'],
 ['inventoryConsumption','Xuất kho tiêu dùng và đơn giá thực tế'],
 ['payroll','Bảng lương và khoản phải trả được duyệt'],
 ['manualVouchers','Chứng từ điều chỉnh được duyệt'],
 ['otherExpenses','Chi phí vận hành, phân bổ và chứng từ nguồn']
];
const month='2026-10';
const out=assessV39(month,[],null,null);
assert.equal(out.state,'CHUA_DU_DU_LIEU');
assert.equal(out.profitVnd,null);
assert.equal(out.operationalReleaseReady,false);
const names=mandatory.map(([key])=>key);
assert.equal(new Set(names).size,7);
const rows=mandatory.map(([source,description])=>({
 source,description,
 sourceLocatedInProduction:'NOT_PROVEN',
 approvedMonthlyRows:'NOT_PROVEN',
 ledgerReconciliation:'NOT_PROVEN',
 periodCompleteness:'NOT_PROVEN',
 disposition:'BLOCK_RELEASE_PENDING_REAL_SOURCE_PROOF'
}));
const report={
 gate:'TAMANCARE_FINANCE_V381867_REAL_SOURCE_READINESS_GAP',
 month,scope:'ISOLATED_GITHUB_CI',
 provenance:'V53/V54 source-catalog findings and V66 fail-closed contract',
 operationalFiguresUsed:false,
 realProductionQueryExecuted:false,
 missingEvidence:rows,
 calculatedStatus:out.state,
 calculatedProfitVnd:out.profitVnd,
 financeOperationalReady:false,
 runtimeSourceParity:'NOT_PROVEN',
 deploy:'NO',migration:'NO',seed:'NO'
};
const dest=process.env.V67_REPORT_PATH;
if(dest){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');}
console.log('V67_CANONICAL_SOURCES='+rows.length);
console.log('V67_MONTHLY_PROFIT_STATE='+out.state);
console.log('V67_REAL_BUSINESS_EVIDENCE=NOT_PROVEN');
console.log('V67_RELEASE_READY=NO');
console.log('RESULT=TAMANCARE_FINANCE_V381867_RELEASE_GAP_PASS');
