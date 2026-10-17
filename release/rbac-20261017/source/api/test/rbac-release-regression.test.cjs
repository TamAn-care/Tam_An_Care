'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac,pbkdf2Sync}=require('node:crypto');
const {ProductionAuthMiddleware}=require('../dist/security/production-auth.middleware');
const {ResidentAccessScopeService}=require('../dist/resident-access-scope/resident-access-scope.service');
const {OperationalCareViewService}=require('../dist/operational-care-view/operational-care-view.service');
const {AssignedResidentController}=require('../dist/resident-access-scope/assigned-resident.controller');
const {VitalSignService}=require('../dist/clinical-observations/vital-sign.service');
const {ClinicalController}=require('../dist/clinical-observations/clinical.controller');
const {AuthService}=require('../dist/auth/auth.service');
const secret='isolated-test-key-nonproduction-000000000001';
process.env.NODE_ENV='production';process.env.JWT_SECRET=secret;
function token(role,extra={}){const h=Buffer.from('{"alg":"HS256"}').toString('base64url'),p=Buffer.from(JSON.stringify({sub:'actor-A',role,jti:'session-A',exp:Date.now()/1000+60,...extra})).toString('base64url');return `${h}.${p}.${createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url')}`;}
async function auth(role,path,method='GET',extra={}){const req={originalUrl:path,method,headers:{},header:()=>`Bearer ${token(role,extra)}`};await new ProductionAuthMiddleware({query:async()=>({rows:[{}]})}).use(req,null,()=>{req.allowed=true;});return req;}
for(const role of ['NURSE','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER']){
 test(role+' requires exact active assignment',async()=>{
  const expected={NURSE:'CLINICAL_CARE',CAREGIVER:'DIRECT_CARE',PSYCHOLOGIST:'PSYCHOSOCIAL_CARE',SOCIAL_WORKER:'PSYCHOSOCIAL_CARE'}[role];
  const scope=new ResidentAccessScopeService({query:async(sql,params)=>{assert.match(sql,/raa.status = 'ACTIVE'/);assert.match(sql,/raa.effective_to > NOW\(\)/);assert.deepEqual(params,['resident-A','actor-A',role,expected]);return {rowCount:1};}},{resolveActiveActorWithRole:async()=>({actor_id:'actor-A'})});
  assert.equal(await scope.canAccessResident('actor-A',role,'resident-A'),true);assert.deepEqual(scope.sqlPredicate('r','actor-A',role).params,['actor-A',role,expected]);
 });
 test(role+' denied care view does not load data',async()=>{let reads=0;const view=new OperationalCareViewService({residentOverview:async()=>{reads++;}},{canAccessResident:async()=>false});await assert.rejects(view.getResidentCareView('B',{actorId:'actor-A',actorRole:role}),e=>e.getStatus()===404);assert.equal(reads,0);});
}
for(const role of ['PSYCHOLOGIST','SOCIAL_WORKER']){
 test(role+' route isolation',async()=>{assert.equal((await auth(role,'/api/operations/residents/A/care-view')).allowed,true);assert.equal((await auth(role,'/api/operations/residents/assigned')).allowed,true);for(const [path,method] of [['/api/residents','GET'],['/api/residents/A/vital-signs','POST'],['/api/staff-actors','GET']])await assert.rejects(auth(role,path,method),e=>e.getStatus()===403);});
 test(role+' listing uses assignment SQL',async()=>{const c=new AssignedResidentController({query:async(sql,p)=>{assert.match(sql,/resident_access_assignments/);assert.match(sql,/sa.status = 'ACTIVE'/);assert.deepEqual(p,['actor-A',role,'PSYCHOSOCIAL_CARE']);return {rows:[]};}},new ResidentAccessScopeService({},{}));assert.deepEqual(await c.list('actor-A',role),[]);});
}
test('Guardian route isolation',async()=>{assert.equal((await auth('GUARDIAN','/api/family-portal/residents')).allowed,true);for(const path of ['/api/residents','/api/residents/A','/api/operations/residents/A/care-view'])await assert.rejects(auth('GUARDIAN',path),e=>e.getStatus()===403);await assert.rejects(auth('NURSE','/api/family-portal/residents'),e=>e.getStatus()===403);});
for(const exp of [undefined,null,'tomorrow',0])test('JWT invalid exp '+exp,async()=>{await assert.rejects(auth('NURSE','/api/residents','GET',{exp}),e=>e.getStatus()===401);});
function vitals({allowed=true,auditFails=false}={}){let writes=0,audits=0,committed=false;const client={query:async(sql,p)=>{assert.match(sql,/INSERT INTO clinical_observations/);assert.match(sql,/raa.status = 'ACTIVE'/);assert.match(sql,/sa.status = 'ACTIVE'/);assert.deepEqual(p.slice(0,4),['actor-A','NURSE','CLINICAL_CARE','resident-A']);if(!allowed)return {rows:[]};writes++;return {rows:[{clinical_observation_id:p[4]}]};}};return {service:new VitalSignService({withTransaction:async fn=>{const r=await fn(client);committed=true;return r;}},new ResidentAccessScopeService({},{}),{insertAudit:async()=>{audits++;if(auditFails)throw Error('audit unavailable');}}),state:()=>({writes,audits,committed})};}
const input={measuredAt:'2026-10-16T01:00:00Z',measurements:{heartRate:72,temp:36.5}};
test('Assigned nurse records with audit',async()=>{const h=vitals();assert.equal((await h.service.record('resident-A','actor-A','NURSE',input)).recorded.length,2);assert.deepEqual(h.state(),{writes:2,audits:2,committed:true});});
test('Unassigned nurse cannot write',async()=>{const h=vitals({allowed:false});await assert.rejects(h.service.record('resident-A','actor-A','NURSE',input),e=>e.getStatus()===404);assert.deepEqual(h.state(),{writes:0,audits:0,committed:false});});
test('Audit failure prevents transaction completion',async()=>{const h=vitals({auditFails:true});await assert.rejects(h.service.record('resident-A','actor-A','NURSE',input),/audit unavailable/);assert.equal(h.state().committed,false);});
for(const role of ['GUARDIAN','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER'])test(role+' cannot record vital signs',async()=>{const h=vitals();await assert.rejects(h.service.record('resident-A','actor-A',role,input),e=>e.getStatus()===403);assert.equal(h.state().writes,0);});
for(const measurements of [{},{heartRate:NaN},{heartRate:'72'},{invented:1},[]])test('Invalid values '+JSON.stringify(measurements),async()=>{const h=vitals();await assert.rejects(h.service.record('resident-A','actor-A','NURSE',{...input,measurements}),e=>e.getStatus()===400);assert.equal(h.state().writes,0);});
test('Clinical mutation ignores forged body actor',async()=>{let received;const c=new ClinicalController({mutate:async(_t,_id,_a,input)=>{received=input;return {};}});await c.mutate('observation','obs-A','VERIFY_OBSERVATION',{actorId:'forged',actorRole:'SUPERVISOR'},'actor-A','NURSE');assert.equal(received.actorId,'actor-A');assert.equal(received.actorRole,'NURSE');});
test('Password login issues server-derived identity',async()=>{const salt='ci-salt',password='ci-password';let writes=0;const a=new AuthService({query:async(sql,p)=>{if(sql.includes('FROM auth_credentials'))return {rows:[{actor_id:'actor-A',display_name:'CI Actor',staff_code:'CI-A',password_hash:pbkdf2Sync(password,salt,1000,32,'sha256').toString('hex'),password_salt:salt,password_iterations:1000,password_digest:'sha256',locked_until:null,primary_operational_role:'NURSE',status:'ACTIVE'}]};if(sql.includes('INSERT INTO auth_sessions')){writes++;assert.equal(p[2],'NURSE');}return {rows:[],rowCount:1};}});await assert.rejects(a.login('actor-A','wrong'),e=>e.getStatus()===401);assert.equal(writes,0);const r=await a.login('actor-A',password);assert.equal(r.actor.actorRole,'NURSE');assert.equal(writes,1);});

