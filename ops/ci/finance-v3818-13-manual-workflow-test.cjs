'use strict';
const assert=require('node:assert/strict');
const {transitionManualDocument:go}=require('../../api/dist/finance-billing/finance-v381813-manual-workflow.js');
const entry={entryId:'doc1',version:'v1',kind:'PAYROLL',amountVnd:'9000000',
recognitionDate:'2026-10-01',category:'AGREED_SALARY',description:'Approved monthly agreed salary',
counterpartyRef:'staff001',payBasis:'AGREED_AMOUNT',source:'MANUAL',
evidenceType:'SIGNED_AGREEMENT',evidenceDigest:'a'.repeat(64),
approvalDigest:'b'.repeat(64),preparedBy:'maker',reviewedBy:'reviewer',approvedBy:'director',
verifiedEvidence:true,reconciled:true,approved:true,monthOpen:true,financialOriginKey:'salary_staff001_202610'};
let d={revision:0,state:'DRAFT',entry,audit:[]};
const command=(action,actorId,actorRole,extra={})=>({document:d,action,actorId,actorRole,expectedRevision:d.revision,reason:'Approved business justification',originAlreadyClaimed:false,...extra});
let x=go(command('SUBMIT','maker','FINANCE_MAKER'));assert.equal(x.accepted,true);d=x.document;
x=go(command('REVIEW','maker','FINANCE_REVIEWER'));assert.equal(x.accepted,false);
x=go(command('REVIEW','reviewer','FINANCE_REVIEWER',{expectedRevision:0}));assert.equal(x.accepted,false);
x=go(command('REVIEW','reviewer','FINANCE_REVIEWER'));assert.equal(x.accepted,true);d=x.document;
x=go(command('APPROVE','reviewer','DIRECTOR'));assert.equal(x.accepted,false);
x=go(command('APPROVE','director','DIRECTOR',{originAlreadyClaimed:true}));assert.equal(x.accepted,false);
x=go(command('APPROVE','director','FINANCE_MAKER'));assert.equal(x.accepted,false);
x=go(command('APPROVE','director','DIRECTOR'));assert.equal(x.accepted,true);d=x.document;
assert.equal(d.state,'APPROVED');assert.equal(d.revision,3);
assert.deepEqual(d.audit.map(a=>a.action),['SUBMIT','REVIEW','APPROVE']);
assert.equal(x.postingEnabled,false);
x=go(command('APPROVE','director','DIRECTOR'));assert.equal(x.accepted,false);
let rejected={revision:0,state:'DRAFT',entry:{...entry,kind:'OPERATING_EXPENSE',payBasis:'NOT_APPLICABLE',evidenceType:'INTERNAL_VOUCHER'},audit:[]};
const submit=go({...command('SUBMIT','maker','FINANCE_MAKER'),document:rejected});assert.equal(submit.accepted,true);
x=go({...command('REJECT','reviewer','FINANCE_REVIEWER'),document:submit.document});assert.equal(x.accepted,true);assert.equal(x.document.state,'REJECTED');
console.log('TAMANCARE_FINANCE_V3818_13_MANUAL_APPROVAL_CI_PASS');
