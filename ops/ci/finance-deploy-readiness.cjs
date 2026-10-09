'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const has=(p)=>fs.existsSync(path.join(root,p));
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const sql=['ops/finance/v22/001_finance_foundation.sql','ops/finance/v28/002_finance_transaction_safety.sql','ops/finance/v29/003_finance_allocation_invariants.sql','ops/finance/v29/004_finance_integrity_hardening.sql'];
const app=read('api/src/app.module.ts');
const mid=read('api/src/security/production-auth.middleware.ts');
const svc=read('api/src/finance-billing/finance-billing.service.ts');
const gates=[
 ['CANONICAL_SQL',sql.every(has)],
 ['READ_IDENTITY_WIRED',app.includes('FinanceReadController')&&mid.includes('publishVerifiedFinanceIdentity')],
 ['WRITE_SERVICE_ENABLED',!svc.includes('FINANCE_MUTATION_NOT_YET_AUTHORIZED')],
 ['WRITE_HTTP_CONTROLLER',has('api/src/finance-billing/finance-write.controller.ts')],
 ['LEDGER_LINK_READ_ONLY',has('api/src/finance-billing/finance-read.controller.ts')],
 ['LEDGER_AMOUNT_AND_SOURCE_RECONCILIATION',false],
 ['PRODUCTION_BILLING_MIGRATIONS_PRESENT',false],
 ['CANONICAL_RESIDENT_ID_COMPATIBILITY',true],
 ['CONTRACT_MAPPING_APPROVED',false],
 ['RUNTIME_SCHEMA_APPROVED',false],
 ['ISOLATED_NEST_HTTP_SMOKE_SOURCE',has('ops/ci/finance-nest-http-jwt-test.cjs')],
 ['PRODUCTION_EQUIVALENT_HTTP_JWT_E2E',false]
];
for(const [name,pass] of gates) console.log('GATE_'+name+'='+(pass?'PASS':'BLOCKED'));
console.log('FINANCE_DEPLOY_READINESS=NO_GO');
console.log('EVIDENCE_GATE=MANUAL_APPROVAL_AND_RUNTIME_ACCEPTANCE_REQUIRED');
console.log('PRODUCTION_DEPLOY=NO');
console.log('PRODUCTION_MIGRATION=NO');
console.log('PRODUCTION_SEED=NO');