for (const [header,payload] of [[null,{}],[{},null],[[],{}],[{},[]]]) {
 test('Malformed JWT JSON objects denied '+JSON.stringify([header,payload]),async()=>{
  const h=Buffer.from(JSON.stringify(header)).toString('base64url'),p=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const value=`${h}.${p}.${createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url')}`;
  await assert.rejects(new ProductionAuthMiddleware({}).use({originalUrl:'/api/residents',headers:{},header:()=>`Bearer ${value}`},null,()=>assert.fail()),e=>e.getStatus()===401);
 });
}
test('Database transaction rolls back failed audit and releases connection',async()=>{
 const {DatabaseService}=require('../dist/database/database.service');
 const commands=[];
 const db=Object.create(DatabaseService.prototype);
 db.pool={connect:async()=>({query:async sql=>commands.push(sql),release:()=>commands.push('RELEASE')})};
 await assert.rejects(db.withTransaction(async()=>{throw Error('audit unavailable');}),/audit unavailable/);
 assert.deepEqual(commands,['BEGIN','ROLLBACK','RELEASE']);
});
const {CrossDomainIntegrationController}=require('../dist/cross-domain-integration/cross-domain-integration.controller');
const {HealthReportService}=require('../dist/health-reports/health-report.service');
test('Raw integration endpoint denies cross resident and nonclinical actor',async()=>{
 let reads=0;const c=new CrossDomainIntegrationController({residentOverview:async()=>{reads++;}},{canAccessResident:async()=>false});
 await assert.rejects(c.overview('B','actor-A','NURSE'),e=>e.getStatus()===404);
 await assert.rejects(c.overview('A','actor-A','CAREGIVER'),e=>e.getStatus()===403);
 assert.equal(reads,0);
});
test('Health report list uses canonical scoped resident predicate',async()=>{
 const service=new HealthReportService({query:async(sql,p)=>{
  if(sql.includes('FROM staff_actors')&&!sql.includes('FROM health_reports'))return {rows:[{actor_id:'actor-A'}]};
  assert.match(sql,/JOIN residents r/);assert.match(sql,/resident_access_assignments/);
  assert.deepEqual(p,['actor-A','NURSE','CLINICAL_CARE']);return {rows:[]};
 }},new ResidentAccessScopeService({},{}));
 assert.deepEqual(await service.list({actorId:'actor-A',actorRole:'NURSE'}),[]);
});
for(const method of ['detail','pdf'])test('Health report '+method+' denies unassigned resident before snapshots',async()=>{
 let reads=0;const service=new HealthReportService({query:async sql=>{
  if(sql.includes('FROM staff_actors')&&!sql.includes('FROM health_reports'))return {rows:[{}]};
  if(sql.includes('FROM health_reports'))return {rows:[{resident_id:'B'}]};
  reads++;throw Error('must not read snapshots');
 }},{canAccessResident:async()=>false});
 await assert.rejects(service[method]({actorId:'actor-A',actorRole:'NURSE'},'report-B'),e=>e.getStatus()===404);assert.equal(reads,0);
});
test('Health reports deny on DB failure instead of returning a sample',async()=>{
 const error=Error('database unavailable');const service=new HealthReportService({query:async()=>{throw error;}},{});
 await assert.rejects(service.list({actorId:'actor-A',actorRole:'NURSE'}),e=>e===error);
});

