'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const sql=fs.readFileSync(
 path.join(root,'ops/finance/v35/007_legacy_contract_quarantine.sql'),
 'utf8'
);

assert.match(sql,/NEVER AUTO-APPLY TO PRODUCTION TEST/);
assert.match(sql,/legacy_contract_import_quarantine/);
assert.match(sql,/financial_posting_allowed/);
assert.match(sql,/imported_to_canonical/);
assert.match(sql,/LEGACY_QUARANTINE_IMMUTABLE/);
assert.doesNotMatch(sql,/\bINSERT\s+INTO\b/i);

const frontend=fs.readFileSync(
 path.join(root,'frontend/src/main.tsx'),'utf8'
);
assert.ok(!frontend.includes("'taman_service_contracts_v1'"));

console.log('LEGACY_QUARANTINE_STATIC_GATE=PASS');
console.log('BROWSER_CONTRACT_AUTO_DELETE=ABSENT');
console.log('REAL_DATA_SEED=ABSENT');
