'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.resolve(__dirname, '../finance/v3818/070_live_seven_source_mapping_readonly.sh'), 'utf8');
assert.match(script, /BEGIN TRANSACTION READ ONLY;/);
assert.match(script, /current_database\(\)\s*<>\s*'taman_care'/);
assert.match(script, /current_user\s*<>\s*'taman'/);
assert.match(script, /current_setting\('transaction_read_only'\)\s*<>\s*'on'/);
assert.match(script, /pg_catalog\.pg_class/);
assert.match(script, /pg_catalog\.pg_attribute/);
assert.match(script, /'NOT_PROVEN'\s+AS approved_row_proof/);
assert.match(script, /'NOT_PROVEN'\s+AS finance_origin_reconciliation/);
assert.match(script, /'NOT_PROVEN'\s+AS monthly_completeness/);
assert.match(script, /V70_SEVEN_SOURCES_OPERATIONAL_READY=NO/);
assert.match(script, /DB_WRITE=NO MIGRATION=NO SEED=NO DEPLOY=NO/);
assert.doesNotMatch(script, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|COPY)\b/i);
assert.doesNotMatch(script, /SELECT\s+[^;]*\bFROM\s+(?:public\.)?(?:finance_entries|resident_leave_requests|inventory_transactions|resident_consumption_events|kitchen_receiving_batch_items|shift_assignments|staff_actors)\b/i);

for (const source of ['invoices', 'careFees', 'leaveAdjustments', 'inventoryConsumption', 'payroll', 'manualVouchers', 'otherExpenses']) {
  assert.ok(script.includes(`'${source}'`), `missing source group ${source}`);
}
console.log('TAMANCARE_FINANCE_V381870_READONLY_SOURCE_MAP_STATIC_SAFETY_PASS');
