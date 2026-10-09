'use strict';
const assert=require('node:assert/strict');
const {validateFinanceDocumentDraft:check}=require('../../api/dist/finance-billing/finance-document-draft-contract.js');
const valid={
 documentId:'CI_DOC',sourceDomain:'SERVICE',sourceEntityType:'INVOICE',
 sourceEntityId:'CI_REF',entryType:'REVENUE',recognitionDate:'2026-09-15',
 amountVnd:'1000000',externalEvidenceDigest:'a'.repeat(64),
 referenceNumber:'CI_REF'
};
let x=check(valid);
assert.equal(x.accepted,true);
assert.equal(x.postingEnabled,false);
for(const patch of [
 {actorId:'DIRECTOR'},{actorRole:'DIRECTOR'},{approvedBy:'DIRECTOR'},
 {documentId:''},{sourceDomain:'bad'},{entryType:'INVALID'},
 {amountVnd:'1.50'},{amountVnd:'-1'},{amountVnd:'9999999999999999999999'},
 {recognitionDate:'2026-02-30'},{externalEvidenceDigest:''},
 {referenceNumber:''}
]){
 const result=check({...valid,...patch});
 assert.equal(result.accepted,false,JSON.stringify(patch));
 assert.equal(result.postingEnabled,false);
}
assert.equal(check(null).accepted,false);
assert.equal(check([]).accepted,false);
console.log('FINANCE_V387_DRAFT_API_CONTRACT_FAIL_CLOSED_PASS');
