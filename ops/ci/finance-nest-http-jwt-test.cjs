'use strict';
// Actual NestJS HTTP routing with real finance JWT middleware & controller.
// Disposable process, stubbed sessions and writes; no Production Test/database.
require('../../api/node_modules/reflect-metadata');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const ModuleNative=require('node:module');
const {createRequire}=ModuleNative;
const apiRequire=createRequire(path.join(__dirname,'../../api/package.json'));
const {Module}=apiRequire('@nestjs/common');
const {NestFactory}=apiRequire('@nestjs/core');
const dist=path.join(__dirname,'../../api/dist');
function find(name){
 const hits=[];
 function walk(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,x.name);
  if(x.isDirectory())walk(p);else if(x.name===name)hits.push(p);
 }}walk(dist);
 assert.equal(hits.length,1,name);return hits[0];
}
const midFile=find('production-auth.middleware.js');
const controllerFile=find('finance-write.controller.js');
class DatabaseServiceMarker{}
class FinanceBillingServiceMarker{}
const original=ModuleNative._load;
ModuleNative._load=function(name,parent,isMain){
 if(name==='../database/database.service'&&[midFile,controllerFile].includes(parent?.filename))return {DatabaseService:DatabaseServiceMarker};
 if(name==='./finance-billing.service'&&parent?.filename===controllerFile)return {FinanceBillingService:FinanceBillingServiceMarker};
 return original.apply(this,arguments);
};
let Middleware,Controller;
try{
 Middleware=require(midFile).ProductionAuthMiddleware;
 Controller=require(controllerFile).FinanceWriteController;
}finally{ModuleNative._load=original;}
process.env.NODE_ENV='production';
process.env.JWT_SECRET='finance-nest-ci-isolated-secret-longer-than-32-chars';
process.env.TAMANCARE_FINANCE_WRITE_ROLES='ACCOUNTANT';
process.env.TAMANCARE_FINANCE_WRITE_ENABLED='true';
const identity={actorId:'CI_USER',role:'ACCOUNTANT',sessionId:'CI_ACTIVE'};
const db={query:async(sql,values)=>{
 assert.match(sql,/auth_sessions/);
 const [session,actor,role]=values;
 if(session===identity.sessionId&&actor===identity.actorId&&['ACCOUNTANT','CAREGIVER'].includes(role))
  return {rows:[{actor_id:actor,actor_role:role}]};
 return {rows:[]};
}};
let written=0;
const billing={allocatePayment:async input=>{written++;return {allocationId:input.allocationId,replayed:false};}};
class IsolatedModule{}
Module({controllers:[Controller],providers:[
 {provide:DatabaseServiceMarker,useValue:db},
 {provide:FinanceBillingServiceMarker,useValue:billing},
]})(IsolatedModule);
function jwt({role=identity.role,jti=identity.sessionId,exp=Math.floor(Date.now()/1000)+300}={}){
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const head=encode({alg:'HS256',typ:'JWT'});
 const payload=encode({sub:identity.actorId,role,jti,exp});
 const body=head+'.'+payload;
 return body+'.'+crypto.createHmac('sha256',process.env.JWT_SECRET).update(body).digest('base64url');
}
const body={receiptId:'CI_RECEIPT',invoiceId:'CI_INVOICE',allocationId:'CI_ALLOCATION',amountVnd:'100',operationKey:'CI_KEY'};
async function run(){
 const app=await NestFactory.create(IsolatedModule,{logger:false});
 const middleware=new Middleware(db);
 app.use((req,res,next)=>Promise.resolve(middleware.use(req,res,next)).catch(next));
 await app.listen(0,'127.0.0.1');
 const port=app.getHttpServer().address().port;
 const send=async(t,request=body)=>{
  const res=await fetch('http://127.0.0.1:'+port+'/api/finance-write/allocations',{
   method:'POST',headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{})},
   body:JSON.stringify(request),
  });return res.status;
 };
 try{
  assert.equal(await send(null),401);
  assert.equal(await send(jwt({role:'CAREGIVER'})),403);
  assert.equal(await send(jwt({jti:'CI_REVOKED'})),401);
  assert.equal(await send(jwt({exp:1})),401);
  assert.equal(await send(jwt(),{...body,actorId:'FORGED'}),400);
  assert.equal(written,0);
  assert.equal(await send(jwt()),201);
  assert.equal(written,1);
  console.log('FINANCE_NEST_HTTP_JWT_ROUTING_PASS');
 }finally{await app.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1});
