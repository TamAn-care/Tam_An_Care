const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
// The isolated test exercises the compiled service with controlled actor/scope
// collaborators; the full production DI graph is intentionally not loaded.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (['../database/database.service','../staff-actors/staff-actor.service',
        '../resident-access-scope/resident-access-scope.service'].includes(request)
      && parent?.filename?.endsWith('resident-meal-registration.service.js')) {
    const symbol = request.includes('/database/') ? 'DatabaseService'
      : request.includes('/staff-actors/') ? 'StaffActorService' : 'ResidentAccessScopeService';
    return { [symbol]: class TestDependencyToken {} };
  }
  return originalLoad.apply(this,arguments);
};
let ResidentMealRegistrationService;
try {
  ({ResidentMealRegistrationService} = require('../dist/kitchen-operations/resident-meal-registration.service.js'));
} finally {
  Module._load = originalLoad;
}

const pool = new Pool({connectionString: process.env.TEST_MEAL_DATABASE_URL});
const db = {
  query: (sql, params) => pool.query(sql, params),
  withTransaction: async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const r=await fn(client); await client.query('COMMIT'); return r; }
    catch(e){ await client.query('ROLLBACK'); throw e; }
    finally {client.release();}
  }
};
const staff = {resolveActiveActorWithRole:async(id,role) =>
  ['cg-one','cg-two','manager','nutrition','director'].includes(id) ? {actorId:id,role} : null};
const scope = {canAccessResident:async(id,role,resident) => id==='cg-one' && resident==='resident-a'};
const service = new ResidentMealRegistrationService(db,staff,scope);
const A={id:'cg-one',role:'CAREGIVER'};
const B={id:'cg-two',role:'CAREGIVER'};
const M={id:'manager',role:'CARE_MANAGER'};
const N={id:'nutrition',role:'NUTRITIONIST'};
const D={id:'director',role:'SUPERVISOR'};
const payload=(residentId,mealType='LUNCH')=>({residentId,mealDate:'2026-10-20',mealType,portions:1,note:'CI only'});
const failure=async(fn,status)=>assert.rejects(fn,e=>e.status===status || e.getStatus?.()===status);
test('isolated PostgreSQL durable CRUD, scope and totals',async()=>{
  const r=await service.register(A,payload('resident-a'));
  assert.equal(r.status,'REGISTERED');
  await failure(()=>service.register(A,payload('resident-a')),409);
  await failure(()=>service.register(B,payload('resident-b')),403);
  await failure(()=>service.register(N,payload('resident-a','BREAKFAST')),403);
  await failure(()=>service.register(D,payload('resident-a','DINNER')),403);
  await failure(()=>service.register({id:'fake',role:'CARE_MANAGER'},payload('resident-a','DINNER')),401);
  await failure(()=>service.change(B,r.registration_id,{revision:1,portions:2}),403);
  await failure(()=>service.change(N,r.registration_id,{revision:1,portions:2}),403);
  await failure(()=>service.change(D,r.registration_id,{revision:1,portions:2}),403);
  const m=await service.change(A,r.registration_id,{revision:1,portions:3,note:'updated'});
  assert.equal(m.portions,3);
  await failure(()=>service.change(A,r.registration_id,{revision:1,portions:2}),409);
  const tot=await service.totals(M,'2026-10-20');
  assert.equal(tot.items.find(x=>x.meal_type==='LUNCH').portions,3);
  await failure(()=>service.totals(A,'2026-10-20'),403);
  const listA=await service.list(A,'2026-10-20');
  assert.equal(listA.items.length,1);
  const listB=await service.list(B,'2026-10-20');
  assert.equal(listB.items.length,0);
  const canceled=await service.change(A,r.registration_id,{revision:2},true);
  assert.equal(canceled.status,'CANCELLED');
  assert.equal((await service.totals(M,'2026-10-20')).items.length,0);
  await failure(()=>service.change(A,r.registration_id,{revision:3,portions:4}),409);
  const audit=await pool.query('SELECT action FROM resident_meal_registration_audit ORDER BY happened_at,event_id');
  assert.equal(audit.rowCount,3);
  assert.deepEqual(new Set(audit.rows.map(x=>x.action)),new Set(['REGISTER','UPDATE','CANCEL']));
});
test.after(async()=>pool.end());
