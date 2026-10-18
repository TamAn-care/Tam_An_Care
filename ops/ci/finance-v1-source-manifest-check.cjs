'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/finance-rules-v1.0-source-manifest.json'), 'utf8'));
assert.equal(manifest.ruleset, 'Finance Business Rules & Mapping V1.0');
assert.ok(manifest.source_files && Object.keys(manifest.source_files).length >= 4);
for (const [file, expected] of Object.entries(manifest.source_files)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  assert.equal(actual, expected, `Finance source checksum mismatch: ${file}`);
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (process.env.GITHUB_SHA) assert.equal(head, process.env.GITHUB_SHA.toLowerCase(), 'workflow source SHA must equal checked out candidate');
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
if (branch) assert.equal(branch, 'feature/finance-github-first-transition-20261012', 'unexpected Finance branch');
console.log(`FINANCE_V1_SOURCE_MANIFEST_PASS=${head}`);
