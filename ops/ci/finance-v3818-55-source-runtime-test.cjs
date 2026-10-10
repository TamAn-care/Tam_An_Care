'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.resolve(__dirname,'../finance/v3818/055_server_source_runtime_readonly.sh'),'utf8');
for(const x of ['SAFE_STOP_WRONG_HOST','git -C','docker ps','docker inspect','sha256sum','SOURCE_RUNTIME_PARITY=NOT_PROVEN','PRODUCTION_GO_NO_GO=NO_GO'])assert.ok(s.includes(x));
assert.doesNotMatch(s,/\b(?:docker\s+(?:restart|stop|rm|exec|run|compose)|git\s+(?:push|pull|checkout|reset)|psql|rm\s+-|sed\s+-i|curl\s+.*-X\s+POST)\b/i);
console.log('TAMANCARE_FINANCE_V381855_SOURCE_RUNTIME_READONLY_STATIC_PASS');
