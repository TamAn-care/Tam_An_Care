'use strict';
const assert=require('node:assert/strict');
const {reviewFinanceSourceForFuturePosting:review}=
 require('../../api/dist/finance-billing/finance-source-intake.js');
const good={
 sourceMode:'SYSTEM',sourceDomain:'SERVICE',sourceEntityType:'INVOICE',
 sourceEntityId:'REAL_SOURCE_REFERENCE',entryType:'REVENUE',
 recognitionDate:'2026-09-15',amountVnd:'1000000',
 referenceNumber:'REAL_REF',preparedBy:'PREPARER',reviewedBy:'REVIEWER',
 approvedBy:'APPROVER',externalEvidenceDigest:'a'.repeat(64),
 approvalEvidenceDigest:'b'.repeat(64),sourceReconciled:true,ledgerMonthOpen:true
};
const pass=review(good);
assert.equal(pass.eligibleForFuturePosting,true);
assert.equal(pass.postingEnabled,false,'intake never enables a database write');
for(const patch of [
 {amountVnd:'1.25'},{entryType:'EXPENSE'},{recognitionDate:'2026-02-30'},
 {sourceEntityId:''},{sourceReconciled:false},{ledgerMonthOpen:false},
 {reviewedBy:'PREPARER'},{externalEvidenceDigest:''}
]){
 const out=review({...good,...patch});
 assert.equal(out.eligibleForFuturePosting,false,JSON.stringify(patch));
 assert.equal(out.postingEnabled,false);
}
assert.equal(review(null).eligibleForFuturePosting,false);
console.log('FINANCE_V38_SOURCE_INTAKE_FAIL_CLOSED_PASS');
