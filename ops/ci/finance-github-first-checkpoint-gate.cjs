'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const manifest = JSON.parse(read('docs/finance-checkpoint-porting-manifest-20261012.json'));
assert.equal(manifest.serverCandidatesTransferred,false,'Cannot claim porting before source transfer and equivalence tests');
assert.equal(manifest.release.status,'NO_GO');
for (const v of ['v169','v174','v175','v176','v177','v1782','v179','v180','v1811','v182','v183']) {
  assert.ok(manifest[v]?.topic,'Checkpoint missing: '+v);
  assert.notEqual(manifest[v]?.githubProof,'PASS','Cannot self-certify a previous local test as GitHub PASS');
}
const result=read('api/src/finance-billing/monthly-operating-result.service.ts');
const engine=read('api/src/finance-billing/monthly-operating-result.ts');
const close=read('api/src/finance-billing/monthly-close-evidence.ts');
assert.match(result,/finance_entries/);
assert.match(result,/sourceVerified:\s*false/,'Never trust posted entries as proof of financial source');
assert.match(result,/verifyIndependentMonthlyClose\(month,\s*null/,'No automatic attestation until independent source exists');
assert.match(engine,/CHUA_DU_DU_LIEU/);
assert.match(close,/MONTH_CLOSE_EVIDENCE_MISSING/);
// The adapter delegates 7-class validation to the compiled canonical
// classifier; verify its behavior instead of searching for inline literals.
assert.match(result, /classifyV43\(row\.entry_type\)/,
  'Monthly adapter must use canonical source classification');
assert.match(result, /MONTHLY_FINANCE_UNKNOWN_LEDGER_KIND/,
  'Unknown types must fail closed');
const canonical=read('api/src/finance-billing/finance-v381843-canonical-entry-types.ts');
for (const t of ['REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX']) {
 assert.ok(canonical.includes("'"+t+"'"), 'Canonical classifier missing '+t);
}
console.log('FINANCE_GITHUB_FIRST_CHECKPOINT_INVENTORY=PASS');
console.log('SERVER_CANDIDATE_SOURCE_PARITY=NOT_PROVEN');
console.log('FINANCE_REAL_EVIDENCE=NOT_PROVEN');
console.log('PRODUCTION_GO_NO_GO=NO_GO');
