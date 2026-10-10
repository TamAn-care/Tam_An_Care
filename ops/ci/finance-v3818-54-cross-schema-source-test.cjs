'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.resolve(__dirname,'../finance/v3818/054_cross_schema_source_catalog_readonly.sql'),'utf8');
const body=s.split('\n').filter(x=>!x.trim().startsWith('--')).join('\n');
for(const k of ['transaction_read_only','pg_catalog.pg_namespace','pg_catalog.pg_class','pg_catalog.pg_attribute','taman_care'])assert.ok(body.includes(k));
assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COPY)\s/i);
console.log('TAMANCARE_FINANCE_V381854_CROSS_SCHEMA_CATALOG_SAFE_PASS');
