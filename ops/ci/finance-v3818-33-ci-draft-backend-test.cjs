'use strict';
const assert=require('node:assert/strict');
const {FinanceCiDraftRepositoryV381833}=require('../../api/dist/finance-billing/finance-v381833-ci-draft-repository.js');
const good={documentId:'d33',originKey:'origin33',kind:'REVENUE',recognitionDate:'2026-10-10',amountVnd:'150000',category:'INTERNAL',description:'Documented internal income',counterpartyRef:'ref33',payBasis:'NOT_APPLICABLE',evidenceType:'INTERNAL_VOUCHER',evidenceDigest:null,reviewerId:'review33',approverId:'director33'};
(async()=>{
 let commits=0,queries=0,rollbacks=0;
 const fake={withTransaction:async callback=>{
  try {const x=await callback({query:async(sql,args)=>{
   queries++;if(sql.includes('current_database'))return{rows:[{db:'finance_ci',user_name:'finance_ci'}]};
   assert.equal(args.length,14);return{rows:[{document_id:'d33'}]};
  }});commits++;return x}catch(e){rollbacks++;throw e;}
 }};
 const repo=new FinanceCiDraftRepositoryV381833(fake);
 const old={NODE_ENV:process.env.NODE_ENV,PGHOST:process.env.PGHOST,PGDATABASE:process.env.PGDATABASE,PGUSER:process.env.PGUSER};
 try{
  process.env.NODE_ENV='production';process.env.PGHOST='127.0.0.1';process.env.PGDATABASE='finance_ci';process.env.PGUSER='finance_ci';
  await assert.rejects(()=>repo.create(good,'sess33'),/V33_CI_ONLY_DENIED/);
  process.env.NODE_ENV='test';
  await assert.rejects(()=>repo.create({...good,amountVnd:'-1'},'sess33'),/V33_INVALID_DRAFT/);
  assert.equal(queries,0);
  const ok=await repo.create(good,'sess33');
  assert.equal(ok.documentId,'d33');assert.equal(ok.postedToLedger,false);assert.equal(commits,1);
  const denied=new FinanceCiDraftRepositoryV381833({withTransaction:async f=>f({query:async()=>({rows:[{db:'taman_care',user_name:'taman'}]})})});
  await assert.rejects(()=>denied.create(good,'sess33'),/V33_DATABASE_IDENTITY_DENIED/);
  assert.equal(rollbacks,0);
  console.log('FINANCE_V381833_CI_TRANSACTION_BACKEND_PASS');
 }finally{for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
})().catch(e=>{console.error(e);process.exitCode=1});
