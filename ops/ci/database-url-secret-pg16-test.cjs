const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseService } = require('../../api/dist/database/database.service.js');
const sensitiveValues = [];

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
    sensitiveValues.push(databaseUrl, password);
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

    fs.writeFileSync(secretFile, '');
    let emptySecretRejected = false;
    try {
      new DatabaseService();
    } catch (error) {
      emptySecretRejected = error.message.includes('DATABASE_URL_FILE is empty');
    }
    if (!emptySecretRejected) {
      throw new Error('API did not fail closed when the database secret file was empty');
    }
    fs.writeFileSync(secretFile, databaseUrl, { mode: 0o600 });
    fs.chmodSync(secretFile, 0o644);
    let unsafePermissionsRejected = false;
    try {
      new DatabaseService();
    } catch (error) {
      unsafePermissionsRejected = error.message.includes('unsafe permissions');
    }
    if (!unsafePermissionsRejected) {
      throw new Error('API accepted a database secret file readable by group/other');
    }
    fs.chmodSync(secretFile, 0o600);

    const symlinkFile = `${secretFile}-link`;
    fs.symlinkSync(secretFile, symlinkFile);
    const previousSecretFile = process.env.DATABASE_URL_FILE;
    process.env.DATABASE_URL_FILE = symlinkFile;
    let symlinkRejected = false;
    try {
      new DatabaseService();
    } catch (error) {
      symlinkRejected = error.message.includes('unsafe permissions');
    } finally {
      process.env.DATABASE_URL_FILE = previousSecretFile;
      fs.unlinkSync(symlinkFile);
    }
    if (!symlinkRejected) {
      throw new Error('API accepted a symlink as the database secret file');
    }

    console.log('API_EMPTY_SECRET_FAIL_CLOSED=PASS');
    console.log('API_SECRET_FILE_PERMISSIONS=PASS');
    console.log('API_SECRET_FILE_SYMLINK_REJECTED=PASS');
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
  let message = String(error?.message || 'Unknown failure');
  for (const value of sensitiveValues) {
    if (value) message = message.split(value).join('[REDACTED]');
  }
  message = message.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[REDACTED_DATABASE_URL]');
  const code = /^[A-Z0-9_]+$/.test(String(error?.code || '')) ? error.code : 'NONE';
  console.error(`DB_SECRET_TEST_FAILED=${error.name || 'Error'} CODE=${code} MESSAGE=${message}`);
  process.exitCode = 1;
});
