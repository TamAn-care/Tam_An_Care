'use strict';
// Regression: session is insufficient if staff account is inactive or role changed.
// Isolated fake DB only. This test is expected to FAIL until source authorization is fixed.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {ProductionAuthMiddleware}=require('../dist/security/production-auth.middleware.js');
const secret='isolated-staff-rbac-test-secret-000000000000';
function jwt(role='CAREGIVER'){
  const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const body=Buffer.from(JSON.stringify({sub:'staff-fixture-1',role,jti:'session-fixture-1',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const sig=createHmac('sha256',secret).update(head+'.'+body).digest('base64url');
  return head+'.'+body+'.'+sig;
}
async function request(status,canonicalRole,claimedRole='CAREGIVER'){
  let continued=false, writes=0, reads=0;
  const db={query:async(sql)=>{
    reads++;
    if (/auth_sessions/.test(sql)) return {rows:[{actor_id:'staff-fixture-1',actor_role:claimedRole}],rowCount:1};
    if (/staff_actors/.test(sql)) {
      const authorized=status==='ACTIVE' && canonicalRole===claimedRole;
      return {rows:authorized?[{actor_id:'staff-fixture-1',primary_operational_role:canonicalRole,status}]:[],rowCount:authorized?1:0};
    }
    throw new Error('Unexpected query in security test');
  }};
  const req={originalUrl:'/api/residents',headers:{'x-actor-id':'forged','x-actor-role':'SUPERVISOR'},
    header:(name)=>name==='authorization'?'Bearer '+jwt(claimedRole):undefined};
  const m=new ProductionAuthMiddleware(db);
  let denied=false;
  try {await m.use(req,{},()=>{continued=true;});} catch {denied=true;}
  return {denied,continued,writes,reads,req,status,canonicalRole};
}
const previous={NODE_ENV:process.env.NODE_ENV,JWT_SECRET:process.env.JWT_SECRET};
process.env.NODE_ENV='production';process.env.JWT_SECRET=secret;
process.on('exit',()=>{for(const [k,v] of Object.entries(previous)) if(v===undefined)delete process.env[k];else process.env[k]=v;});
test('STAFF-SESSION-01 disabled actor with previously valid session is denied',async()=>{
  const r=await request('INACTIVE','CAREGIVER');
  assert.equal(r.denied,true,'must revalidate active canonical staff on each request');
  assert.equal(r.continued,false);
  assert.equal(r.writes,0);
});
test('STAFF-SESSION-02 changed canonical role invalidates old-role token',async()=>{
  const r=await request('ACTIVE','NURSE','CAREGIVER');
  assert.equal(r.denied,true,'role must be checked against canonical current role');
  assert.equal(r.continued,false);
  assert.equal(r.writes,0);
});
