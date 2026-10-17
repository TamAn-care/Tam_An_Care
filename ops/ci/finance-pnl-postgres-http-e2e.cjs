'use strict';
// Full Finance P&L HTTP path in production mode with signed JWT, active DB
// sessions, and PostgreSQL 16. Fixtures live only in the disposable CI DB.
require('../../api/node_modules/reflect-metadata');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const Native=require('node:module');
const root=path.resolve(__dirname,'../..');
const requireApi=Native.createRequire(path.join(root,'api/package.json'));
const {Pool}=requireApi('pg');
const {Module}=requireApi('@nestjs/common');
const {NestFactory}=requireApi('@nestjs/core');
const dist=path.join(root,'api/dist');

function find(name){
  const hits=[];
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const filename=path.join(dir,entry.name);
      if(entry.isDirectory())walk(filename);
      else if(entry.name===name)hits.push(filename);
    }
  }
  walk(dist);
  assert.equal(hits.length,1,'compiled artifact '+name);
  return hits[0];
}

const controllerFile=find('finance-read.controller.js');
const serviceFile=find('monthly-operating-result.service.js');
const middlewareFile=find('production-auth.middleware.js');
class DatabaseServiceMarker{}
const originalLoad=Native._load;
Native._load=function(request,parent,isMain){
  if(request==='../database/database.service' &&
    [controllerFile,serviceFile,middlewareFile].includes(parent?.filename))
    return {DatabaseService:DatabaseServiceMarker};
  return originalLoad.apply(this,arguments);
};
let FinanceReadController,MonthlyOperatingResultService,ProductionAuthMiddleware;
try{
  FinanceReadController=require(controllerFile).FinanceReadController;
  MonthlyOperatingResultService=require(serviceFile).MonthlyOperatingResultService;
  ProductionAuthMiddleware=require(middlewareFile).ProductionAuthMiddleware;
}finally{
  Native._load=originalLoad;
}

process.env.NODE_ENV='production';
process.env.JWT_SECRET='isolated-finance-pnl-http-e2e-secret-2026';
process.env.TAMANCARE_FINANCE_READ_ROLES='ADMIN,SUPERVISOR';
process.env.TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES='ADMIN,SUPERVISOR';
const pool=new Pool({
  host:process.env.PGHOST,port:Number(process.env.PGPORT),
  user:process.env.PGUSER,password:process.env.PGPASSWORD,
  database:process.env.PGDATABASE,max:4,connectionTimeoutMillis:5000,
});
const db={query:(sql,params=[])=>pool.query(sql,params)};
class FinancePnlHttpModule{}
Module({
  controllers:[FinanceReadController],
  providers:[
    {provide:DatabaseServiceMarker,useValue:db},
    MonthlyOperatingResultService,
  ],
})(FinancePnlHttpModule);

function jwt(role,session,actor,expires=Math.floor(Date.now()/1000)+300){
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const header=encode({alg:'HS256',typ:'JWT'});
  const payload=encode({sub:actor,role,jti:session,exp:expires});
  const signingInput=header+'.'+payload;
  const signature=crypto.createHmac('sha256',process.env.JWT_SECRET)
    .update(signingInput).digest('base64url');
  return signingInput+'.'+signature;
}
const tokens={
  admin:jwt('ADMIN','CI_PNL_ADMIN','CI_ACTOR_ADMIN'),
  supervisor:jwt('SUPERVISOR','CI_PNL_SUPERVISOR','CI_ACTOR_SUPERVISOR'),
  accountant:jwt('ACCOUNTANT','CI_PNL_ACCOUNTANT','CI_ACTOR_ACCOUNTANT'),
  caregiver:jwt('CAREGIVER','CI_PNL_CAREGIVER','CI_ACTOR_CAREGIVER'),
  revoked:jwt('ADMIN','CI_PNL_REVOKED','CI_ACTOR_ADMIN'),
  staleRole:jwt('SUPERVISOR','CI_PNL_ADMIN','CI_ACTOR_ADMIN'),
  expired:jwt('ADMIN','CI_PNL_ADMIN','CI_ACTOR_ADMIN',1),
};

async function main(){
  const app=await NestFactory.create(FinancePnlHttpModule,{logger:false});
  const auth=new ProductionAuthMiddleware(db);
  app.use((request,response,next)=>
    Promise.resolve(auth.use(request,response,next)).catch(next));
  await app.listen(0,'127.0.0.1');
  const base='http://127.0.0.1:'+app.getHttpServer().address().port+
    '/api/finance-read/operating-result/month/2026-10';
  async function get(token,url=base){
    const response=await fetch(url,{headers:token?{authorization:'Bearer '+token}:{}});
    return {status:response.status,body:await response.json()};
  }
  try{
    assert.equal((await get(null)).status,401,'missing JWT denied');
    assert.equal((await get(tokens.expired)).status,401,'expired JWT denied');
    assert.equal((await get(tokens.revoked)).status,401,'revoked session denied');
    assert.equal((await get(tokens.staleRole)).status,401,'stale role session denied');
    assert.equal((await get(tokens.caregiver)).status,403,'care role denied');
    assert.equal((await get(tokens.accountant)).status,403,'accountant P&L denied');
    assert.equal((await get(tokens.admin)).status,200,'admin allowed');
    assert.equal((await get(tokens.supervisor)).status,200,'supervisor allowed');
    assert.equal((await get(tokens.admin,base.replace('/2026-10','/2026-13'))).status,400,
      'invalid month rejected');

    const result=(await get(tokens.admin)).body;
    assert.equal(result.source,'POSTGRESQL');
    assert.equal(result.ledgerSchemaReady,true);
    assert.equal(result.state,'CHUA_DU_DU_LIEU');
    assert.equal(result.reconciliationStatus,'CHUA_DOI_SOAT');
    assert.equal(result.revenueVnd,null,'unattested revenue is not certified');
    assert.equal(result.netProfitVnd,null,'unattested net profit remains NULL');
    assert.ok(result.reasons.includes('MONTH_CLOSE_EVIDENCE_MISSING'));
    console.log('FINANCE_PNL_HTTP_JWT_POSTGRES_E2E=PASS');
    console.log('P_AND_L_ROLE_BOUNDARIES=PASS');
    console.log('UNVERIFIED_MONTH_CLOSE_FAIL_CLOSED=PASS');
  }finally{
    await app.close();
    await pool.end();
  }
}
main().catch(error=>{console.error('FINANCE_PNL_HTTP_JWT_POSTGRES_E2E=FAIL',error);process.exitCode=1;});
