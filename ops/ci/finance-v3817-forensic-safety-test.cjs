'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=fs.readFileSync('ops/finance/v3817/production-test-forensic-read-only.sh','utf8');
for(const token of ['MODE=READ_ONLY','V3817_FINAL=NO_GO','DB_WRITE=NO','SEED=NO','MIGRATION=NO','DEPLOY=NO','RESTART=NO','FILE_DELETE=NO','BACKUP_RESTORE=UNVERIFIED'])assert(file.includes(token),token);
for(const dangerous of [/docker\s+(restart|rm|compose up)/,/psql\s+.*\-c.*(UPDATE|DELETE|INSERT)/,/rm\s+-rf/,/systemctl\s+restart/])assert(!dangerous.test(file));
console.log('FINANCE_V3817_READ_ONLY_STATIC_SAFETY_PASS');
