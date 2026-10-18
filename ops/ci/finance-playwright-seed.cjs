'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { createRequire } = require('node:module');
const apiRequire = createRequire(path.resolve('api/package.json'));
const { Pool } = apiRequire('pg');

const password = process.env.FINANCE_E2E_PASSWORD;
if (!password || password.length < 16) throw new Error('SYNTHETIC_E2E_PASSWORD_REQUIRED');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 2,
  connectionTimeoutMillis: 5000,
});

const accounts = [
  // Pricing editors can enter the Billing route in the frontend policy.
  // CARE_MANAGER can edit through the API but is intentionally not granted
  // the Billing route, so use the approved supervisor role for browser E2E.
  ['CI_MAKER', 'CI_MAKER', 'SUPERVISOR'],
  ['CI_SUBMITTER', 'CI_SUBMITTER', 'SUPERVISOR'],
  ['CI_APPROVER', 'CI_APPROVER', 'ADMIN'],
  ['CI_ACCOUNTANT', 'CI_ACCOUNTANT', 'ACCOUNTANT'],
];

async function main() {
  await pool.query('BEGIN');
  try {
    for (const [actorId, staffCode, role] of accounts) {
      const salt = crypto.randomBytes(16).toString('hex');
      const iterations = 210000;
      const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
      await pool.query(
        `INSERT INTO public.staff_actors(actor_id,staff_code,display_name,primary_operational_role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
        [actorId, staffCode, `Synthetic ${role}`, role],
      );
      await pool.query(
        `INSERT INTO public.auth_credentials(actor_id,password_hash,password_salt,password_iterations,password_digest)
         VALUES($1,$2,$3,$4,'sha256')`,
        [actorId, hash, salt, iterations],
      );
    }
    await pool.query('COMMIT');
    process.stdout.write('FINANCE_SYNTHETIC_ACCOUNTS_READY=4\n');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`FINANCE_SYNTHETIC_SEED_FAILED=${error.code || error.name || 'Error'}\n`);
  process.exitCode = 1;
});
