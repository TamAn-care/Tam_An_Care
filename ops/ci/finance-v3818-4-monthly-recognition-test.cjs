'use strict';
const assert=require('node:assert/strict');
const {assessMonthlyRecognition:assess}=require('../../api/dist/finance-billing/finance-v3818-monthly-recognition-contract.js');
const good={
 sourceDomain:'BILLING',sourceEntityType:'INVOICE',sourceEntityId:'invoice001',
 entryType:'REVENUE',recognitionDate:'2026-09-30',amountVnd:'14500000',
 documentStatus:'APPROVED',sourceEvidence:'VERIFIED',
 approvalEvidence:'VERIFIED',reconciliationEvidence:'VERIFIED',sourceKind:'INVOICE'
};
function check(input,expectReason){
 const r=assess(input);
 assert.equal(r.eligibleForFuturePosting,false,'never authorize writes');
 assert(r.reasons.includes(expectReason),expectReason+':'+r.reasons.join(','));
 return r;
}
const clean=check(good,'PERSISTENCE_AND_MONTH_CLOSE_UNVERIFIED');
assert.equal(clean.recognitionMonth,'2026-09');
check({...good,sourceKind:'RECEIPT'},'NON_RECOGNITION_SOURCE');
check({...good,sourceKind:'PAYMENT_ALLOCATION'},'NON_RECOGNITION_SOURCE');
check({...good,sourceKind:'CONTRACT'},'NON_RECOGNITION_SOURCE');
check({...good,sourceKind:'COST_DOCUMENT'},'COST_CATEGORY_MISMATCH');
check({...good,sourceKind:'PAYROLL_DOCUMENT'},'PAYROLL_CATEGORY_MISMATCH');
check({...good,documentStatus:'DRAFT'},'DOCUMENT_NOT_APPROVED');
check({...good,sourceEvidence:'UNVERIFIED'},'SOURCE_UNVERIFIED');
check({...good,approvalEvidence:'UNVERIFIED'},'APPROVAL_UNVERIFIED');
check({...good,reconciliationEvidence:'UNVERIFIED'},'RECONCILIATION_UNVERIFIED');
check({...good,recognitionDate:'2026-02-30'},'RECOGNITION_DATE_INVALID');
check({...good,amountVnd:'1.5'},'AMOUNT_INVALID');
check({...good,sourceEntityId:''},'SOURCE_IDENTITY_INVALID');
check(null,'INVALID_SOURCE');
console.log('TAMANCARE_FINANCE_V3818_4_MONTHLY_RECOGNITION_CONTRACT_PASS');
