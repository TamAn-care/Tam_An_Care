const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://ci_meal:ci_only_not_production@127.0.0.1:15433/ci_meal';

const { DatabaseService } = require('../dist/database/database.service');
const { NutritionOperationsService } = require('../dist/nutrition-operations/nutrition-operations.service');

async function main() {
  const db = new DatabaseService();
  const staff = {
    async resolveActiveActorWithRole(actorId, role) {
      return actorId && role ? { actor_id: actorId, primary_operational_role: role, status: 'ACTIVE' } : null;
    },
  };
  const scope = {
    async canAccessResident(actorId, role, residentId) {
      return residentId === 'resident-a' && ((role === 'CAREGIVER' && actorId === 'cg-one') || role === 'NURSE');
    },
  };
  const ops = new NutritionOperationsService(db, staff, scope);
  const c = await db.getPool().connect();
  const registrationId = '11111111-1111-4111-8111-111111111111';
  try {
    await c.query('TRUNCATE nutrition_operational_audit, nutrition_sample_inspections, nutrition_hygiene_inspections, nutrition_caregiver_floor_assignments, nutrition_tray_handover_events, nutrition_tray_dispatches, nutrition_hygiene_records, nutrition_food_samples, resident_meal_registrations CASCADE');
    await c.query("INSERT INTO nutrition_caregiver_floor_assignments(actor_id,resident_id,floor) VALUES('cg-one','resident-a','2')");
    await c.query(`INSERT INTO resident_meal_registrations
      (registration_id,resident_id,meal_date,meal_type,portions,note,registered_by,updated_by)
      VALUES($1,'resident-a','2026-10-27','LUNCH',3,'isolated fixture','cg-one','cg-one')`, [registrationId]);
  } finally { c.release(); }

  const dispatch = await ops.dispatch({ actorId: 'nutrition-one', actorRole: 'NUTRITIONIST' }, {
    registrationId, destinationFloor: '2', portions: 3,
  });
  assert.equal(dispatch.status, 'DISPATCHED');
  await assert.rejects(
    () => ops.dispatch({ actorId: 'nutrition-one', actorRole: 'NUTRITIONIST' }, { registrationId, destinationFloor: '2', portions: 3 }),
    /duplicate|unique|already/i,
  );
  const received = await ops.acknowledge({ actorId: 'cg-one', actorRole: 'CAREGIVER' }, dispatch.dispatch_id, { floor: '2', receivedPortions: 2, notes: 'one portion discrepancy' });
  assert.equal(received.status, 'RECEIVED');
  await assert.rejects(
    () => ops.acknowledge({ actorId: 'cg-one', actorRole: 'CAREGIVER' }, dispatch.dispatch_id, { floor: '2', receivedPortions: 2 }),
    /already recorded/i,
  );

  const hygiene = await ops.recordHygiene({ actorId: 'nutrition-one', actorRole: 'NUTRITIONIST' }, {
    residentId: 'resident-a', taskReference: 'MEAL-HYGIENE-001', status: 'COMPLETED', notes: 'isolated fixture',
  });
  assert.equal(hygiene.status, 'COMPLETED');
  await assert.rejects(
    () => ops.recordHygiene({ actorId: 'nutrition-one', actorRole: 'NUTRITIONIST' }, { residentId: 'missing', taskReference: 'NO-SCOPE', status: 'RECORDED' }),
    /Active resident not found/i,
  );
  const hygieneInspection = await ops.inspectHygiene({ actorId: 'manager-one', actorRole: 'CARE_MANAGER' }, { recordId: hygiene.record_id, finding: 'completed', decision: 'CONFIRMED' });
  assert.equal(hygieneInspection.decision, 'CONFIRMED');

  const sample = await ops.collectSample({ actorId: 'nutrition-one', actorRole: 'NUTRITIONIST' }, {
    residentId: 'resident-a', registrationId, mealDate: '2026-10-27', mealType: 'LUNCH', notes: 'isolated fixture',
  });
  assert.equal(sample.status, 'IN_STORAGE');
  assert.ok(new Date(sample.retained_until).getTime() - new Date(sample.collected_at).getTime() >= 24 * 60 * 60 * 1000);
  await assert.rejects(
    () => ops.disposeSample({ actorId: 'nutrition-one', actorRole: 'NUTRITIONIST' }, sample.sample_id),
    /24-hour retention/i,
  );
  const c2 = await db.getPool().connect();
  try { await c2.query("UPDATE nutrition_food_samples SET collected_at=now()-interval '25 hours',retained_until=now()-interval '1 second' WHERE sample_id=$1", [sample.sample_id]); }
  finally { c2.release(); }
  const disposed = await ops.disposeSample({ actorId: 'nutrition-one', actorRole: 'NUTRITIONIST' }, sample.sample_id);
  assert.equal(disposed.status, 'DISPOSAL_RECORDED');
  const sampleInspection = await ops.inspectSample({ actorId: 'manager-one', actorRole: 'CARE_MANAGER' }, { sampleId: sample.sample_id, finding: 'timing verified' });
  assert.equal(sampleInspection.sample_id, sample.sample_id);

  const persisted = await db.query(`SELECT
    (SELECT count(*) FROM nutrition_tray_dispatches) AS dispatches,
    (SELECT count(*) FROM nutrition_hygiene_records) AS hygiene,
    (SELECT count(*) FROM nutrition_food_samples) AS samples,
    (SELECT count(*) FROM nutrition_operational_audit) AS audit,
    (SELECT count(*) FROM nutrition_tray_handover_events WHERE event_type='HANDOVER_ACKNOWLEDGED') AS receipts,
    (SELECT count(*) FROM nutrition_hygiene_inspections) AS hygiene_inspections,
    (SELECT count(*) FROM nutrition_sample_inspections) AS sample_inspections`);
  assert.deepEqual(persisted.rows[0], { dispatches: '1', hygiene: '1', samples: '1', audit: '7', receipts: '1', hygiene_inspections: '1', sample_inspections: '1' });
  console.log('NUTRITION_OPERATIONS_INTEGRATION=PASS');
  console.log('DISPATCH_PERSISTENCE=PASS');
  console.log('HYGIENE_PERSISTENCE=PASS');
  console.log('CAREGIVER_RECEIPT_AND_DUPLICATE_PROTECTION=PASS');
  console.log('MANAGER_INSPECTIONS=PASS');
  console.log('FOOD_SAMPLE_RETENTION_AND_DISPOSAL=PASS');
  console.log('AUDIT_TRAIL=PASS');
  await db.onModuleDestroy();
}

main().catch(async error => {
  console.error('NUTRITION_OPERATIONS_INTEGRATION=FAIL');
  console.error(error.message);
  process.exitCode = 1;
});
