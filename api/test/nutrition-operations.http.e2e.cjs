const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const DB = 'postgresql://ci_meal:ci_only_not_production@127.0.0.1:15434/ci_meal';
const API = 'http://127.0.0.1:33123';
const SECRET = 'm6-isolated-http-secret-012345678901234567890';
const registrationId = '22222222-2222-4222-8222-222222222222';
const sessionIds = {
  nutrition: '33333333-3333-4333-8333-333333333333',
  caregiver: '44444444-4444-4444-8444-444444444444',
  manager: '55555555-5555-4555-8555-555555555555',
};

function jwt(sub, role, jti) {
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = enc({ alg: 'HS256', typ: 'JWT' });
  const payload = enc({ sub, role, jti, exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${payload}`).digest('base64url');
  return `${head}.${payload}.${sig}`;
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try { const r = await fetch(`${API}/api/health`); if (r.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Nest health endpoint did not become ready');
}

async function request(pathname, token, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body !== undefined) { headers['content-type'] = 'application/json'; options.body = JSON.stringify(options.body); }
  return fetch(`${API}${pathname}`, { ...options, headers });
}

async function main() {
  const db = new Client({ connectionString: DB });
  await db.connect();
  const root = path.resolve(__dirname, '../..');
  try {
    await db.query(fs.readFileSync(path.join(root, 'ops/ci/resident-meal-isolated-prerequisites.sql'), 'utf8'));
    await db.query(fs.readFileSync(path.join(root, 'database/migrations/20261009_017_resident_meal_registrations.sql'), 'utf8'));
    await db.query(fs.readFileSync(path.join(root, 'database/migrations/20261027_018_nutrition_operational_records.sql'), 'utf8'));
    await db.query(fs.readFileSync(path.join(root, 'database/migrations/20261027_019_nutrition_contract_closure.sql'), 'utf8'));
    await db.query(`CREATE TABLE staff_actors (
      actor_id TEXT PRIMARY KEY, staff_code TEXT NOT NULL, display_name TEXT NOT NULL,
      primary_operational_role TEXT NOT NULL, status TEXT NOT NULL, employment_reference TEXT,
      department TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE auth_sessions (
        session_id UUID PRIMARY KEY, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL,
        revoked_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NOT NULL, revoked_reason TEXT);
      CREATE TABLE shift_assignments (shift_id TEXT PRIMARY KEY);`);
    await db.query(`INSERT INTO staff_actors(actor_id,staff_code,display_name,primary_operational_role,status,department,email,phone)
      VALUES ('nutrition-one','NUT-ONE','Synthetic Nutrition','NUTRITIONIST','ACTIVE','Nutrition','nutrition@example.invalid','000'),
             ('cg-one','CG-ONE','Synthetic Caregiver','CAREGIVER','ACTIVE','Care','caregiver@example.invalid','000'),
             ('manager-one','MGR-ONE','Synthetic Manager','CARE_MANAGER','ACTIVE','Management','manager@example.invalid','000')`);
    await db.query(`INSERT INTO auth_sessions(session_id,actor_id,actor_role,expires_at)
      VALUES ($1,'nutrition-one','NUTRITIONIST',now()+interval '1 hour'),($2,'cg-one','CAREGIVER',now()+interval '1 hour'),($3,'manager-one','CARE_MANAGER',now()+interval '1 hour')`, [sessionIds.nutrition, sessionIds.caregiver, sessionIds.manager]);
    await db.query("INSERT INTO nutrition_caregiver_floor_assignments(actor_id,resident_id,floor) VALUES('cg-one','resident-a','2')");
    await db.query(`INSERT INTO resident_meal_registrations(registration_id,resident_id,meal_date,meal_type,portions,note,registered_by,updated_by)
      VALUES($1,'resident-a','2026-10-27','LUNCH',3,'http fixture','nutrition-one','nutrition-one')`, [registrationId]);

    const child = spawn(process.execPath, ['dist/main.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: DB, JWT_SECRET: SECRET, PORT: '33123', CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:33124' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    try {
      await waitForHealth();
      const nutritionToken = jwt('nutrition-one', 'NUTRITIONIST', sessionIds.nutrition);
      const caregiverToken = jwt('cg-one', 'CAREGIVER', sessionIds.caregiver);
      const managerToken = jwt('manager-one', 'CARE_MANAGER', sessionIds.manager);
      const unauth = await request('/api/nutrition-operations/tray-dispatches?date=2026-10-27');
      assert.equal(unauth.status, 401);
      const dispatched = await request('/api/nutrition-operations/tray-dispatches', nutritionToken, { method: 'POST', body: { registrationId, destinationFloor: '2', portions: 3 } });
      assert.equal(dispatched.status, 201);
      const dispatch = await dispatched.json();
      const wrongFloor = await request(`/api/nutrition-operations/tray-dispatches/${dispatch.dispatch_id}/acknowledge`, caregiverToken, { method: 'POST', body: { floor: '9', receivedPortions: 3 } });
      assert.equal(wrongFloor.status, 403);
      const receipt = await request(`/api/nutrition-operations/tray-dispatches/${dispatch.dispatch_id}/acknowledge`, caregiverToken, { method: 'POST', body: { floor: '2', receivedPortions: 2, notes: 'one portion discrepancy' } });
      assert.equal(receipt.status, 201);
      const duplicate = await request(`/api/nutrition-operations/tray-dispatches/${dispatch.dispatch_id}/acknowledge`, caregiverToken, { method: 'POST', body: { floor: '2', receivedPortions: 2 } });
      assert.equal(duplicate.status, 409);
      const hygiene = await request('/api/nutrition-operations/hygiene-records', nutritionToken, { method: 'POST', body: { residentId: 'resident-a', taskReference: 'HTTP-HYGIENE', status: 'COMPLETED', notes: 'fixture' } });
      assert.equal(hygiene.status, 201);
      const hygieneRecord = await hygiene.json();
      const inspect = await request('/api/nutrition-operations/hygiene-records/inspect', managerToken, { method: 'POST', body: { recordId: hygieneRecord.record_id, finding: 'verified', decision: 'CONFIRMED' } });
      assert.equal(inspect.status, 201);
      const sample = await request('/api/nutrition-operations/food-samples', nutritionToken, { method: 'POST', body: { residentId: 'resident-a', registrationId, mealDate: '2026-10-27', mealType: 'LUNCH', notes: 'fixture' } });
      assert.equal(sample.status, 201);
      const sampleRecord = await sample.json();
      const early = await request(`/api/nutrition-operations/food-samples/${sampleRecord.sample_id}/dispose`, nutritionToken, { method: 'POST', body: {} });
      assert.equal(early.status, 409);
      const sampleInspect = await request('/api/nutrition-operations/food-samples/inspect', managerToken, { method: 'POST', body: { sampleId: sampleRecord.sample_id, finding: 'timing checked' } });
      assert.equal(sampleInspect.status, 201);
      const persisted = await db.query(`SELECT
        (SELECT count(*) FROM nutrition_tray_handover_events WHERE event_type='HANDOVER_ACKNOWLEDGED') AS receipts,
        (SELECT count(*) FROM nutrition_hygiene_inspections) AS hygiene_inspections,
        (SELECT count(*) FROM nutrition_sample_inspections) AS sample_inspections,
        (SELECT count(*) FROM nutrition_operational_audit) AS audit`);
      assert.deepEqual(persisted.rows[0], { receipts: '1', hygiene_inspections: '1', sample_inspections: '1', audit: '6' });
      console.log('NEST_HTTP_ROUTES=PASS');
      console.log('JWT_RBAC_AND_UNAUTH_DENIAL=PASS');
      console.log('WRONG_FLOOR_AND_DUPLICATE_RECEIPT=PASS');
      console.log('HYGIENE_MANAGER_INSPECTION=PASS');
      console.log('SAMPLE_PREMATURE_DISPOSAL_DENIAL=PASS');
      console.log('AUDIT_PERSISTENCE=PASS');
    } finally {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
      if (stderr && /Error|Exception/i.test(stderr)) console.error(stderr);
    }
  } finally {
    await db.end();
  }
}

main().catch(error => { console.error('NEST_HTTP_ROUTES=FAIL'); console.error(error.message); process.exitCode = 1; });
