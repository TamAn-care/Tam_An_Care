'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const q=fs.readFileSync(path.resolve(__dirname,'../finance/v3818/053_complete_public_catalog_readonly.sql'),'utf8');
const body=q.split('\n').filter(x=>!x.trim().startsWith('--')).join('\n');
for(const x of ['transaction_read_only','pg_catalog.pg_class','pg_catalog.pg_attribute','pg_catalog.pg_constraint','ORDER BY c.relname'])assert.ok(body.includes(x));
assert.match(body,/current_database\(\)<>'taman_care'/);
assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY)\s/i);
console.log('TAMANCARE_FINANCE_V381853_COMPLETE_CATALOG_READ_ONLY_PASS');
