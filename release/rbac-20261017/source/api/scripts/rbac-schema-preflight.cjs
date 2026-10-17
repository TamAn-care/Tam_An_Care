'use strict';
// Metadata only; never runs DDL, DML, migrations, seeds or application bootstrap.
const fs=require('node:fs');
const {Client}=require('pg');
const crypto=require('node:crypto'),path=require('node:path');
const {ResidentAccessScopeService}=require('../dist/resident-access-scope/resident-access-scope.service');
function digest(){const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(p.endsWith('.ts'))files.push(p);}}walk(path.join(__dirname,'../src'));const hash=crypto.createHash('sha256');for(const file of files.sort()){hash.update(path.relative(path.join(__dirname,'..'),file));hash.update(fs.readFileSync(file));}return hash.digest('hex');}
function report(data){const out={...data,run_at:new Date().toISOString(),source_digest:digest()};fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../test-results/rbac-schema-preflight.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out));}
async function main(){
 const env={...process.env};const i=process.argv.indexOf('--env-file');
 if(i>=0){for(const line of fs.readFileSync(process.argv[i+1],'utf8').split(/\r?\n/)){
  const m=line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m||env[m[1]])continue;
  let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);env[m[1]]=v;
 }}
 const client=new Client(env.DATABASE_URL?{connectionString:env.DATABASE_URL,connectionTimeoutMillis:4000}:{host:env.DB_HOST||'127.0.0.1',port:Number(env.DB_PORT||5432),user:env.POSTGRES_USER||env.DB_USER,password:env.POSTGRES_PASSWORD||env.DB_PASSWORD,database:env.POSTGRES_DB||env.DB_NAME,connectionTimeoutMillis:4000});
 try{
  await client.connect();await client.query('BEGIN READ ONLY');await client.query("SET LOCAL statement_timeout = '5s'");
  const rows=(await client.query(`SELECT t.relname, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname IN ('staff_actors','resident_access_assignments') AND c.contype='c'`)).rows;
  const failures=[];
  for(const [table,column,values] of [['staff_actors','primary_operational_role',['NURSE','CAREGIVER','SUPERVISOR','GUARDIAN','PSYCHOLOGIST','SOCIAL_WORKER']],['resident_access_assignments','actor_role',['NURSE','CAREGIVER','GUARDIAN','PSYCHOLOGIST','SOCIAL_WORKER']],['resident_access_assignments','access_scope',['DIRECT_CARE','CLINICAL_CARE','FAMILY_PORTAL','PSYCHOSOCIAL_CARE']]]){
   const checks=rows.filter(r=>r.relname===table&&r.definition.includes(column));
   if(!checks.length||checks.some(c=>values.some(v=>!c.definition.includes("'"+v+"'"))))failures.push(table+'.'+column);
  }
  const expected={shift_swap_requests:['swap_request_id'],staff_recognitions:['recognition_id'],notifications:['notification_id'],push_subscriptions:['subscription_id'],operational_work_event_types:['work_event_type_id'],auth_sessions:['session_id','actor_id','actor_role','revoked_at','expires_at','issued_at'],staff_actors:['actor_id','primary_operational_role','status','updated_at'],resident_access_assignments:['resident_id','actor_id','actor_role','access_scope','status','effective_from','effective_to'],clinical_observations:['clinical_observation_id','resident_id','observation_code','numeric_value','recorded_by','recorded_by_role'],clinical_audit:['audit_id','event_sequence','clinical_observation_id','event_type']};
  const columns=(await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])",[Object.keys(expected)])).rows;
  for(const [table,names] of Object.entries(expected))for(const name of names)if(!columns.some(r=>r.table_name===table&&r.column_name===name))failures.push(table+'.'+name);
  let semantics=0;
  const scope=new ResidentAccessScopeService({},{});
  for(const role of ['NURSE','CAREGIVER','GUARDIAN','PSYCHOLOGIST','SOCIAL_WORKER','SUPERVISOR']) {
   const predicate=scope.sqlPredicate('r','actor-A',role);
   const scopes={NURSE:'CLINICAL_CARE',CAREGIVER:'DIRECT_CARE',GUARDIAN:'FAMILY_PORTAL',PSYCHOLOGIST:'PSYCHOSOCIAL_CARE',SOCIAL_WORKER:'PSYCHOSOCIAL_CARE'};
   for(const variant of ['allowed','cross-resident','inactive','old-role','inactive-resident',...(role==='SUPERVISOR'?[]:['revoked','expired','future','wrong-scope'])]) {
    const actorStatus=variant==='inactive'?'INACTIVE':'ACTIVE';
    const currentRole=variant==='old-role'?'UNKNOWN':role;
    const assignmentStatus=variant==='revoked'?'REVOKED':'ACTIVE';
    const assignedScope=variant==='wrong-scope'?'UNKNOWN':scopes[role]||'DIRECT_CARE';
    const from=variant==='future'?"NOW()+interval '1 hour'":"NOW()-interval '1 hour'";
    const to=variant==='expired'?"NOW()-interval '1 second'":"NULL::timestamptz";
    const residentActive=variant==='inactive-resident'?'false':'true';
    const sql=`WITH staff_actors(actor_id,status,primary_operational_role) AS (VALUES ('actor-A'::text,'${actorStatus}'::text,'${currentRole}'::text)),
      residents(resident_id,active_status) AS (VALUES ('resident-A'::text,${residentActive})),
      resident_access_assignments(resident_id,actor_id,actor_role,access_scope,status,effective_from,effective_to) AS
        (VALUES ('resident-A'::text,'actor-A'::text,'${role}'::text,'${assignedScope}'::text,'${assignmentStatus}'::text,${from},${to}))
      SELECT 1 FROM residents r WHERE (${predicate.sql}) AND r.resident_id=$${predicate.nextParameter}`;
    const result=await client.query(sql,[...predicate.params,variant==='cross-resident'?'resident-B':'resident-A']);
    if(result.rowCount!==(variant==='allowed'?1:0))failures.push('sql-semantics:'+role+':'+variant);
    semantics++;
   }
  }
  await client.query('ROLLBACK');
  report({check:'rbac-schema-read-only',status:failures.length?'BLOCKED':'PASS',missing:failures,postgresqlScopeCases:semantics});
  if(failures.length)process.exitCode=1;
 }catch(e){report({check:'rbac-schema-read-only',status:'BLOCKED',reason:e.code||'CONNECTION_UNAVAILABLE'});process.exitCode=1;}finally{await client.end().catch(()=>{});}
}
main().catch(()=>{console.log('SCHEMA_PREFLIGHT=BLOCKED');process.exitCode=1;});
