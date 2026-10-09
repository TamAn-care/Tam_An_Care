'use strict';
const assert=require('node:assert/strict');
const {verifyIndependentMonthlyClose:verify}=
  require('../../api/dist/finance-billing/monthly-close-evidence.js');
const month='2026-10';
const digest='a'.repeat(64);
const evidence={
  month,snapshotDigest:digest,sourceReconciliationDigest:'b'.repeat(64),
  approverId:'CI_APPROVER',approvalId:'CI_APPROVAL',approvedAt:'2026-11-03T10:00:00Z',
  sourceCount:2,entryCount:2,completenessVerified:true,
  reconciliationVerified:true,approvalSignatureVerified:true,
};
assert.deepEqual(verify(month,null,{entryCount:2,snapshotDigest:digest}),
  {verified:false,reasons:['MONTH_CLOSE_EVIDENCE_MISSING']});
assert.equal(verify(month,evidence,{entryCount:2,snapshotDigest:digest}).verified,true);
for(const delta of [
  {month:'2026-09'}, {snapshotDigest:'c'.repeat(64)}, {entryCount:1},
  {completenessVerified:false}, {reconciliationVerified:false},
  {approvalSignatureVerified:false}, {approvalId:''}
]) assert.equal(verify(month,{...evidence,...delta},{entryCount:2,snapshotDigest:digest}).verified,false);
console.log('FINANCE_MONTH_CLOSE_EVIDENCE_PURE_VALIDATOR_PASS');
