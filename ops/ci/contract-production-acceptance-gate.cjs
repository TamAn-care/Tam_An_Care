'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const files={
 frontend:read('frontend/src/api/service-contracts.ts'),
 signoff:read('api/src/finance-billing/contract-signoff.controller.ts'),
 versions:read('ops/finance/v30/005_shared_contract_version_history.sql'),
 evidence:read('ops/finance/v30/006_shared_contract_signoff_evidence.sql'),
 approval:read('api/src/finance-billing/contract-approval-policy.ts'),
 ops:read('api/src/finance-billing/contract-operational-evidence.service.ts'),
};
const gate={
 NO_HARDCODED_DEMO_CONTRACT:!files.frontend.includes('MOCK_SERVICE_CONTRACTS'),
 FRONTEND_SERVER_ONLY_READ:/return await apiRequest<ServiceContract>/.test(files.frontend)
   && !/return getStoredServiceContracts\(\)/.test(files.frontend),
 SERVER_SIGNOFF_RESTRICTED:/TAMANCARE_CONTRACT_SIGNOFF_ENABLED/.test(files.signoff),
 SEPARATE_SIGNOFF_ROLES:/TAMANCARE_CONTRACT_SIGNATURE_VERIFY_ROLES/.test(files.signoff)&&/TAMANCARE_CONTRACT_APPROVER_ROLES/.test(files.signoff),
 IMMUTABLE_HISTORY:/SIGNED_CONTRACT_TERMS_IMMUTABLE/.test(files.versions),
 IMMUTABLE_APPROVAL_EVIDENCE:/CONTRACT_EVIDENCE_IMMUTABLE/.test(files.evidence),
 ADMISSIONS_CARE_READ:/admission_care_classifications/.test(files.signoff),
 ROOM_BED_READ:/bed_assignments/.test(files.signoff),
 COST_TOTAL_CHECK:/CONTRACT_FEE_RECONCILIATION_FAILED/.test(files.signoff),
 MANUAL_LEGACY_REVIEW_REQUIRED:!files.frontend.includes('autoImportLocalStorage'),
};
for(const [name,ok] of Object.entries(gate)) console.log('CONTRACT_'+name+'='+(ok?'PASS':'FAIL'));
const blockers=[
 'PRODUCTION_CONTRACT_SCHEMA_ABSENT_AT_READONLY_AUDIT',
 'LEGACY_BROWSER_REAL_VS_DEMO_REVIEW_NOT_PROVEN',
 'TRUSTED_SIGNED_DOCUMENT_BYTES_AND_HASH_NOT_VERIFIED',
 'REAL_RUNTIME_JWT_ROLES_AND_ROUTE_ACCEPTANCE_NOT_PROVEN',
 'BACKUP_RESTORE_AND_CONTROLLED_MIGRATION_NOT_APPROVED',
 'FINANCE_LEDGER_INVOICE_POSTING_NOT_RECONCILED',
];
for(const b of blockers) console.log('RELEASE_BLOCKED_'+b+'=YES');
console.log('CONTRACT_PRODUCTION_READINESS=NO_GO');
console.log('PRODUCTION_MUTATION=NO');
if(Object.values(gate).some(x=>!x))process.exitCode=1;
