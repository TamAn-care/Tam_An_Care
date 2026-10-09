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
 ['CONTRACT_MAPPING_APPROVED',has('docs/finance-contract-mapping-approved.md')],
 ['RUNTIME_SCHEMA_APPROVED',has('docs/finance-runtime-schema-approval.md')],
 ['HTTP_JWT_E2E_EVIDENCE',has('ops/ci/finance-http-jwt-e2e-tested.marker')]
];
for(const [name,pass] of gates) console.log('GATE_'+name+'='+(pass?'PASS':'BLOCKED'));
console.log('FINANCE_DEPLOY_READINESS='+ (gates.every(x=>x[1])?'CANDIDATE_REQUIRES_HUMAN_APPROVAL':'NO_GO'));
console.log('PRODUCTION_DEPLOY=NO');
console.log('PRODUCTION_MIGRATION=NO');
console.log('PRODUCTION_SEED=NO');