for(const [file,name] of [['workforce/workforce.service','WorkforceService'],['notifications/notifications.service','NotificationsService'],['operational-work/operational-work-event-type.service','OperationalWorkEventTypeService']]) {
 test(name+' production startup performs no DDL or seed',async()=>{
  const Service=require('../dist/'+file)[name];let reads=0;
  const service=new Service({query:async sql=>{assert.match(sql,/^SELECT 1 FROM [a-z_]+ LIMIT 0$/);reads++;return {rows:[]};}});
  await service.onModuleInit();assert.ok(reads>0);
 });
}

const {StaffActorService}=require('../dist/staff-actors/staff-actor.service');
for(const status of ['ACTIVE','INACTIVE','SUSPENDED','ARCHIVED']) {
 test('Staff status '+status+' revokes sessions and audits in one transaction',async()=>{
  const events=[];let committed=false;
  const service=new StaffActorService({withTransaction:async fn=>{const r=await fn({query:async(sql,p)=>{
   if(sql.includes('FOR SHARE'))return {rows:[{actor_id:'manager-A',primary_operational_role:'SUPERVISOR',status:'ACTIVE'}]};
   if(sql.includes('FOR UPDATE'))return {rows:[{actor_id:'staff-A',primary_operational_role:'NURSE',status:'ACTIVE'}]};
   if(sql.includes('UPDATE staff_actors')){events.push('status');return {rows:[{actor_id:'staff-A',status:p[1]}]};}
   if(sql.includes('UPDATE auth_sessions')){assert.deepEqual(p,['staff-A',status]);events.push('revoke');return {rowCount:1};}
   if(sql.includes('INSERT INTO staff_actor_audit')){assert.equal(p[2],'SUPERVISOR');events.push('audit');return {rowCount:1};}
   throw Error('Unexpected query');
  }});committed=true;return r;}});
  assert.equal((await service.updateStatus('staff-A',status,'CI status check','manager-A')).status,status);
  assert.deepEqual(events,['status','revoke','audit']);assert.equal(committed,true);
 });
}
test('Staff status changes reject lost management authority',async()=>{
 let writes=0;const service=new StaffActorService({withTransaction:async fn=>fn({query:async sql=>{if(sql.includes('UPDATE'))writes++;return {rows:[]};}})});
 await assert.rejects(service.updateStatus('staff-A','INACTIVE','test','manager-A'),e=>e.getStatus()===403);assert.equal(writes,0);
});
test('Supervisor cannot disable Admin',async()=>{
 let writes=0;const service=new StaffActorService({withTransaction:async fn=>fn({query:async sql=>{
  if(sql.includes('FOR SHARE'))return {rows:[{primary_operational_role:'SUPERVISOR'}]};
  if(sql.includes('FOR UPDATE'))return {rows:[{primary_operational_role:'ADMIN'}]};writes++;return {rows:[]};
 }})});await assert.rejects(service.updateStatus('admin-A','SUSPENDED','test','manager-A'),e=>e.getStatus()===403);assert.equal(writes,0);
});
