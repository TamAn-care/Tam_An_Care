'use strict';
const assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path');
const controllerFile=path.resolve(__dirname,'../../api/dist/finance-billing/finance-read.controller.js');
let identity=null;const original=Module._load;
Module._load=function(id,parent,isMain){
 if(id==='@nestjs/common')return new Proxy({}, {get:(_,key)=>{
  if(['Controller','Get','Param','Req'].includes(key))return ()=>()=>{};
  if(['ForbiddenException','BadRequestException','NotFoundException'].includes(key))return class extends Error{constructor(message){super(message);this.status=403;}};
  return ()=>{};
 }});
 if(id==='../database/database.service')return {DatabaseService:class{}};
 if(id==='./monthly-operating-result.service')return {MonthlyOperatingResultService:class{}};
 if(id==='../security/verified-finance-identity')return {readVerifiedFinanceIdentity:()=>identity};
 return original.apply(this,arguments);
};
let Controller;
try{Controller=require(controllerFile).FinanceReadController;}finally{Module._load=original;}
const old={read:process.env.TAMANCARE_FINANCE_READ_ROLES,scope:process.env.TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES};
async function check(role,allowed){
 identity={actorId:'synthetic',actorRole:role,sessionId:'synthetic-session'};
 process.env.TAMANCARE_FINANCE_READ_ROLES='ADMIN,SUPERVISOR,ACCOUNTANT,CARE_MANAGER';
 process.env.TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES='ADMIN,SUPERVISOR,ACCOUNTANT,CARE_MANAGER';
 const db={async query(){return {rows:[{actor_id:identity.actorId,actor_role:identity.actorRole}]};}};
 const pnl={async read(month){return {month};}};
 try{const result=await new Controller(db,pnl).getMonthlyOperatingResult({},'2026-10');assert.equal(allowed,true,role);assert.equal(result.month,'2026-10');}
 catch(error){if(allowed)throw error;assert.equal(error.status,403,role);}
}
(async()=>{try{
 await check('ADMIN',true);await check('SUPERVISOR',true);
 for(const role of ['ACCOUNTANT','CARE_MANAGER','NURSE','CAREGIVER','GUARDIAN'])await check(role,false);
 console.log('TAMANCARE_MONTHLY_PNL_ROLE_BOUNDARY_PASS');
}finally{
 if(old.read===undefined)delete process.env.TAMANCARE_FINANCE_READ_ROLES;else process.env.TAMANCARE_FINANCE_READ_ROLES=old.read;
 if(old.scope===undefined)delete process.env.TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES;else process.env.TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES=old.scope;
}})().catch(e=>{console.error(e);process.exitCode=1;});
