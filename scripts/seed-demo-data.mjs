import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from '../api/node_modules/pg/lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL_FILE && fs.existsSync(process.env.DATABASE_URL_FILE)) {
    return fs.readFileSync(process.env.DATABASE_URL_FILE, 'utf8').trim();
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.trim();
  }
  return 'postgresql://taman:taman_dev_password@localhost:5432/taman_care';
}

async function runSeed() {
  const dbUrl = resolveDatabaseUrl();
  console.log(`[TamAnCare Seed] Connecting to database: ${dbUrl.replace(/:([^:@]+)@/, ':****@')}`);

  const pool = new pg.Pool({ connectionString: dbUrl });
  const seedSqlPath = path.join(rootDir, 'database', 'seeds', '001_demo_data.sql');

  if (!fs.existsSync(seedSqlPath)) {
    console.error(`[TamAnCare Seed] Seed SQL file not found at: ${seedSqlPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(seedSqlPath, 'utf8');

  try {
    const client = await pool.connect();
    try {
      console.log('[TamAnCare Seed] Executing 001_demo_data.sql...');
      await client.query(sqlContent);
      console.log('[TamAnCare Seed] Successfully seeded:');
      console.log('  - 8 Staff Actors (Supervisors, Care Managers, Nurses, Caregivers)');
      console.log('  - 8 Auth Credentials (Default Password: TamAn@2026)');
      console.log('  - 5 Demo Elderly Residents (An, Bình, Cúc, Dũng, Em)');
      console.log('[TamAnCare Seed] Done!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[TamAnCare Seed] Error running seed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeed();
