const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseService } = require('../../api/dist/database/database.service.js');

async function main() {
  const secretFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'taman-db-secret-')),
    'database-url',
  );
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_FILE: process.env.DATABASE_URL_FILE,
  };
  const capturedOutput = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk, ...args) => {
    capturedOutput.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    return true;
  };
  process.stderr.write = (chunk, ...args) => {
    capturedOutput.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    return true;
  };

  try {
    const password = process.env.PG_TEST_PASSWORD;
    const database = process.env.PG_TEST_DATABASE;
    const user = process.env.PG_TEST_USER;
    const host = process.env.PG_TEST_HOST || '127.0.0.1';
    if (!password || !database || !user) {
      throw new Error('Synthetic PostgreSQL test configuration is incomplete');
    }

    const databaseUrl = [
      'postgresql',
      '://',
      encodeURIComponent(user),
      ':',
      encodeURIComponent(password),
      '@',
      host,
      ':5432/',
      encodeURIComponent(database),
    ].join('');
    fs.writeFileSync(secretFile, databaseUrl, { mode: 0o600 });
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL_FILE = secretFile;
    delete process.env.DATABASE_URL;

    const databaseService = new DatabaseService();
    try {
      const result = await databaseService.query('SELECT current_database() AS name');
      if (result.rows[0]?.name !== database) {
        throw new Error('Connected PostgreSQL database did not match the synthetic test database');
      }
    } finally {
      await databaseService.onModuleDestroy();
    }

    delete process.env.DATABASE_URL_FILE;
    let missingSecretRejected = false;
    try {
      new DatabaseService();
    } catch (error) {
      missingSecretRejected = error.message.includes('DATABASE_URL_FILE');
    }
    if (!missingSecretRejected) {
      throw new Error('API did not fail closed when the database secret was missing');
    }

    if (capturedOutput.some((entry) => entry.includes(password) || entry.includes(databaseUrl))) {
      throw new Error('Credential material was written to application output');
    }

    console.log('API_POSTGRES16_SECRET_FILE_CONNECTION=PASS');
    console.log('API_MISSING_SECRET_FAIL_CLOSED=PASS');
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    fs.rmSync(path.dirname(secretFile), { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(`DB_SECRET_TEST_FAILED=${error.name || 'Error'}`);
  process.exitCode = 1;
});
