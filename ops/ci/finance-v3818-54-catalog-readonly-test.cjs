const fs = require('node:fs');
const sql = fs.readFileSync('ops/finance/v3818/054_cross_schema_source_catalog_readonly.sql', 'utf8');
if (!sql.includes("current_setting('transaction_read_only')<>'on'")) throw new Error('V54 must reject non-read-only sessions');
if (!sql.includes('SELECT n.nspname AS schema_name,c.relname AS candidate_relation')) throw new Error('V54 candidate query must use the joined namespace alias');
console.log('FINANCE_V3818_54_CATALOG_READONLY_PASS');
