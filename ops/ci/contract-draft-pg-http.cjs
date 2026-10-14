'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Native = require('node:module');
const root = path.resolve(__dirname,'../..');
const requireApi = Native.createRequire(path.join(root,'api/package.json'));

require(requireApi.resolve('reflect-metadata'));

const {Module}=requireApi('@nestjs/common');
const {NestFactory}=requireApi('@nestjs/core');
const {Pool}=requireApi('pg');

const dist=path.join(root,'api/dist');

function find(name) {
  const result=[];
  function scan(dir) {
    for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
      const p=path.join(dir,item.name);
      if(item.isDirectory())scan(p);
      else if(item.name===name)result.push(p);
    }
  }
  scan(dist);
  assert.equal(result.length,1,'artifact '+name);
  return result[0];
}

const midFile=find('production-auth.middleware.js');
const draftFile=find('canonical-contract-draft.controller.js');

class DbMarker {}

const original=Native._load;
Native._load=function(name,parent,isMain) {
  if(name==='../database/database.service' &&
     [midFile,draftFile].includes(parent?.filename))
    return {DatabaseService:DbMarker};
  return original.apply(this,arguments);
};

let Middleware,DraftController;
try {
  Middleware=require(midFile).ProductionAuthMiddleware;
  DraftController=require(draftFile).CanonicalContractDraftController;
} finally {
  Native._load=original;
}

process.env.NODE_ENV='production';
process.env.JWT_SECRET='contract-v30-isolated-test-secret-2026-long';
process.env.TAMANCARE_CONTRACT_DRAFT_WRITE_ENABLED='true';
process.env.TAMANCARE_CONTRACT_DRAFT_WRITE_ROLES='ACCOUNTANT';

const pool=new Pool({
  host:'127.0.0.1',
  port:Number(process.env.CONTRACT_LAB_PGPORT),
  user:process.env.PGUSER,
  database:process.env.PGDATABASE,
  max:4,
  connectionTimeoutMillis:5000,
});

const db={
  query:(sql,params=[])=>pool.query(sql,params),
  withTransaction:async fn=>{
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const result=await fn(client);
      await client.query('COMMIT');
      return result;
    } catch(err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

class TestModule {}
Module({
  controllers:[DraftController],
  providers:[{provide:DbMarker,useValue:db}],
})(TestModule);

function jwt(role='ACCOUNTANT',session='TEST_ACTIVE') {
  const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const h=encode({alg:'HS256',typ:'JWT'});
  const p=encode({
    sub:'TEST_ACTOR',
    role,
    jti:session,
    exp:Math.floor(Date.now()/1000)+300,
  });
  const raw=h+'.'+p;
  return raw+'.'+crypto.createHmac('sha256',process.env.JWT_SECRET)
    .update(raw).digest('base64url');
}

async function main() {
  const app=await NestFactory.create(TestModule,{logger:false});
  const middleware=new Middleware(db);
  app.use((req,res,next)=>
    Promise.resolve(middleware.use(req,res,next)).catch(next));

  await app.listen(0,'127.0.0.1');
  const port=app.getHttpServer().address().port;
  const url='http://127.0.0.1:'+port+'/api/service-contract-drafts';

  async function post(token,body) {
    const response=await fetch(url,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        ...(token?{authorization:'Bearer '+token}:{})
      },
      body:JSON.stringify(body),
    });
    return {
      status:response.status,
      data:await response.json(),
    };
  }

  const body={
    contractId:'TEST_CONTRACT_1',
    contractCode:'TEST_001_2026',
    residentId:'TEST_RESIDENT_1',
    payload:{
      contractId:'TEST_CONTRACT_1',
      contractCode:'TEST_001_2026',
      residentId:'TEST_RESIDENT_1',
      status:'DRAFT',
      effectiveDate:'2026-10-14',
      appendix:{baseMonthlyFee:12000000},
    },
  };

  try {
    assert.equal((await post(null,body)).status,401);

    assert.equal(
      (await post(jwt('CAREGIVER','TEST_CARE'),body)).status,
      403
    );

    assert.equal(
      (await post(jwt('ACCOUNTANT','TEST_REVOKED'),body)).status,
      401
    );

    console.log('DRAFT_AUTH_RBAC_NEGATIVE=PASS');

    assert.equal(
      (await post(jwt(),{
        ...body,
        contractId:'TEST_INVALID_RESIDENT',
        residentId:'NONEXISTENT',
      })).status,
      400
    );

    console.log('DRAFT_RESIDENT_VALIDATION=PASS');

    const created=await post(jwt(),body);
    assert.equal(created.status,201);
    assert.equal(created.data.status,'DRAFT');
    assert.equal(created.data.version,1);
    assert.equal(created.data.source,'VERIFIED_SERVER');

    console.log('DRAFT_HTTP_POSTGRES_WRITE=PASS');

    const duplicate=await post(jwt(),body);
    assert.ok(duplicate.status>=400);

    const records=await pool.query(
      `SELECT contract_id,contract_code,resident_id,status
       FROM service_contract_records`
    );
    assert.equal(records.rows.length,1);
    assert.equal(records.rows[0].status,'DRAFT');

    const versions=await pool.query(
      `SELECT version,status
       FROM service_contract_versions`
    );
    assert.equal(versions.rows.length,1);
    assert.equal(versions.rows[0].version,1);
    assert.equal(versions.rows[0].status,'DRAFT');

    console.log('DRAFT_DUPLICATE_PROTECTION=PASS');
    console.log('DRAFT_CANONICAL_VERSION=PASS');

    const invoices=await pool.query(
      'SELECT count(*)::integer AS n FROM billing_invoices'
    );
    const receipts=await pool.query(
      'SELECT count(*)::integer AS n FROM billing_receipts'
    );

    assert.equal(invoices.rows[0].n,0);
    assert.equal(receipts.rows[0].n,0);

    console.log('NO_AUTO_BILLING_OR_RECEIPTS=PASS');
    console.log('TAMANCARE_V30_CONTRACT_DRAFT_REAL_PG_HTTP_PASS');
  } finally {
    await app.close();
    await pool.end();
  }
}

main().catch(err=>{
  console.error('V30_TEST_FAILED',err);
  process.exitCode=1;
});
