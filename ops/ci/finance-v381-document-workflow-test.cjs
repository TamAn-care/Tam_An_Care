'use strict';
const assert=require('node:assert/strict');
const {applyFinanceDocumentTransition:run}=require('../../api/dist/finance-billing/finance-document-workflow.js');
const candidate={
 sourceMode:'SYSTEM',sourceDomain:'SERVICE',sourceEntityType:'INVOICE',
 sourceEntityId:'SOURCE_REF',entryType:'REVENUE',recognitionDate:'2026-09-15',
 amountVnd:'1000000',referenceNumber:'SOURCE_REF',
 preparedBy:'MAKER',reviewedBy:'CHECKER',approvedBy:'DIRECTOR',
 externalEvidenceDigest:'a'.repeat(64),approvalEvidenceDigest:'b'.repeat(64),
 sourceReconciled:true,ledgerMonthOpen:true
};
let d={documentId:'DOC1',revision:0,state:'DRAFT',preparedBy:'MAKER',
 reviewedBy:null,approvedBy:null,candidate,audit:[]};
const act=(action,actorId,other={})=>run({
 document:d,action,actorId,reason:'Checked evidence reference',
 expectedRevision:d.revision,sourceKeyAlreadyUsed:false,...other
});
let x=act('APPROVE','DIRECTOR');
assert.equal(x.accepted,false);
assert.equal(x.postingEnabled,false);
x=act('SUBMIT','DIRECTOR');
assert.equal(x.accepted,false);
x=act('SUBMIT','MAKER');assert.equal(x.accepted,true);d=x.document;
assert.equal(d.state,'SUBMITTED');
x=act('REVIEW','MAKER');assert.equal(x.accepted,false);
x=act('REVIEW','CHECKER',{expectedRevision:0});assert.equal(x.accepted,false);
x=act('REVIEW','CHECKER',{sourceKeyAlreadyUsed:true});assert.equal(x.accepted,false);
x=act('REVIEW','CHECKER');assert.equal(x.accepted,true);d=x.document;
x=act('APPROVE','CHECKER');assert.equal(x.accepted,false);
x=act('APPROVE','DIRECTOR');assert.equal(x.accepted,true);
assert.equal(x.document.state,'APPROVED');
assert.equal(x.document.audit.length,3);
assert.equal(x.document.revision,3);
assert.equal(x.postingEnabled,false);
d=x.document;
assert.equal(act('APPROVE','DIRECTOR').accepted,false);
assert.equal(act('REJECT','DIRECTOR').accepted,false);
const forged={...d,revision:5};
assert.equal(act('APPROVE','DIRECTOR',{document:forged}).accepted,false);
console.log('FINANCE_V381_DOCUMENT_WORKFLOW_ISOLATED_PASS');
