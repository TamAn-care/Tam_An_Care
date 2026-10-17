'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Native=require('node:module');

const root=process.env.FINANCE_WORKTREE;
const apiRequire=Native.createRequire(path.join(root,'api/package.json'));
require(apiRequire.resolve('reflect-metadata'));

const {Module}=apiRequire('@nestjs/common');
const {NestFactory}=apiRequire('@nestjs/core');
const {Pool}=apiRequire('pg');

function find(name){
 const found=[];
 function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,e.name);
   if(e.isDirectory())walk(p);
   else if(e.name===name)found.push(p);
  }
 }
 walk(path.join(root,'api/dist'));
 assert.equal(found.length,1,'artifact '+name);
 return found[0];
}

const midFile=find('production-auth.middleware.js');
const ctlFile=find('contract-signoff.controller.js');
class DbMarker {}

const original=Native._load;
Native._load=function(name,parent,isMain){
 if(name==='../database/database.service' &&
    [midFile,ctlFile].includes(parent?.filename))
  return {DatabaseService:DbMarker};
 return original.apply(this,arguments);
};

let Middleware,Signoff;
try {
 Middleware=require(midFile).ProductionAuthMiddleware;
 Signoff=require(ctlFile).ContractSignoffController;
} finally {
 Native._load=original;
}

process.env.NODE_ENV='production';
process.env.JWT_SECRET='contract-v32-isolated-key-2026-not-production';
process.env.TAMANCARE_CONTRACT_SIGNOFF_ENABLED='true';
process.env.TAMANCARE_CONTRACT_SIGNATURE_VERIFY_ROLES='ACCOUNTANT';
process.env.TAMANCARE_CONTRACT_APPROVER_ROLES='ADMIN';

const pool=new Pool({
 host:'127.0.0.1',
 port:Number(process.env.FINANCE_LAB_PORT),
 user:process.env.PGUSER,
 database:process.env.PGDATABASE,
 max:5,
 connectionTimeoutMillis:5000
});

const db={
 query:(q,p=[])=>pool.query(q,p),
 withTransaction:async(fn)=>{
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const value=await fn(c);
   await c.query('COMMIT');
   return value;
  }catch(e){
   await c.query('ROLLBACK');
   throw e;
  }finally{c.release();}
 }
};

class TestModule {}
Module({
 controllers:[Signoff],
 providers:[{provide:DbMarker,useValue:db}],
})(TestModule);

function jwt(actor,role,session){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const h=enc({alg:'HS256',typ:'JWT'});
 const p=enc({
  sub:actor,role,jti:session,
  exp:Math.floor(Date.now()/1000)+300
 });
 const value=h+'.'+p;
 return value+'.'+crypto.createHmac('sha256',process.env.JWT_SECRET)
  .update(value).digest('base64url');
}

