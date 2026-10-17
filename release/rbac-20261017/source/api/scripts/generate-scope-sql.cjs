'use strict';
const fs=require('node:fs');
const {ResidentAccessScopeService}=require('../dist/resident-access-scope/resident-access-scope.service');
const scope=new ResidentAccessScopeService({},{});
const queries=['BEGIN READ ONLY;',"SET LOCAL statement_timeout = '5s';"];
for(const role of ['NURSE','CAREGIVER','GUARDIAN','PSYCHOLOGIST','SOCIAL_WORKER','SUPERVISOR']){
 const predicate=scope.sqlPredicate('r','actor-A',role);
 const scopes={NURSE:'CLINICAL_CARE',CAREGIVER:'DIRECT_CARE',GUARDIAN:'FAMILY_PORTAL',PSYCHOLOGIST:'PSYCHOSOCIAL_CARE',SOCIAL_WORKER:'PSYCHOSOCIAL_CARE'};
 for(const variant of ['allowed','cross-resident','inactive','old-role','inactive-resident',...(role==='SUPERVISOR'?[]:['revoked','expired','future','wrong-scope'])]){
  const from=variant==='future'?"NOW()+interval '1 hour'":"NOW()-interval '1 hour'";
  const to=variant==='expired'?"NOW()-interval '1 second'":"NULL::timestamptz";
  let sql=`WITH staff_actors(actor_id,status,primary_operational_role) AS (VALUES ('actor-A'::text,'${variant==='inactive'?'INACTIVE':'ACTIVE'}'::text,'${variant==='old-role'?'UNKNOWN':role}'::text)),
   residents(resident_id,active_status) AS (VALUES ('resident-A'::text,${variant==='inactive-resident'?'false':'true'})),
   resident_access_assignments(resident_id,actor_id,actor_role,access_scope,status,effective_from,effective_to) AS (VALUES
   ('resident-A'::text,'actor-A'::text,'${role}'::text,'${variant==='wrong-scope'?'UNKNOWN':scopes[role]||'DIRECT_CARE'}'::text,'${variant==='revoked'?'REVOKED':'ACTIVE'}'::text,${from},${to}))
   SELECT CASE WHEN COUNT(*)=${variant==='allowed'?1:0} THEN 'PASS:${role}:${variant}' ELSE 'FAIL:${role}:${variant}' END FROM residents r
   WHERE (${predicate.sql}) AND r.resident_id=$${predicate.nextParameter};`;
  const params=[...predicate.params,variant==='cross-resident'?'resident-B':'resident-A'];
  sql=sql.replace(/\$(\d+)/g,(_,n)=>"'"+params[Number(n)-1].replaceAll("'","''")+"'");queries.push(sql);
 }
}
queries.push('ROLLBACK;');fs.writeFileSync(process.argv[2],queries.join('\n'));
