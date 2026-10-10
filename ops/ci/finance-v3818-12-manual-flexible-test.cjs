'use strict';
const assert=require('node:assert/strict');
const {assessManualFinanceEntry:review}=require('../../api/dist/finance-billing/finance-v381812-manual-flexible-intake.js');
const base={entryId:'m1',version:'v1',kind:'PAYROLL',amountVnd:'14500000',
recognitionDate:'2026-10-01',category:'AGREED_SALARY',description:'Approved agreed salary for the October period',
counterpartyRef:'staff001',payBasis:'AGREED_AMOUNT',source:'MANUAL',
evidenceType:'SIGNED_AGREEMENT',evidenceDigest:'a'.repeat(64),
approvalDigest:'b'.repeat(64),preparedBy:'maker',reviewedBy:'reviewer',approvedBy:'director',
verifiedEvidence:true,reconciled:true,approved:true,monthOpen:true,financialOriginKey:'salary_staff001_202610'};
function blocked(delta,reason){const y=review({...base,...delta});assert.equal(y.status,'BLOCKED');assert(y.reasons.includes(reason),y.reasons.join(','));assert.equal(y.postingEnabled,false);}
let p=review(base);assert.equal(p.status,'ELIGIBLE_FOR_FUTURE_POSTING_REVIEW');assert.equal(p.postingEnabled,false);
p=review({...base,kind:'OPERATING_EXPENSE',payBasis:'NOT_APPLICABLE',evidenceType:'INTERNAL_VOUCHER',category:'ELECTRICITY'});
assert.equal(p.status,'ELIGIBLE_FOR_FUTURE_POSTING_REVIEW');
p=review({...base,kind:'REVENUE',payBasis:'NOT_APPLICABLE',evidenceType:'INTERNAL_VOUCHER',category:'OTHER_REVENUE'});
assert.equal(p.status,'ELIGIBLE_FOR_FUTURE_POSTING_REVIEW');
blocked({kind:'REVENUE',payBasis:'NOT_APPLICABLE',evidenceType:'RECEIPT_OTHER'},'RECEIPT_IS_NOT_REVENUE');
blocked({approvedBy:'maker'},'SEGREGATION_FAILED');
blocked({approved:false},'APPROVAL_RECONCILIATION_PERIOD_REQUIRED');
blocked({verifiedEvidence:false},'EVIDENCE_NOT_VERIFIED');
blocked({amountVnd:'1.5'},'AMOUNT_INVALID');
blocked({recognitionDate:'2026-02-30'},'DATE_INVALID');
blocked({kind:'PAYROLL',payBasis:'NOT_APPLICABLE'},'PAY_BASIS_REQUIRED');
console.log('TAMANCARE_FINANCE_V3818_12_MANUAL_FLEXIBLE_CI_PASS');
