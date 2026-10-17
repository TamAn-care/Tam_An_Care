'use strict';
// Explicit isolated config is mandatory. No connection to Production Test is permitted.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Pool}=require('pg');
const {Test}=require('@nestjs/testing');
const {Module}=require('@nestjs/common');
const migration=require('../scripts/rbac-migrate.cjs');
const configFile=process.env.RBAC_ISOLATED_CONFIG;
if(!configFile)throw Error('RBAC_ISOLATED_CONFIG_REQUIRED');
const config=JSON.parse(fs.readFileSync(configFile));
const outcomes=[];
async function check(name,fn){try{await fn();outcomes.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){outcomes.push({name,status:'FAIL',error:e.message});throw e;}}
const types={
 HealthReportService:require('../dist/health-reports/health-report.service').HealthReportService,
 HealthReportController:require('../dist/health-reports/health-report.controller').HealthReportController,
 DatabaseService:require('../dist/database/database.service').DatabaseService,
 StaffActorService:require('../dist/staff-actors/staff-actor.service').StaffActorService,
 StaffActorController:require('../dist/staff-actors/staff-actor.controller').StaffActorController,
 ResidentAccessScopeService:require('../dist/resident-access-scope/resident-access-scope.service').ResidentAccessScopeService,
 GuardianResidentService:require('../dist/resident-access-scope/guardian-resident.service').GuardianResidentService,
 GuardianResidentController:require('../dist/resident-access-scope/guardian-resident.controller').GuardianResidentController,
 AssignedResidentController:require('../dist/resident-access-scope/assigned-resident.controller').AssignedResidentController,
 AuthService:require('../dist/auth/auth.service').AuthService,
 AuthController:require('../dist/auth/auth.controller').AuthController,
 ResidentService:require('../dist/residents/resident.service').ResidentService,
 ResidentRepository:require('../dist/residents/resident.repository').ResidentRepository,
 ResidentController:require('../dist/residents/resident.controller').ResidentController,
 CrossDomainIntegrationService:require('../dist/cross-domain-integration/cross-domain-integration.service').CrossDomainIntegrationService,
 OperationalCareViewService:require('../dist/operational-care-view/operational-care-view.service').OperationalCareViewService,
 OperationalCareViewController:require('../dist/operational-care-view/operational-care-view.controller').OperationalCareViewController,
 ClinicalRepository:require('../dist/clinical-observations/clinical.repository').ClinicalRepository,
 VitalSignService:require('../dist/clinical-observations/vital-sign.service').VitalSignService,
 VitalSignController:require('../dist/clinical-observations/vital-sign.controller').VitalSignController,
};
const {ProductionAuthMiddleware}=require('../dist/security/production-auth.middleware');
async function assignment(db,role,resident='test-rbac-res-A',scope){
 scope=scope||{NURSE:'CLINICAL_CARE',CAREGIVER:'DIRECT_CARE',GUARDIAN:'FAMILY_PORTAL',PSYCHOLOGIST:'PSYCHOSOCIAL_CARE',SOCIAL_WORKER:'PSYCHOSOCIAL_CARE'}[role];
 return db.query(`INSERT INTO resident_access_assignments(resident_access_assignment_id,resident_id,actor_id,actor_role,access_scope,status,effective_from,assigned_by,assigned_by_role,assigned_at)
 VALUES($1,$2,$3,$4,$5,'ACTIVE',clock_timestamp()-interval '1 hour','test-rbac-SUPERVISOR','SUPERVISOR',clock_timestamp())`,[crypto.randomUUID(),resident,'test-rbac-'+role,role,scope]);
}
async function fingerprint(database){
 const c=await migration.connect({...config,database});try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'rbac_schema_migration%' ORDER BY tablename")).rows;
  const digest=crypto.createHash('sha256');let rows=0;
  for(const {tablename}of tables){const name='"'+tablename.replaceAll('"','""')+'"';
   const r=(await c.query(`SELECT count(*)::text AS count,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) AS digest FROM public.${name} t`)).rows[0];
   digest.update(JSON.stringify([tablename,r.count,r.digest]));rows+=Number(r.count);
  }
  const sequences=(await c.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' AND sequencename NOT LIKE 'rbac_schema_migration%' ORDER BY sequencename")).rows;
  digest.update(JSON.stringify(sequences));await c.query('ROLLBACK');return {tables:tables.length,rows,digest:digest.digest('hex')};
 }finally{await c.end();}
}
async function main(){
 process.env.NODE_ENV='production';process.env.JWT_SECRET='isolated-postgresql-api-nonproduction-secret-000001';
 await check('Safety guard rejects live database names',async()=>{await assert.rejects(migration.connect({...config,database:'taman_care'}),/ISOLATED_DATABASE_CONFIG_REQUIRED/);});
 await check('Safety guard rejects foreign cluster identifier',async()=>{await assert.rejects(migration.connect({...config,systemIdentifier:'0'}),/ISOLATED_CLUSTER_ID_MISMATCH/);});
 let baseline;
 await check('Backup restores twice with identical business data and sequences',async()=>{baseline=await fingerprint(config.restoreCheck||'rbac_restore_check');assert.deepEqual(await fingerprint(config.restoreRoundtrip||'rbac_restore_roundtrip'),baseline);assert.ok(baseline.tables>20);});
 let original, snapshotAlreadyMigrated=false;
 await check('Migration preserves restored real snapshot business data',async()=>{
  const c=await migration.connect({...config,database:config.restoreCheck||'rbac_restore_check'});
  const tracked=(await c.query('SELECT state,previous_constraints FROM rbac_schema_migrations WHERE version=$1',[migration.VERSION])).rows[0];
  snapshotAlreadyMigrated=tracked?.state==='APPLIED';
  original=snapshotAlreadyMigrated?tracked.previous_constraints:await migration.constraints(c);
  original.sort((a,b)=>a.conname.localeCompare(b.conname));await c.end();
  const applied=await migration.migrate({...config,database:config.restoreCheck||'rbac_restore_check'},'up');
  assert.equal(applied.result,snapshotAlreadyMigrated?'ALREADY_APPLIED':'PASS');
  assert.deepEqual(await fingerprint(config.restoreCheck||'rbac_restore_check'),baseline);
 });
 await check('Rollback preserves snapshot data and restores exact constraints',async()=>{
  assert.equal((await migration.migrate({...config,database:config.restoreCheck||'rbac_restore_check'},'down')).result,'PASS');
  assert.deepEqual(await fingerprint(config.restoreCheck||'rbac_restore_check'),baseline);
  const c=await migration.connect({...config,database:config.restoreCheck||'rbac_restore_check'});assert.deepEqual(await migration.constraints(c),original);await c.end();
 });
 await check('Rollback and reapply are idempotent on restored snapshot',async()=>{
  assert.equal((await migration.migrate({...config,database:config.restoreCheck||'rbac_restore_check'},'down')).result,'ALREADY_ROLLED_BACK');
  await migration.migrate({...config,database:config.restoreCheck||'rbac_restore_check'},'up');
  assert.equal((await migration.migrate({...config,database:config.restoreCheck||'rbac_restore_check'},'up')).result,'ALREADY_APPLIED');
  assert.deepEqual(await fingerprint(config.restoreCheck||'rbac_restore_check'),baseline);
 });
 const verified=await migration.connect(config);await verified.end();
 const pool=new Pool({host:config.host,user:config.user,database:config.database,max:4});
 const db=Object.create(types.DatabaseService.prototype);db.pool=pool;
 let app;
 try{
  const password='isolated-fixture-password-only';
  for(const role of ['ADMIN','SUPERVISOR','GUARDIAN','NURSE','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER']){
   const id='test-rbac-'+role,salt='isolated-salt-'+role;
   await db.query(`INSERT INTO staff_actors(actor_id,staff_code,display_name,primary_operational_role,status,department,email,phone)
      VALUES($1,$1,$2,$3,'ACTIVE','ISOLATED TEST','','')`,[id,'ISOLATED '+role,role]);
   await db.query(`INSERT INTO auth_credentials(actor_id,password_hash,password_salt,password_iterations,password_digest)
      VALUES($1,$2,$3,1000,'sha256')`,[id,crypto.pbkdf2Sync(password,salt,1000,32,'sha256').toString('hex'),salt]);
  }
  for(const suffix of ['A','B'])await db.query(`INSERT INTO residents(resident_id,resident_code,display_name,date_of_birth,gender,care_level,active_status)
    VALUES($1,$2,$3,'1940-01-01','UNSPECIFIED','ASSISTED',true)`,['test-rbac-res-'+suffix,'TEST-RBAC-'+suffix,'ISOLATED RESIDENT '+suffix]);
  await assignment(db,'NURSE');await assignment(db,'CAREGIVER');
  await check('Before migration Guardian assignment is rejected',async()=>{await assert.rejects(assignment(db,'GUARDIAN'),e=>e.code==='23514');});
  await check('Existing resident foreign key rejects missing resident',async()=>{await assert.rejects(assignment(db,'NURSE','test-rbac-missing'),e=>e.code==='23503');});
  let before;
  before=(await db.query('SELECT * FROM resident_access_assignments ORDER BY resident_access_assignment_id')).rows;
  await check('Concurrent migration serializes with one application',async()=>{
   const r=await Promise.all([migration.migrate(config,'up'),migration.migrate(config,'up')]);
   assert.deepEqual(r.map(x=>x.result).sort(),['ALREADY_APPLIED','PASS']);
   assert.deepEqual((await db.query('SELECT * FROM resident_access_assignments ORDER BY resident_access_assignment_id')).rows,before);
  });
  for(const role of ['GUARDIAN','PSYCHOLOGIST','SOCIAL_WORKER'])await check('New exact scope accepted: '+role,async()=>assignment(db,role));
  await check('Role and scope mismatch remains rejected',async()=>{await assert.rejects(assignment(db,'GUARDIAN','test-rbac-res-B','CLINICAL_CARE'),e=>e.code==='23514');});
  await check('Rollback with new assignments stops without deleting any data',async()=>{
   const count=(await db.query('SELECT count(*)::int n FROM resident_access_assignments')).rows[0].n;
   await assert.rejects(migration.migrate(config,'down'),/RBAC_ROLLBACK_UNSAFE_NEW_ASSIGNMENTS/);
   assert.equal((await db.query('SELECT count(*)::int n FROM resident_access_assignments')).rows[0].n,count);
   assert.equal((await db.query('SELECT state FROM rbac_schema_migrations')).rows[0].state,'APPLIED');
  });
  await check('Modified migration checksum is refused',async()=>{
   const saved=(await db.query('SELECT checksum FROM rbac_schema_migrations')).rows[0].checksum;
   await db.query("UPDATE rbac_schema_migrations SET checksum='tampered-test-only'");
   try{await assert.rejects(migration.migrate(config,'up'),/MIGRATION_CHECKSUM_MISMATCH/);}finally{await db.query('UPDATE rbac_schema_migrations SET checksum=$1',[saved]);}
  });
  await check('Schema drift is refused without overwriting changes',async()=>{
   const saved=await migration.constraints(pool);
   await db.query("ALTER TABLE resident_access_assignments DROP CONSTRAINT resident_access_assignments_actor_role_check");
   await db.query("ALTER TABLE resident_access_assignments ADD CONSTRAINT resident_access_assignments_actor_role_check CHECK(actor_role <> '')");
   try{await assert.rejects(migration.migrate(config,'up'),/MIGRATION_SCHEMA_DRIFT/);}finally{
    await db.query('ALTER TABLE resident_access_assignments DROP CONSTRAINT resident_access_assignments_actor_role_check');
    const row=saved.find(r=>r.conname==='resident_access_assignments_actor_role_check');
    await db.query('ALTER TABLE resident_access_assignments ADD CONSTRAINT '+row.conname+' '+row.definition);
   }
  });
  const controllers=['HealthReportController','AuthController','StaffActorController','GuardianResidentController','AssignedResidentController','ResidentController','OperationalCareViewController','VitalSignController'].map(k=>types[k]);
  const providers=['HealthReportService','AuthService','StaffActorService','ResidentAccessScopeService','GuardianResidentService','ResidentService','ResidentRepository','CrossDomainIntegrationService','OperationalCareViewService','ClinicalRepository','VitalSignService'].map(k=>types[k]);
  class IntegrationModule{configure(consumer){consumer.apply(ProductionAuthMiddleware).forRoutes('*');}}
  Module({controllers,providers:[{provide:types.DatabaseService,useValue:db},...providers]})(IntegrationModule);
  const module=await Test.createTestingModule({imports:[IntegrationModule]}).compile();app=module.createNestApplication({logger:false});await app.listen(0,'127.0.0.1');
  const base=await app.getUrl(),tokens={};
  async function request(path,role,method='GET',body,headers={}){
   return fetch(base+path,{method,headers:{...(tokens[role]?{Authorization:'Bearer '+tokens[role]}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
  }
  async function login(role){const r=await request('/api/auth/login',null,'POST',{actorId:'test-rbac-'+role,password});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));const data=await r.json();tokens[role]=data.accessToken;return data;}
  await check('Real password login rejects wrong password',async()=>{const r=await request('/api/auth/login',null,'POST',{actorId:'test-rbac-NURSE',password:'wrong'});assert.equal(r.status,401);});
  for(const role of ['ADMIN','SUPERVISOR','GUARDIAN','NURSE','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER'])await check('Real JWT and session issued: '+role,async()=>{const r=await login(role);assert.equal(r.actor.actorRole,role);});
  let reportId;
  await check('Health report create and PUT persist with audit; client status ignored',async()=>{
   const created=await request('/api/health-reports','NURSE','POST',{residentId:'test-rbac-res-A',reportType:'MONTHLY',periodStart:'2026-10-01',periodEnd:'2026-10-16',summary:'ISOLATED',initialStatus:'APPROVED'});
   assert.equal(created.status,201,JSON.stringify(await created.clone().json()));const row=await created.json();reportId=row.health_report_id;assert.equal(row.status,'DRAFT');
   const edited=await request('/api/health-reports/'+reportId,'NURSE','PUT',{summary:'ISOLATED UPDATED',status:'APPROVED'});assert.equal(edited.status,200,JSON.stringify(await edited.clone().json()));const updated=await edited.json();assert.equal(updated.summary,'ISOLATED UPDATED');assert.equal(updated.status,'DRAFT');assert.equal(updated.report_version,2);
   assert.equal((await db.query("SELECT count(*)::int n FROM health_report_audit WHERE health_report_id=$1 AND event_type='REPORT_UPDATED'",[reportId])).rows[0].n,1);
  });
  await check('Health report update denies cross resident and Guardian',async()=>{
   const created=await request('/api/health-reports','ADMIN','POST',{residentId:'test-rbac-res-B',reportType:'MONTHLY',periodStart:'2026-10-01',periodEnd:'2026-10-16'});assert.equal(created.status,201);const other=await created.json();
   assert.equal((await request('/api/health-reports/'+other.health_report_id,'NURSE','PUT',{summary:'FORBIDDEN'})).status,404);
   assert.equal((await request('/api/health-reports/'+reportId,'GUARDIAN','PUT',{summary:'FORBIDDEN'})).status,403);
   assert.equal((await db.query('SELECT summary FROM health_reports WHERE health_report_id=$1',[other.health_report_id])).rows[0].summary,null);
  });
  await check('No JWT is denied by HTTP middleware',async()=>assert.equal((await request('/api/residents/test-rbac-res-A',null)).status,401));
  await check('Guardian list is restricted to linked resident A',async()=>{const r=await request('/api/family-portal/residents','GUARDIAN');assert.equal(r.status,200);assert.deepEqual((await r.json()).map(x=>x.residentId),['test-rbac-res-A']);});
  await check('Guardian detail A allowed and B denied',async()=>{assert.equal((await request('/api/family-portal/residents/test-rbac-res-A','GUARDIAN')).status,200);assert.equal((await request('/api/family-portal/residents/test-rbac-res-B','GUARDIAN')).status,404);});
  await check('Guardian cannot spoof staff headers',async()=>{assert.equal((await request('/api/residents/test-rbac-res-A','GUARDIAN','GET',undefined,{'x-actor-role':'NURSE','x-actor-id':'test-rbac-NURSE'})).status,403);});
  for(const role of ['NURSE','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER']){
   await check(role+' assigned list contains A only',async()=>{const r=await request('/api/operations/residents/assigned',role);assert.equal(r.status,200);assert.deepEqual((await r.json()).map(x=>x.resident.residentId),['test-rbac-res-A']);});
   await check(role+' resident A and care view allowed; B denied',async()=>{assert.equal((await request('/api/residents/test-rbac-res-A',role)).status,200);assert.equal((await request('/api/operations/residents/test-rbac-res-A/care-view',role)).status,200);assert.equal((await request('/api/residents/test-rbac-res-B',role)).status,403);assert.equal((await request('/api/operations/residents/test-rbac-res-B/care-view',role)).status,404);});
   await check(role+' global resident listing denied',async()=>assert.equal((await request('/api/residents',role)).status,403));
  }
  const payload={measuredAt:new Date().toISOString(),measurements:{heartRate:72,temp:36.5},note:'ISOLATED TEST'};
  await check('Assigned nurse writes real measurements and audit',async()=>{const r=await request('/api/residents/test-rbac-res-A/vital-signs','NURSE','POST',payload);assert.equal(r.status,201,JSON.stringify(await r.clone().json()));assert.equal((await r.json()).recorded.length,2);assert.equal((await db.query('SELECT count(*)::int n FROM clinical_observations')).rows[0].n,2);assert.equal((await db.query('SELECT count(*)::int n FROM clinical_audit')).rows[0].n,2);});
  await check('Nurse cannot write measurements for resident B',async()=>assert.equal((await request('/api/residents/test-rbac-res-B/vital-signs','NURSE','POST',payload)).status,404));
  for(const role of ['GUARDIAN','CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER'])await check(role+' cannot record clinical measurements',async()=>assert.equal((await request('/api/residents/test-rbac-res-A/vital-signs',role,'POST',payload)).status,403));
  await check('Real transaction rolls back measurements on audit failure',async()=>{
   await db.query("CREATE FUNCTION rbac_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'ISOLATED_TEST_AUDIT_FAILURE'; END;$$");
   await db.query('CREATE TRIGGER rbac_test_audit_failure BEFORE INSERT ON clinical_audit FOR EACH ROW EXECUTE FUNCTION rbac_test_audit_failure()');
   try{assert.equal((await request('/api/residents/test-rbac-res-A/vital-signs','NURSE','POST',payload)).status,500);assert.equal((await db.query('SELECT count(*)::int n FROM clinical_observations')).rows[0].n,2);}finally{await db.query('DROP TRIGGER rbac_test_audit_failure ON clinical_audit');await db.query('DROP FUNCTION rbac_test_audit_failure()');}
  });
  await check('Clinical value redaction is applied to nonclinical care roles',async()=>{for(const role of ['CAREGIVER','PSYCHOLOGIST','SOCIAL_WORKER']){const r=await request('/api/operations/residents/test-rbac-res-A/care-view',role);const data=await r.json();assert.equal(data.clinical.length,2);assert.ok(data.clinical.every(x=>x.numericValue===undefined&&x.textValue===undefined));}});
  await check('Guardian link revocation takes effect on next HTTP request',async()=>{await db.query("UPDATE resident_access_assignments SET status='REVOKED',revoked_at=clock_timestamp() WHERE actor_role='GUARDIAN'");assert.deepEqual(await (await request('/api/family-portal/residents','GUARDIAN')).json(),[]);assert.equal((await request('/api/family-portal/residents/test-rbac-res-A','GUARDIAN')).status,404);});
  await check('Expired and future specialist assignments deny access',async()=>{await db.query("UPDATE resident_access_assignments SET effective_to=clock_timestamp()-interval '1 second' WHERE actor_role='PSYCHOLOGIST'");assert.equal((await request('/api/operations/residents/test-rbac-res-A/care-view','PSYCHOLOGIST')).status,404);await db.query("UPDATE resident_access_assignments SET effective_from=clock_timestamp()+interval '1 hour' WHERE actor_role='SOCIAL_WORKER'");assert.equal((await request('/api/operations/residents/test-rbac-res-A/care-view','SOCIAL_WORKER')).status,404);});
  await check('Account deactivation revokes real database sessions',async()=>{assert.equal((await request('/api/operations/staff-actors/test-rbac-NURSE/status','SUPERVISOR','POST',{status:'SUSPENDED',reason:'ISOLATED TEST'})).status,201);assert.equal((await request('/api/residents/test-rbac-res-A','NURSE')).status,401);assert.equal((await db.query("SELECT count(*)::int n FROM auth_sessions WHERE actor_id='test-rbac-NURSE' AND revoked_at IS NULL")).rows[0].n,0);});
  await check('Reactivation does not revive old login sessions',async()=>{assert.equal((await request('/api/operations/staff-actors/test-rbac-NURSE/status','SUPERVISOR','POST',{status:'ACTIVE',reason:'ISOLATED TEST'})).status,201);assert.equal((await request('/api/residents/test-rbac-res-A','NURSE')).status,401);await login('NURSE');assert.equal((await request('/api/residents/test-rbac-res-A','NURSE')).status,200);});
  await check('Old role session stays denied even if role changes back',async()=>{await db.query("UPDATE staff_actors SET primary_operational_role='CAREGIVER',updated_at=clock_timestamp() WHERE actor_id='test-rbac-NURSE'");assert.equal((await request('/api/residents/test-rbac-res-A','NURSE')).status,401);await db.query("UPDATE staff_actors SET primary_operational_role='NURSE',updated_at=clock_timestamp() WHERE actor_id='test-rbac-NURSE'");assert.equal((await request('/api/residents/test-rbac-res-A','NURSE')).status,401);await login('NURSE');assert.equal((await request('/api/residents/test-rbac-res-A','NURSE')).status,200);});
  await check('Logout revokes the persisted session',async()=>{assert.equal((await request('/api/auth/logout','NURSE','POST')).status,204);assert.equal((await request('/api/residents/test-rbac-res-A','NURSE')).status,401);});
  await check('Advisory lock timeout leaves applied migration intact',async()=>{const blocker=await migration.connect(config);await blocker.query('BEGIN');await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended('tamancare.rbac.schema',0))");try{await assert.rejects(migration.migrate(config,'up'),e=>e.code==='55P03');}finally{await blocker.query('ROLLBACK');await blocker.end();}assert.equal((await migration.migrate(config,'up')).result,'ALREADY_APPLIED');});
 }finally{if(app)await app.close();else await pool.end();}
 return {backupRestoration:baseline,tests:outcomes,postgresql:true,migrationVersion:migration.VERSION,migrationChecksum:migration.checksum(),productionModified:false};
}
main().then(result=>{fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/rbac-postgres-integration.json',JSON.stringify({...result,status:'PASS',run_at:new Date().toISOString()},null,2));console.log('POSTGRESQL_INTEGRATION=PASS cases='+outcomes.length);}).catch(error=>{fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/rbac-postgres-integration.json',JSON.stringify({status:'FAIL',tests:outcomes,error:error.message,run_at:new Date().toISOString()},null,2));console.error(error.stack);process.exitCode=1;});
