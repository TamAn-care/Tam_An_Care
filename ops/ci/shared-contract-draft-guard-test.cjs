'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const dist=path.join(__dirname,'../../api/dist');
function locate(folder,name){for(const d of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,d.name);if(d.isDirectory()){const x=locate(p,name);if(x)return x;}else if(d.name===name)return p;}}
const file=locate(dist,'canonical-contract-draft.controller.js');
const identityFile=locate(dist,'verified-finance-identity.js');assert.ok(file);
const orig=Module._load;
Module._load=function(k,parent,main){if(k==='../database/database.service' && parent?.filename===file)return {DatabaseService:class{}};return orig.apply(this,arguments)};
let Controller;try{Controller=require(file).CanonicalContractDraftController;}finally{Module._load=orig;}
const {publishVerifiedFinanceIdentity}=require(identityFile);
const actor={actorId:'CI_ACTOR',actorRole:'ADMIN',sessionId:'CI_SESSION'};
const request=()=>{const r={};publishVerifiedFinanceIdentity(r,actor);return r;};
const payload={contractId:'CI_ID',residentId:'CI_RESIDENT',contractCode:'CI/2026',payload:{appendix:{baseMonthlyFee:100}}};
const written=[];
const client={query:async(sql,args)=>{written.push(sql);if(sql.includes('FROM public.residents'))return {rows:[{resident_id:'CI_RESIDENT'}]};
 if(sql.includes('ORDER BY version DESC'))return {rows:[{version:1,status:'ACTIVE'}]};
 if(sql.includes('FROM public.service_contract_records'))return {rows:[{contract_id:'CI_ID'}]};return {rows:[],rowCount:1};}};
const db={query:async()=>({rows:[{actor_id:actor.actorId}]}),
 withTransaction:async(fn)=>fn(client)};
const controller=new Controller(db);
(async()=>{
 delete process.env.TAMANCARE_CONTRACT_DRAFT_WRITE_ENABLED;
 await assert.rejects(controller.create(request(),payload),e=>e.status===403);
 assert.equal(written.length,0);
 process.env.TAMANCARE_CONTRACT_DRAFT_WRITE_ENABLED='true';
 process.env.TAMANCARE_CONTRACT_DRAFT_WRITE_ROLES='ADMIN';
 await assert.rejects(controller.create({},payload),e=>e.status===403);
 await assert.rejects(controller.create(request(),{...payload,payload:{source:'MOCK'}}),e=>e.status===400);
 assert.equal(written.length,0);
 const result=await controller.create(request(),payload);
 assert.equal(result.status,'DRAFT');assert.equal(result.signed,false);assert.equal(result.approved,false);
 assert.equal(written.filter(q=>q.includes('INSERT INTO')).length,2);
 const amendment={expectedVersion:1,effectiveDate:'2026-11-01',changeReason:'CI signed care upgrade request',payload:{appendix:{totalMonthlyFee:200}}};
 const resultAmend=await controller.proposeAmendment(request(),'CI_ID',amendment);
 assert.equal(resultAmend.version,2);assert.equal(resultAmend.affectsCurrentBilling,false);
 assert.equal(written.filter(q=>q.includes('INSERT INTO')).length,3);
 console.log('SHARED_CONTRACT_DRAFT_DEFAULT_DENY_AND_AMENDMENT_PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