async function run(){
 const app=await NestFactory.create(TestModule,{logger:false});
 const mid=new Middleware(db);
 app.use((req,res,next)=>
  Promise.resolve(mid.use(req,res,next)).catch(next));

 await app.listen(0,'127.0.0.1');

 const port=app.getHttpServer().address().port;
 const base='http://127.0.0.1:'+port+
  '/api/service-contract-signoff/TEST_C1/versions/1';

 const verifier=jwt(
  'TEST_VERIFIER','ACCOUNTANT','SESSION_VERIFY');
 const approver=jwt(
  'TEST_APPROVER','ADMIN','SESSION_APPROVE');

 async function send(suffix,token,body){
  const response=await fetch(base+suffix,{
   method:'POST',
   headers:{
    'content-type':'application/json',
    ...(token?{authorization:'Bearer '+token}:{})
   },
   body:JSON.stringify(body),
  });
  return {
   status:response.status,
   data:await response.json()
  };
 }

 const evidence={
  documentSha256:process.env.FINANCE_TEST_PDF_SHA,
  documentReference:'TEST_SIGNED.pdf',
  signingMethod:'SIGNED_PAPER_ARCHIVED',
  signedAt:'2026-10-01T10:00:00Z'
 };

 const approval={
  approvalReason:'Independent operational review completed'
 };

 try{
  assert.equal(
   (await send('/verify-signature',null,evidence)).status,401);
  assert.equal(
   (await send('/approve',verifier,approval)).status,403);

  console.log('SIGNOFF_AUTH_NEGATIVE=PASS');

  const noEvidence=await send('/approve',approver,approval);
  assert.ok(noEvidence.status>=400);
  console.log('APPROVAL_WITHOUT_SIGNATURE=REJECTED');

  const wrongHash=await send('/verify-signature',verifier,{
   ...evidence,
   documentSha256:'0'.repeat(64)
  });
  assert.ok(wrongHash.status>=400);
  console.log('PDF_WRONG_SHA256=REJECTED');

  let result=await send('/verify-signature',verifier,evidence);
  assert.equal(result.status,201);
  assert.equal(result.data.signatureEvidenceRecorded,true);
  console.log('REAL_PDF_ARCHIVE_VERIFICATION=PASS');

  const signed=await pool.query(
   'SELECT verified_by FROM service_contract_signing_evidence'
  );
  assert.equal(signed.rows.length,1);
  assert.equal(signed.rows[0].verified_by,'TEST_VERIFIER');

  // Rejection if the verifying actor is also the approver
  // is statically guarded by the controller; isolated HTTP
  // here uses distinct role identities.

  // V33: An actor who verified the signature must not approve it,
  // even if that actor later holds an approver role.
  await pool.query(
    `UPDATE staff_actors SET primary_operational_role='ADMIN'
     WHERE actor_id='TEST_VERIFIER'`
  );
  await pool.query(
    `INSERT INTO auth_sessions
     (session_id,actor_id,actor_role,revoked_at,expires_at)
     VALUES ('SESSION_SAME_ACTOR','TEST_VERIFIER','ADMIN',
             NULL,now()+interval '1 hour')`
  );
  const sameActor=jwt(
    'TEST_VERIFIER','ADMIN','SESSION_SAME_ACTOR'
  );
  assert.equal(
    (await send('/approve',sameActor,approval)).status,403
  );
  console.log('SAME_ACTOR_APPROVAL=REJECTED');

  await pool.query(
    `UPDATE staff_actors SET primary_operational_role='ACCOUNTANT'
     WHERE actor_id='TEST_VERIFIER'`
  );

  // Incorrect bed assignment must reject approval.
  await pool.query(
    `UPDATE bed_assignments SET bed_id='OTHER_BED'
     WHERE resident_id='TEST_R1'`
  );
  assert.equal(
    (await send('/approve',approver,approval)).status,400
  );
  await pool.query(
    `UPDATE bed_assignments SET bed_id='TEST_BED'
     WHERE resident_id='TEST_R1'`
  );
  console.log('BED_MISMATCH=REJECTED');

  // Incorrect actual care level must reject approval.
  await pool.query(
    `UPDATE residents SET care_level='LEVEL_OTHER'
     WHERE resident_id='TEST_R1'`
  );
  assert.equal(
    (await send('/approve',approver,approval)).status,400
  );
  await pool.query(
    `UPDATE residents SET care_level='LEVEL_1'
     WHERE resident_id='TEST_R1'`
  );
  console.log('CARE_LEVEL_MISMATCH=REJECTED');

  // The declared total must match the actual fee calculation.
  await pool.query(
    `UPDATE service_contract_versions
     SET payload=jsonb_set(
       payload,'{appendix,totalMonthlyFee}','10000000'::jsonb
     )
     WHERE contract_id='TEST_C1' AND version=1
       AND status='DRAFT'`
  );
  assert.equal(
    (await send('/approve',approver,approval)).status,400
  );
  await pool.query(
    `UPDATE service_contract_versions
     SET payload=jsonb_set(
       payload,'{appendix,totalMonthlyFee}','12000000'::jsonb
     )
     WHERE contract_id='TEST_C1' AND version=1
       AND status='DRAFT'`
  );
  console.log('MONTHLY_FEE_MISMATCH=REJECTED');

  // All negative paths must preserve an unapproved draft.
  const before=await pool.query(
    `SELECT status FROM service_contract_versions
     WHERE contract_id='TEST_C1' AND version=1`
  );
  assert.equal(before.rows[0].status,'DRAFT');

  const decisions=await pool.query(
    `SELECT count(*)::int AS n
     FROM service_contract_approval_decisions`
  );
  assert.equal(decisions.rows[0].n,0);
  console.log('NEGATIVE_CASES_NO_PARTIAL_APPROVAL=PASS');

  // Now the original independent approver may approve.
  result=await send('/approve',approver,approval);
  assert.equal(result.status,201);
  assert.equal(result.data.status,'ACTIVE');
  assert.equal(result.data.approvedMonthlyVnd,'12000000');

  const state=await pool.query(
   `SELECT c.status,
     v.status AS version_status,
     v.approved_by,
     d.monthly_fee_vnd::text AS approved_fee
    FROM service_contract_records c
    JOIN service_contract_versions v
      ON v.contract_id=c.contract_id
    JOIN service_contract_approval_decisions d
      ON d.contract_id=v.contract_id
     AND d.version=v.version`
  );
  assert.equal(state.rows.length,1);
  assert.equal(state.rows[0].status,'ACTIVE');
  assert.equal(state.rows[0].version_status,'ACTIVE');
  assert.equal(state.rows[0].approved_by,'TEST_APPROVER');
  assert.equal(Number(state.rows[0].approved_fee),12000000);

  console.log('INDEPENDENT_APPROVAL=PASS');
  console.log('CANONICAL_ACTIVE_VERSION=PASS');

  const invoice=await pool.query(
   'SELECT count(*)::int AS n FROM billing_invoices');
  const receipt=await pool.query(
   'SELECT count(*)::int AS n FROM billing_receipts');

  assert.equal(invoice.rows[0].n,0);
  assert.equal(receipt.rows[0].n,0);

  console.log('NO_AUTO_BILLING_OR_RECEIPT=PASS');
  console.log('V33_REAL_SIGNOFF_NEGATIVE_HTTP_PG16_PASS');
 }finally{
  await app.close();
  await pool.end();
 }
}

run().catch(err=>{
 console.error('V33_SIGNOFF_TEST_FAILED',err);
 process.exitCode=1;
});
