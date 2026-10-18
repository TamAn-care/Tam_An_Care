'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const output = process.argv[2];
if (!output) throw new Error('PROVENANCE_OUTPUT_PATH_REQUIRED');

const root = path.resolve(__dirname, '../..');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (process.env.GITHUB_SHA && sha !== process.env.GITHUB_SHA.toLowerCase()) {
  throw new Error('PROVENANCE_CHECKED_OUT_SHA_MISMATCH');
}
const sourceManifestPath = path.join(root, 'docs/finance-rules-v1.0-source-manifest.json');
const sourceManifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(sourceManifestPath)).digest('hex');
const repository = process.env.GITHUB_REPOSITORY || 'local';
const runId = process.env.GITHUB_RUN_ID || 'local';
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
const server = process.env.GITHUB_SERVER_URL || 'https://github.com';

const provenance = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  source: {
    repository,
    ref: process.env.GITHUB_REF || 'local',
    sha,
    financeRulesSourceManifestSha256: sourceManifestSha256,
  },
  workflow: {
    name: process.env.GITHUB_WORKFLOW || 'local-finance-playwright',
    runId,
    attempt,
    url: `${server}/${repository}/actions/runs/${runId}`,
  },
  environment: {
    runnerOs: process.env.RUNNER_OS || process.platform,
    runnerName: process.env.RUNNER_NAME || 'local-disposable',
    database: 'PostgreSQL 16 disposable service',
    productionNetworkConfigured: false,
  },
  candidateArtifacts: {
    apiImageDigest: null,
    frontendImageDigest: null,
    note: 'This browser workflow validates source on a hosted runner; it does not build deployable container images.',
  },
};

const destination = path.resolve(root, output);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(provenance, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`FINANCE_CANDIDATE_PROVENANCE=${destination}\nFINANCE_CANDIDATE_SHA=${sha}\n`);
