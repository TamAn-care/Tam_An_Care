const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const files = new Set();
for (const args of [
  ['diff', '--name-only', 'HEAD'],
  ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
  ['ls-files', '--others', '--exclude-standard'],
]) {
  const output = execFileSync('git', args, { encoding: 'utf8' });
  output.split('\n').filter(Boolean).forEach((file) => files.add(file));
}
const scanTargets = new Set([
  'docker-compose.production-test.yml',
  ...Array.from(files).filter((file) => fs.existsSync(file)),
]);
const findings = [];

for (const file of scanTargets) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/i.test(line)) {
      findings.push(`${file}:${index + 1}:credential-bearing PostgreSQL URL`);
    }
    if (
      file === 'docker-compose.production-test.yml' &&
      /^\s*POSTGRES_PASSWORD\s*:\s*['"]?[^$\s][^\n]*$/i.test(line)
    ) {
      findings.push(`${file}:${index + 1}:inline PostgreSQL password`);
    }
  });
}

const compose = fs.readFileSync('docker-compose.production-test.yml', 'utf8');
if (!compose.includes('DATABASE_URL_FILE: /run/secrets/database_url')) {
  findings.push('docker-compose.production-test.yml:missing mounted database URL secret');
}
if (!compose.includes('POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password')) {
  findings.push('docker-compose.production-test.yml:missing mounted PostgreSQL password secret');
}
const productionCompose = fs.readFileSync('deploy/production/docker-compose.production.yml', 'utf8');
if (!productionCompose.includes('DATABASE_URL_FILE: /run/secrets/database_url')) {
  findings.push('deploy/production/docker-compose.production.yml:missing database URL secret mount');
}
if (!productionCompose.includes('TAMANCARE_DATABASE_URL_FILE:?Set TAMANCARE_DATABASE_URL_FILE')) {
  findings.push('deploy/production/docker-compose.production.yml:database URL source must be externally configured');
}
if (productionCompose.includes('export DATABASE_URL=$$(cat /run/secrets/database_url)')) {
  findings.push('deploy/production/docker-compose.production.yml:database URL must not be exported by shell entrypoint');
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(`SECRET_SOURCE_SCAN=PASS (${scanTargets.size} source paths checked)`);
