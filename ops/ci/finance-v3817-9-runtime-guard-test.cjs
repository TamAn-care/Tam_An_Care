'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const audit=fs.readFileSync('ops/finance/v3817/009_runtime_readonly_verification.sh','utf8');
for(const token of ['V3817_9_MODE=READ_ONLY','GIT_REPRODUCIBILITY=UNVERIFIED','BILLING_MOCK_RUNTIME=UNVERIFIED','PRODUCTION_GO_NO_GO=NO_GO','DATABASE_WRITE=NO','SEED=NO','DEPLOY=NO','RESTART=NO'])assert(audit.includes(token),token);
assert(!/docker\s+(restart|stop|rm)\b/.test(audit));
assert(!/\b(psql|pg_restore|pg_dump|npm install|npm run build)\b/.test(audit));
console.log('FINANCE_V3817_9_RUNTIME_READONLY_SCRIPT_GUARD_PASS');
