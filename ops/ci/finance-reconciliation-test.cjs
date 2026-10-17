'use strict';
const assert = require('node:assert/strict');
const mod = require('../../api/dist/finance-billing/finance-reconciliation.js');
const invoice = {invoiceId:'CI_INVOICE',totalVnd:'100.00',itemLineAmountsVnd:['60','40.00'],allocatedVnd:'20',status:'ISSUED',ledgerRevenueMatches:1,ledgerRevenueVnd:'100',canonicalSourceVerified:true};
const result = mod.reconcileFinanceSnapshots([invoice], []);
assert.equal(result.valid,true);
assert.equal(mod.reconcileFinanceSnapshots([{...invoice,ledgerRevenueMatches:2}],[]).issues[0].code,'DUPLICATE_LEDGER_REVENUE');
assert.equal(mod.reconcileFinanceSnapshots([{...invoice,canonicalSourceVerified:false}],[]).issues[0].code,'REVENUE_SOURCE_UNVERIFIED');
assert.equal(mod.reconcileFinanceSnapshots([{...invoice,itemLineAmountsVnd:['99']}],[]).issues[0].code,'INVOICE_TOTAL_MISMATCH');
// A misspelled or future invoice status must never silently pass when the
// invoice has no revenue row. Status vocabulary follows the canonical SQL.
for (const status of ['ISSUE', 'CANCELLED', '', 'PAID_EXTRA']) {
  const res = mod.reconcileFinanceSnapshots([
    {...invoice,status,ledgerRevenueMatches:0,ledgerRevenueVnd:null}
  ], []);
  assert.equal(res.valid,false, 'unknown status must fail closed: '+status);
  assert.ok(res.issues.some(i=>i.code==='INVOICE_STATUS_UNRECOGNIZED'));
}
for (const status of ['DRAFT','APPROVED','VOID']) {
  const res = mod.reconcileFinanceSnapshots([
    {...invoice,status,ledgerRevenueMatches:0,ledgerRevenueVnd:null}
  ], []);
  assert.equal(res.valid,true,'canonical pre-issue/void status: '+status);
}
for (const bad of [false,null,undefined,'true',1,{},[]]) {
  const res = mod.reconcileFinanceSnapshots([
    {...invoice,canonicalSourceVerified:bad}
  ], []);
  assert.equal(res.valid,false,'unverified source must fail closed');
  assert.ok(res.issues.some(i=>i.code==='REVENUE_SOURCE_UNVERIFIED'));
}
console.log('FINANCE_RECONCILIATION_READ_ONLY_TEST_PASS');
