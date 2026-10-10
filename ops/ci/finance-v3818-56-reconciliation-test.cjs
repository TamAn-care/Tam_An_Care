'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.resolve(__dirname,'../finance/v3818/056_grand_source_reconciliation_readonly.sh'),'utf8');
for(const word of ['STOP_WRONG_HOST','sha256sum','git -C','docker inspect','SOURCE_RUNTIME_PARITY=NOT_PROVEN','GO_NO_GO=NO_GO'])assert.ok(s.includes(word));
assert.doesNotMatch(s,/\b(?:docker\s+(?:exec|run|restart|stop|rm)|git\s+(?:checkout|reset|push|pull|merge)|psql|sed\s+-i|rm\s+-rf|\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b)\b/i);
console.log('TAMANCARE_FINANCE_V381856_GRAND_RECONCILIATION_STATIC_PASS');
