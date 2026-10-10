'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const p=path.resolve(__dirname,'../../api/dist/finance-billing/finance-v381817-manual-http-boundary.service.js');
const {FinanceManualHttpCommandService}=require(p);
const src=fs.readFileSync(path.resolve(__dirname,'../../api/src/finance-billing/finance-v381817-manual-http-boundary.service.ts'),'utf8');
assert(!/@Controller\(|@Post\(|@Patch\(|@Put\(|@Delete\(/.test(src));
assert(!/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bCREATE\b/i.test(src.replace(/\/\*[\s\S]*?\*\//g,'')));
assert.equal(typeof FinanceManualHttpCommandService,'function');
const service=new FinanceManualHttpCommandService({query:async()=>{throw Error('DATABASE_SHOULD_NOT_BE_TOUCHED')}});
(async()=>{
 for(const body of [{action:'APPROVE',expectedRevision:0,reason:'Accept request',actorRole:'DIRECTOR'},{action:'UNKNOWN',expectedRevision:0,reason:'Reason'},{}]){
  await assert.rejects(()=>service.preview({},null,body));
 }
 console.log('FINANCE_V3818_17_HTTP_SHAPED_AUTH_BOUNDARY_CI_PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
