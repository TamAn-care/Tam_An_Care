'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.resolve(__dirname,'../finance/v3818/057_integration_collision_map_readonly.sh'),'utf8');
for(const token of ['SAFE_STOP_WRONG_HOST','SAFE_STOP_SOURCE_NOT_FOUND','sha256sum','CONTENT_COLLISIONS=','NO_AUTO_MERGE','PRODUCTION_GO_NO_GO=NO_GO'])assert.ok(s.includes(token));
assert.doesNotMatch(s,/\b(?:docker\s+(?:exec|restart|stop|rm)|git\s+(?:checkout|reset|merge|push|pull)|psql|rm\s+-rf|sed\s+-i)\b/i);
console.log('TAMANCARE_FINANCE_V381857_COLLISION_MAP_READ_ONLY_PASS');