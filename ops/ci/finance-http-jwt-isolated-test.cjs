'use strict';
// Isolated HTTP/JWT security smoke test: runs real middleware/controller methods,
// WITHOUT production DB, network or an application-wide Nest routing stack.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Module=require('node:module');
const dist=path.join(__dirname,'../../api/dist');
function locate(filename){
 const found=[];
 function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,d.name);if(d.isDirectory())walk(p);
   else if(d.name===filename)found.push(p);
 }}walk(dist);assert.equal(found.length,1,'unique '+filename);return found[0];
}
const middlewareFile=locate('production-auth.middleware.js');
const controllerFile=locate('finance-write.controller.js');
const load=Module._load;
Module._load=function(id,parent,isMain){
 if(id==='../database/database.service' && parent &&
    [middlewareFile,controllerFile].includes(parent.filename)) return {DatabaseService:class{}};
 if(id==='./finance-billing.service' && parent?.filename===controllerFile)
    return {FinanceBillingService:class{}};
 return load.apply(this,arguments);
};
let Middleware,Controller;
try{
 Middleware=require(middlewareFile).ProductionAuthMiddleware;
 Controller=require(controllerFile).FinanceWriteController;
}finally{Module._load=load;}
process.env.NODE_ENV='production';
process.env.JWT_SECRET='finance-ci-secret-1234567890-long-enough-32chars';
process.env.TAMANCARE_FINANCE_WRITE_ROLES='ACCOUNTANT';
process.env.TAMANCARE_FINANCE_WRITE_ENABLED='true';
const identity={actorId:'CI_ACTOR',actorRole:'ACCOUNTANT',sessionId:'CI_SESSION'};
const db={query:async(sql,args)=>{
 assert.match(sql,/auth_sessions/);
 if(args[0]===identity.sessionId && args[1]===identity.actorId &&
    ['ACCOUNTANT','CAREGIVER'].includes(args[2]))
   return {rows:[{actor_id:identity.actorId,actor_role:args[2]}]};
 return {rows:[]};
}};
let writes=0;
const billing={allocatePayment:async(input)=>{writes++;assert.equal(input.actorId,identity.actorId);return {allocationId:input.allocationId,replayed:false};}};
const auth=new Middleware(db);
const controller=new Controller(db,billing);
function token({sub=identity.actorId,role='ACCOUNTANT',jti=identity.sessionId,exp=Math.floor(Date.now()/1000)+300}={}){
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const data=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub,role,jti,exp});
 return data+'.'+crypto.createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url');
}
const requestBody={receiptId:'CI_RECEIPT',invoiceId:'CI_INVOICE',allocationId:'CI_ALLOCATION',amountVnd:'100',operationKey:'CI_OP'};
const server=http.createServer(async(req,res)=>{
 const parts=[];
 for await(const part of req)parts.push(part);
 const received=Buffer.concat(parts).toString();
 const request={originalUrl:req.url,headers:{...req.headers},header(k){return this.headers[k];}};
 try{
  let next=false;
  await auth.use(request,{},()=>{next=true;});
  if(!next)throw Error('MIDDLEWARE_NOT_CONTINUED');
  const result=await controller.allocate(request,JSON.parse(received));
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify(result));
 }catch(e){
  const status=typeof e.getStatus==='function'?e.getStatus():500;
  res.writeHead(status,{'content-type':'application/json'});
  res.end(JSON.stringify({code:status,message:String(e.message)}));
 }
});
async function main(){
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const port=server.address().port;
 async function send(jwt,body=requestBody){
  const response=await fetch('http://127.0.0.1:'+port+'/api/finance-write/allocations',{
   method:'POST',headers:{'content-type':'application/json',...(jwt?{authorization:'Bearer '+jwt}:{})},
   body:JSON.stringify(body),
  });
  return {status:response.status,json:await response.json()};
 }
 try{
  assert.equal((await send(null)).status,401);
  assert.equal((await send(token({role:'CAREGIVER'}))).status,403);
  assert.equal((await send(token({jti:'CI_REVOKED'}))).status,401);
  assert.equal((await send(token({exp:1}))).status,401);
  const invalid=token().slice(0,-4)+'abcd';
  assert.equal((await send(invalid)).status,401);
  assert.equal((await send(token(),{...requestBody,actorId:'spoof'})).status,400);
  assert.equal(writes,0);
  assert.equal((await send(token())).status,200);
  assert.equal(writes,1);
  console.log('FINANCE_HTTP_JWT_ISOLATED_SMOKE_PASS');
 }finally{await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
