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
if (branch === 'feature/finance-github-first-transition-20261012') {
  // Standalone Finance qualification branch.
} else if (branch === 'integration/finance-guardian-20261019') {
  // This isolated cross-module candidate must retain the exact owner-approved
  // Finance and Guardian source commits; source checksums above remain active.
  for (const sourceSha of [
    '027f36205e792561f6b0494f11e299b42d70db87',
    'cb575338b52443671527ce65b9148fe828bb1213',
  ]) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sourceSha, head], { cwd: root });
    } catch {
      assert.fail(`approved integration source is not an ancestor: ${sourceSha}`);
    }
  }
} else if (branch) {
  assert.fail(`unexpected Finance branch: ${branch}`);
}
console.log(`FINANCE_V1_SOURCE_MANIFEST_PASS=${head}`);
