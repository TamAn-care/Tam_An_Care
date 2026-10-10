'use strict';
const assert=require('node:assert/strict');
const {assessAuthenticatedManualCommand:command,assessNewManualDraft:draft}=require('../../api/dist/finance-billing/finance-v381816-authenticated-manual-boundary.js');
const entry={entryId:'d1',version:'v1',kind:'PAYROLL',amountVnd:'9000000',recognitionDate:'2026-10-01',
 category:'AGREED_SALARY',description:'Salary approved per agreement',counterpartyRef:'staff1',payBasis:'AGREED_AMOUNT',
 source:'MANUAL',evidenceType:'SIGNED_AGREEMENT',evidenceDigest:'a'.repeat(64),approvalDigest:'b'.repeat(64),
 preparedBy:'maker',reviewedBy:'reviewer',approvedBy:'director',verifiedEvidence:true,reconciled:true,
 approved:true,monthOpen:true,financialOriginKey:'salary_staff1_202610'};
const verified=(actorId,actorRole)=>({actorId,actorRole,sessionId:'session1',verifiedFromServer:true});
const doc={revision:0,state:'DRAFT',entry,audit:[]};
assert.equal(draft(entry,verified('maker','FINANCE_MAKER')).status,'DRAFT_CANDIDATE');
assert.equal(draft(entry,verified('other','FINANCE_MAKER')).status,'DENIED');
assert.equal(draft(entry,{...verified('maker','FINANCE_MAKER'),verifiedFromServer:false}).status,'DENIED');
const input={action:'SUBMIT',expectedRevision:0,reason:'Submit agreed payroll'};
assert.equal(command(null,input,doc,false).status,'DENIED');
assert.equal(command(verified('maker','FINANCE_MAKER'),{...input,actorRole:'DIRECTOR'},doc,false).status,'DENIED');
assert.equal(command(verified('maker','FINANCE_MAKER'),{...input,expectedRevision:1},doc,false).status,'DENIED');
assert.equal(command(verified('maker','FINANCE_MAKER'),input,doc,true).status,'DENIED');
const ok=command(verified('maker','FINANCE_MAKER'),input,doc,false);
assert.equal(ok.status,'CANDIDATE_ONLY');assert.equal(ok.transition.document.state,'SUBMITTED');
assert.equal(ok.databaseWriteEnabled,false);assert.equal(ok.postingEnabled,false);
assert.equal(command(verified('maker','FINANCE_MAKER'),input,doc,false).status,'CANDIDATE_ONLY');
assert.equal(command(verified('reviewer','FINANCE_REVIEWER'),{action:'REVIEW',expectedRevision:1,reason:'Independent reviewer passed'},ok.transition.document,false).status,'CANDIDATE_ONLY');
console.log('TAMANCARE_FINANCE_V3818_16_AUTHENTICATED_COMMAND_BOUNDARY_PASS');
