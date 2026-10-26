const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Client } = require('pg');

const DB = 'postgresql://ci_meal:ci_only_not_production@127.0.0.1:15434/ci_meal';
const SECRET = 'm6-isolated-http-secret-012345678901234567890';
const sessions = {
  nutrition: '33333333-3333-4333-8333-333333333333',
  caregiver: '44444444-4444-4444-8444-444444444444',
  manager: '55555555-5555-4555-8555-555555555555',
};

async function main() {
  const db = new Client({ connectionString: DB });
  let connected = false;
  for (let attempt = 0; attempt < 20 && !connected; attempt += 1) {
    try { await db.connect(); connected = true; } catch (error) {
      if (attempt === 19) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  const root = path.resolve(__dirname, '../..');
  const today = new Date().toISOString().slice(0, 10);
  await db.query(fs.readFileSync(path.join(root, 'ops/ci/resident-meal-isolated-prerequisites.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(root, 'database/migrations/20261009_017_resident_meal_registrations.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(root, 'database/migrations/20261027_018_nutrition_operational_records.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(root, 'database/migrations/20261027_019_nutrition_contract_closure.sql'), 'utf8'));
  await db.query(`ALTER TABLE residents
    ADD COLUMN IF NOT EXISTS resident_code TEXT,
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS birth_year INTEGER,
    ADD COLUMN IF NOT EXISTS gender TEXT,
    ADD COLUMN IF NOT EXISTS room TEXT,
    ADD COLUMN IF NOT EXISTS bed TEXT,
    ADD COLUMN IF NOT EXISTS care_level TEXT;
    UPDATE residents SET resident_code=resident_id,display_name=resident_id,date_of_birth='1950-01-01',gender='UNSPECIFIED',room='TEST',bed='1',care_level='STANDARD' WHERE resident_code IS NULL;`);
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
    VALUES ($1,'nutrition-one','NUTRITIONIST',now()+interval '1 hour'),($2,'cg-one','CAREGIVER',now()+interval '1 hour'),($3,'manager-one','CARE_MANAGER',now()+interval '1 hour')`, [sessions.nutrition, sessions.caregiver, sessions.manager]);
  await db.query("INSERT INTO nutrition_caregiver_floor_assignments(actor_id,resident_id,floor) VALUES('cg-one','resident-a','2')");
  await db.query(`INSERT INTO resident_meal_registrations(registration_id,resident_id,meal_date,meal_type,portions,note,registered_by,updated_by)
    VALUES('22222222-2222-4222-8222-222222222222','resident-a',$1,'LUNCH',3,'browser fixture','nutrition-one','nutrition-one')`, [today]);

  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: DB, JWT_SECRET: SECRET, PORT: process.env.M6_API_PORT || '33123', CORS_ALLOWED_ORIGINS: process.env.M6_CORS_ORIGIN || 'http://127.0.0.1:33124' },
    stdio: 'inherit',
  });
  const shutdown = async () => { child.kill('SIGTERM'); await db.end(); process.exit(0); };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  await new Promise(resolve => setTimeout(resolve, 1200));
  process.stdin.resume();
}

main().catch(error => { console.error(error); process.exit(1); });
