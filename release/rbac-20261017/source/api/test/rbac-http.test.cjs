'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {Test}=require('@nestjs/testing');
const {Module}=require('@nestjs/common');
const {DatabaseService}=require('../dist/database/database.service');
const {StaffActorController}=require('../dist/staff-actors/staff-actor.controller');
const {StaffActorService}=require('../dist/staff-actors/staff-actor.service');
const {ResidentAccessScopeService}=require('../dist/resident-access-scope/resident-access-scope.service');
const {GuardianResidentService}=require('../dist/resident-access-scope/guardian-resident.service');
const {GuardianResidentController}=require('../dist/resident-access-scope/guardian-resident.controller');
const {AssignedResidentController}=require('../dist/resident-access-scope/assigned-resident.controller');
const {ProductionAuthMiddleware}=require('../dist/security/production-auth.middleware');
const {OperationalCareViewService}=require('../dist/operational-care-view/operational-care-view.service');
const {OperationalCareViewController}=require('../dist/operational-care-view/operational-care-view.controller');
const {CrossDomainIntegrationService}=require('../dist/cross-domain-integration/cross-domain-integration.service');
const secret='http-isolated-tests-nonproduction-000000000001';
process.env.NODE_ENV='production';process.env.JWT_SECRET=secret;
function jwt(id,role){const h=Buffer.from('{"alg":"HS256"}').toString('base64url'),p=Buffer.from(JSON.stringify({sub:id,role,jti:id+'-session',exp:Date.now()/1000+60})).toString('base64url');return `${h}.${p}.${createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url')}`;}
test('Nest HTTP authentication and resident scope (memory database)',async t=>{
 const actors=new Map(['SUPERVISOR','GUARDIAN','NURSE','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER'].map(role=>[role,{actor_id:role,primary_operational_role:role,status:'ACTIVE'}]));
 let linked=true;const revoked=new Set();
 const db={withTransaction:async fn=>fn({query:(sql,p)=>db.query(sql,p)}),query:async(sql,p)=>{
  if(sql.includes('UPDATE staff_actors')){actors.get(p[0]).status=p[1];return {rows:[actors.get(p[0])]};}
  if(sql.includes('UPDATE auth_sessions')){revoked.add(p[0]);return {rowCount:1};}
  if(sql.includes('INSERT INTO staff_actor_audit'))return {rows:[],rowCount:1};
  if(sql.includes('FROM auth_sessions')&&!sql.includes('FROM staff_actors'))return {rows:actors.has(p[1])&&!revoked.has(p[1])?[{actor_id:p[1],actor_role:p[2]}]:[]};
  if(sql.includes('FROM staff_actors')&&!sql.includes('FROM residents')){const a=actors.get(p[0]);return {rows:a&&(!sql.includes("status = 'ACTIVE'")||(a.status==='ACTIVE'&&a.primary_operational_role===p[1]))?[a]:[]};}
  if(sql.includes('FROM residents')){
   assert.match(sql,/resident_access_assignments/);assert.match(sql,/effective_to > NOW\(\)/);
   if(p[0]==='resident-A'||p[0]==='resident-B')return {rowCount:linked&&p[0]==='resident-A'?1:0,rows:[]};
   const a=actors.get(p[0]);const ok=linked&&a?.status==='ACTIVE'&&a.primary_operational_role===p[1]&&(!p[3]||p[3]==='resident-A');
   return {rows:ok?[{residentId:'resident-A',residentCode:'CI-A',displayName:'CI resident',room:null,careLevel:'ASSISTED'}]:[]};
  }
  throw Error('Unexpected SQL in isolated HTTP test');
 }};
 class HttpModule{configure(consumer){consumer.apply(ProductionAuthMiddleware).forRoutes('*');}}
 Module({controllers:[StaffActorController,GuardianResidentController,AssignedResidentController,OperationalCareViewController],providers:[
  {provide:DatabaseService,useValue:db},StaffActorService,ResidentAccessScopeService,GuardianResidentService,OperationalCareViewService,
  {provide:CrossDomainIntegrationService,useValue:{residentOverview:async()=>({data:{resident:{resident_id:'resident-A',date_of_birth:'sensitive-date'},clinicalObservations:[{clinical_observation_id:'obs-A',numeric_value:72,text_value:'sensitive-note'}]},availability:{},provenance:{},limits:{perDomain:10}})}}
 ]})(HttpModule);
 const module=await Test.createTestingModule({imports:[HttpModule]}).compile();
 const app=module.createNestApplication({logger:false});t.after(()=>app.close());
 await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 async function request(path,role,method='GET',headers={}){return fetch(base+path,{method,headers:{...(role?{Authorization:'Bearer '+jwt(role,role)}:{}),...headers}});}
 await t.test('missing bearer rejected',async()=>assert.equal((await request('/api/family-portal/residents')).status,401));
 await t.test('Guardian list contains linked resident only',async()=>{const r=await request('/api/family-portal/residents','GUARDIAN');assert.equal(r.status,200);assert.deepEqual((await r.json()).map(x=>x.residentId),['resident-A']);});
 await t.test('Guardian linked detail allowed',async()=>assert.equal((await request('/api/family-portal/residents/resident-A','GUARDIAN')).status,200));
 await t.test('Guardian cross resident detail denied',async()=>assert.equal((await request('/api/family-portal/residents/resident-B','GUARDIAN')).status,404));
 await t.test('Guardian cannot enter staff care view with spoofed headers',async()=>assert.equal((await request('/api/operations/residents/resident-A/care-view','GUARDIAN','GET',{'x-actor-role':'NURSE','x-actor-id':'NURSE'})).status,403));
 await t.test('Staff cannot enter Guardian endpoint',async()=>assert.equal((await request('/api/family-portal/residents','NURSE')).status,403));
 await t.test('Guardian mutation denied',async()=>assert.equal((await request('/api/family-portal/residents/resident-A','GUARDIAN','POST')).status,403));
 for(const role of ['NURSE','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER']){
  await t.test(role+' assigned view allowed and redacted',async()=>{const r=await request('/api/operations/residents/resident-A/care-view',role);assert.equal(r.status,200);const body=await r.json();if(role!=='NURSE'){assert.equal(body.clinical[0].numericValue,undefined);assert.equal(body.clinical[0].textValue,undefined);assert.equal(body.resident.dateOfBirth,undefined);}});
  await t.test(role+' cross resident denied',async()=>assert.equal((await request('/api/operations/residents/resident-B/care-view',role)).status,404));
 }
 await t.test('Link revocation applies on next request',async()=>{linked=false;assert.deepEqual(await (await request('/api/family-portal/residents','GUARDIAN')).json(),[]);assert.equal((await request('/api/operations/residents/resident-A/care-view','NURSE')).status,404);linked=true;});
 await t.test('Inactive account session rejected',async()=>{actors.get('NURSE').status='INACTIVE';assert.equal((await request('/api/operations/residents/resident-A/care-view','NURSE')).status,401);actors.get('NURSE').status='ACTIVE';});
 await t.test('Old role session rejected',async()=>{actors.get('NURSE').primary_operational_role='CAREGIVER';assert.equal((await request('/api/operations/residents/resident-A/care-view','NURSE')).status,401);actors.get('NURSE').primary_operational_role='NURSE';});
 await t.test('HTTP staff deactivation revokes session',async()=>{const r=await fetch(base+'/api/operations/staff-actors/NURSE/status',{method:'POST',headers:{Authorization:'Bearer '+jwt('SUPERVISOR','SUPERVISOR'),'Content-Type':'application/json'},body:JSON.stringify({status:'SUSPENDED',reason:'isolated fixture only'})});assert.equal(r.status,201);assert.equal(actors.get('NURSE').status,'SUSPENDED');assert.ok(revoked.has('NURSE'));assert.equal((await request('/api/operations/residents/resident-A/care-view','NURSE')).status,401);});
 await t.test('Nonmanager cannot deactivate staff',async()=>{const r=await request('/api/operations/staff-actors/CAREGIVER/status','CAREGIVER','POST');assert.equal(r.status,403);});
});
