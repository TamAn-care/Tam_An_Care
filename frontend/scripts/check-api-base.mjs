import fs from 'node:fs';

function normalize(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '');
}

function readEnvFile(path) {
  if (!fs.existsSync(path)) {
    return '';
  }

  const text = fs.readFileSync(path, 'utf8');

  for (const line of text.split(/\r?\n/)) {
    const match =
      line.match(
        /^\s*VITE_API_BASE_URL\s*=\s*(.*?)\s*$/
      );

    if (match) {
      return normalize(match[1]);
    }
  }

  return '';
}

const processValue =
  normalize(process.env.VITE_API_BASE_URL);

const envFileValue =
  readEnvFile('.env.production');

const bad =
  processValue === '/api' ||
  envFileValue === '/api';

if (bad) {
  console.error('');
  console.error(
    'FATAL TAMANCARE API CONTRACT VIOLATION'
  );
  console.error(
    'VITE_API_BASE_URL=/api is forbidden in production.'
  );
  console.error(
    'API paths already begin with /api.'
  );
  console.error(
    'This configuration would recreate /api/api/...'
  );
  console.error('');

  process.exit(42);
}

console.log(
  'TAMANCARE API BASE GUARD = PASS'
);
