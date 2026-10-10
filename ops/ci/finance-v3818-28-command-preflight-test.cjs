'use strict';
const assert=require('node:assert/strict');
const {FinanceManualCommandPreflightV381828}=require('../../api/dist/finance-billing/finance-v381828-command-preflight.service.js');
const {publishVerifiedFinanceIdentity}=require('../../api/dist/security/verified-finance-identity.js');
const entry={entryId:'doc1',version:'v1',kind:'PAYROLL',amountVnd:'9000000',recognitionDate:'2026-10-01',category:'AGREED_SALARY',description:'October agreed salary',counterpartyRef:'staff1',payBasis:'AGREED_AMOUNT',source:'MANUAL',evidenceType:'SIGNED_AGREEMENT',evidenceDigest:'a'.repeat(64),approvalDigest:'b'.repeat(64),preparedBy:'maker',reviewedBy:'reviewer',approvedBy:'director',verifiedEvidence:true,reconciled:true,approved:true,monthOpen:true,financialOriginKey:'origin1'};
const document={revision:0,state:'DRAFT',entry,audit:[]};
const input={action:'SUBMIT',expectedRevision:0,reason:'Submit for reviewer'};
(async()=>{
 let reads=0;
 const service=new FinanceManualCommandPreflightV381828({query:async(_sql,params)=>{
 reads++;return{rows:[{actor_id:params[1],actor_role:params[2]}]};}});
 await assert.rejects(()=>service.inspect({},input,document,false),/VERIFIED_SESSION_REQUIRED/);
 assert.equal(reads,0);
 const req={};publishVerifiedFinanceIdentity(req,{actorId:'maker',actorRole:'FINANCE_MAKER',sessionId:'sess1'});
 await assert.rejects(()=>service.inspect(req,{...input,actorRole:'DIRECTOR'},document,false),/INVALID_COMMAND_FIELDS/);
 await assert.rejects(()=>service.inspect(req,input,null,false),/SERVER_DOCUMENT_OR_ORIGIN_UNVERIFIED/);
 await assert.rejects(()=>service.inspect(req,input,document,true),/SERVER_DOCUMENT_OR_ORIGIN_UNVERIFIED/);
 const result=await service.inspect(req,input,document,false);
 assert.equal(result.status,'CANDIDATE_ONLY');assert.equal(result.postingEnabled,false);assert.equal(result.databaseWriteEnabled,false);
 const expired=new FinanceManualCommandPreflightV381828({query:async()=>({rows:[]})});
 await assert.rejects(()=>expired.inspect(req,input,document,false),/SESSION_INACTIVE/);
 assert.equal((await service.inspect(req,{...input,expectedRevision:1},document,false)).status,'DENIED');
 console.log('FINANCE_V381828_COMMAND_PREFLIGHT_CI_PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
