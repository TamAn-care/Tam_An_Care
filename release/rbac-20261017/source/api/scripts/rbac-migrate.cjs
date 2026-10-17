'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Client}=require('pg');
const VERSION='20261016_001_resident_scope';
const NAMES=['resident_access_assignments_actor_role_check','resident_access_assignments_access_scope_check','resident_access_role_scope_check'];
const sqlPath=path.join(__dirname,'../../database/rbac-migrations',VERSION+'.up.sql');
function checksum(){return crypto.createHash('sha256').update(fs.readFileSync(sqlPath)).digest('hex');}
async function constraints(client){
 const result=await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition,convalidated FROM pg_constraint
   WHERE conrelid='public.resident_access_assignments'::regclass AND conname=ANY($1::text[]) ORDER BY conname`,[NAMES]);
 if(result.rows.length!==3||result.rows.some(r=>!r.convalidated))throw Error('RBAC_CONSTRAINTS_MISSING_OR_UNVALIDATED');
 return result.rows;
}
function equal(a,b){const normalized=rows=>rows.map(r=>[r.conname,r.definition,r.convalidated]).sort((x,y)=>x[0].localeCompare(y[0]));return JSON.stringify(normalized(a))===JSON.stringify(normalized(b));}
async function connect(config){
 if(!config.host?.startsWith('/home/ag/tamancare-rbac-safe-migration-')||!config.host.endsWith('/socket')||
   !/^rbac_(test|restore)_[a-z0-9_]+$/.test(config.database)||!/^\d+$/.test(config.systemIdentifier||'')) {
  throw Error('ISOLATED_DATABASE_CONFIG_REQUIRED');
 }
 const client=new Client({host:config.host,user:config.user,database:config.database,connectionTimeoutMillis:5000});
 await client.connect();
 try{
  const actual=(await client.query('SELECT system_identifier::text AS id FROM pg_control_system()')).rows[0].id;
  if(actual!==config.systemIdentifier)throw Error('ISOLATED_CLUSTER_ID_MISMATCH');
  return client;
 }catch(error){await client.end();throw error;}
}
async function migrate(config,direction){
 if(!['up','down','status'].includes(direction))throw Error('INVALID_MIGRATION_DIRECTION');
 const client=await connect(config);
 try{
  if(direction==='status')return {version:VERSION,constraints:await constraints(client)};
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='30s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('tamancare.rbac.schema',0))");
  await client.query(`CREATE TABLE IF NOT EXISTS public.rbac_schema_migrations (
    version text PRIMARY KEY,checksum text NOT NULL,state text NOT NULL CHECK(state IN ('APPLIED','ROLLED_BACK')),
    previous_constraints jsonb NOT NULL,applied_constraints jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS public.rbac_schema_migration_events (
    event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,version text NOT NULL,direction text NOT NULL,
    checksum text NOT NULL,performed_by text NOT NULL DEFAULT current_user,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
  )`);
  await client.query('LOCK TABLE public.resident_access_assignments IN ACCESS EXCLUSIVE MODE');
  const row=(await client.query('SELECT * FROM public.rbac_schema_migrations WHERE version=$1 FOR UPDATE',[VERSION])).rows[0];
  const digest=checksum(),before=await constraints(client);
  if(row&&row.checksum!==digest)throw Error('MIGRATION_CHECKSUM_MISMATCH');
  if(row&&((direction==='up'&&row.state==='APPLIED')||(direction==='down'&&row.state==='ROLLED_BACK'))){
   const expected=direction==='up'?row.applied_constraints:row.previous_constraints;
   if(!equal(before,expected))throw Error('MIGRATION_SCHEMA_DRIFT');
   await client.query('COMMIT');return {version:VERSION,direction,result:'ALREADY_'+row.state};
  }
  if(direction==='up'){
   if(row&&!equal(before,row.previous_constraints))throw Error('MIGRATION_SCHEMA_DRIFT');
   await client.query(fs.readFileSync(sqlPath,'utf8'));
   const after=await constraints(client);
   await client.query(`INSERT INTO public.rbac_schema_migrations(version,checksum,state,previous_constraints,applied_constraints)
     VALUES ($1,$2,'APPLIED',$3::jsonb,$4::jsonb)
     ON CONFLICT(version) DO UPDATE SET state='APPLIED',updated_at=clock_timestamp()`,
     [VERSION,digest,JSON.stringify(before),JSON.stringify(after)]);
  }else{
   if(!row)throw Error('MIGRATION_NOT_APPLIED');
   if(!equal(before,row.applied_constraints))throw Error('MIGRATION_SCHEMA_DRIFT');
   const incompatible=(await client.query(`SELECT EXISTS(SELECT 1 FROM public.resident_access_assignments
     WHERE NOT ((actor_role='CAREGIVER' AND access_scope='DIRECT_CARE') OR
                (actor_role='NURSE' AND access_scope='CLINICAL_CARE'))) AS blocked`)).rows[0].blocked;
   if(incompatible)throw Error('RBAC_ROLLBACK_UNSAFE_NEW_ASSIGNMENTS');
   for(const constraint of row.previous_constraints){
    if(!NAMES.includes(constraint.conname)||!constraint.definition.startsWith('CHECK '))throw Error('INVALID_ROLLBACK_METADATA');
    await client.query('ALTER TABLE public.resident_access_assignments DROP CONSTRAINT '+constraint.conname);
    await client.query('ALTER TABLE public.resident_access_assignments ADD CONSTRAINT '+constraint.conname+' '+constraint.definition);
   }
   await client.query("UPDATE public.rbac_schema_migrations SET state='ROLLED_BACK',updated_at=clock_timestamp() WHERE version=$1",[VERSION]);
  }
  await client.query('INSERT INTO public.rbac_schema_migration_events(version,direction,checksum) VALUES ($1,$2,$3)',[VERSION,direction,digest]);
  await client.query('COMMIT');return {version:VERSION,direction,result:'PASS',checksum:digest};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{await client.end();}
}
module.exports={migrate,connect,constraints,VERSION,checksum};
if(require.main===module){
 const i=process.argv.indexOf('--config');
 if(i<0)throw Error('Explicit isolated --config is required');
 migrate(JSON.parse(fs.readFileSync(process.argv[i+1])),process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error('MIGRATION_FAILED='+e.message);process.exitCode=1;});
}
