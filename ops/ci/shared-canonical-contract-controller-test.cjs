'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {createRequire}=Module;const apiRequire=createRequire(path.join(__dirname,'../../api/package.json'));
const {PATH_METADATA,METHOD_METADATA}=apiRequire('@nestjs/common/constants');
const dist=path.join(__dirname,'../../api/dist');
function locate(dir,name){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory()){const x=locate(p,name);if(x)return x;}else if(item.name===name)return p;}}
const file=locate(dist,'canonical-service-contracts.controller.js');
assert.ok(file);
const identityFile=locate(dist,'verified-finance-identity.js');
const load=Module._load;Module._load=function(id,parent,isMain){
 if(id==='../database/database.service' && parent?.filename===file)return {DatabaseService:class{}};
 return load.apply(this,arguments);
};let Controller;
try{Controller=require(file).CanonicalServiceContractsController;}finally{Module._load=load;}
const {publishVerifiedFinanceIdentity}=require(identityFile);
process.env.TAMANCARE_CONTRACT_READ_ROLES='ACCOUNTANT';
const auth={actorId:'CI_ACTOR',actorRole:'ACCOUNTANT',sessionId:'CI_SESSION'};
const calls=[];const db={query:async(sql,args)=>{calls.push(sql);if(sql.includes('auth_sessions'))return {rows:[{actor_id:auth.actorId}]};
 if(sql.includes('WHERE c.contract_id'))return {rows:[{contract_id:'CI_CONTRACT',contract_code:'CI_CODE',resident_id:'CI_RESIDENT',status:'ACTIVE',effective_date:'2026-10-01',version:1,payload:{appendix:{baseMonthlyFee:100}},created_at:'2026-10-01',updated_at:'2026-10-01'}]};
 return {rows:[]};}};
const ctl=new Controller(db);
function req(role='ACCOUNTANT'){const r={};publishVerifiedFinanceIdentity(r,{...auth,actorRole:role});return r;}
async function main(){
 assert.equal(Reflect.getMetadata(PATH_METADATA,Controller),'api/service-contracts');
 assert.equal(Reflect.getMetadata(PATH_METADATA,Controller.prototype.list),'/');
 assert.equal(Reflect.getMetadata(PATH_METADATA,Controller.prototype.get),':contractId');
 assert.equal(Reflect.getMetadata(METHOD_METADATA,Controller.prototype.list),0);
 assert.equal(Reflect.getMetadata(METHOD_METADATA,Controller.prototype.get),0);
 await assert.rejects(ctl.list({}),e=>e.status===403);
 await assert.rejects(ctl.list(req('CAREGIVER')),e=>e.status===403);
 const v=await ctl.get(req(),'CI_CONTRACT');
 assert.equal(v.source,'VERIFIED_SERVER');assert.equal(v.residentId,'CI_RESIDENT');
 await assert.rejects(ctl.get(req(),'bad/id'),e=>e.status===400);
 assert.ok(calls.every(sql=>/^SELECT\s/i.test(sql.trim())),'READ ONLY');
 assert.ok(!JSON.stringify(v).includes('mock'),'NO MOCK');
 console.log('SHARED_CANONICAL_CONTRACT_READ_RBAC_PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
