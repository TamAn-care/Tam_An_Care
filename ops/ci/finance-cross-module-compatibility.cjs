'use strict';
// Source-contract compatibility audit. Never reads real resident/finance records.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const contracts=load('frontend/src/api/service-contracts.ts');
const billing=load('frontend/src/api/billing.ts');
const finance=load('api/src/finance-billing/finance-write.controller.ts');
const baseline=load('ops/finance/v22/001_finance_foundation.sql');
const page=load('frontend/src/features/service-contracts/ServiceContractsPage.tsx');
const signoff=load('api/src/finance-billing/contract-signoff.controller.ts');
const flags={
 CONTRACTS_HAVE_LOCAL_STORAGE_FALLBACK: /localStorage\.getItem/.test(contracts)&&/localStorage\.setItem/.test(contracts),
 CONTRACTS_USE_BACKEND_API: contracts.includes('/api/service-contracts'),
 CONTRACTS_SERVER_AUTHORITATIVE: !contracts.includes('return getStoredServiceContracts();') &&
   contracts.includes('CONTRACT_SERVER_SAVE_NOT_CONFIRMED'),
 NO_CLIENT_SIDE_CONTRACT_ACTIVATION: !page.slice(page.indexOf('const handleSignContract'),page.indexOf('\n\n  return (',page.indexOf('const handleSignContract'))).includes("status: 'ACTIVE'"),
 SIGNOFF_INDEPENDENT_RELEASE_GATE: signoff.includes("TAMANCARE_CONTRACT_SIGNOFF_ENABLED!=='true'") &&
   signoff.includes('CONTRACT_INDEPENDENT_SIGNATURE_VERIFICATION_REQUIRED'),
 BILLING_HAS_SEPARATE_MONTHLY_MODEL: billing.includes('ResidentMonthlyInvoice'),
 FINANCE_CREATES_SEPARATE_CONTRACT_TABLE: baseline.includes('CREATE TABLE service_contract_records'),
 FINANCE_WRITE_FAIL_CLOSED: finance.includes("TAMANCARE_FINANCE_WRITE_ENABLED !== 'true'"),
};
for(const [k,v] of Object.entries(flags)) console.log(k+'='+(v?'YES':'NO'));
const risky=flags.CONTRACTS_HAVE_LOCAL_STORAGE_FALLBACK&&flags.FINANCE_CREATES_SEPARATE_CONTRACT_TABLE;
console.log('CONTRACT_SOURCE_OF_TRUTH='+ (risky?'NEEDS_CANONICAL_BACKEND_MAPPING':'UNVERIFIED'));
console.log('AUTOMATIC_FINANCE_CONTRACT_SYNCHRONIZATION=DISABLED');
console.log('NO_PRODUCTION_CONNECTION=YES');
if(!flags.FINANCE_WRITE_FAIL_CLOSED || !flags.CONTRACTS_SERVER_AUTHORITATIVE ||
   !flags.NO_CLIENT_SIDE_CONTRACT_ACTIVATION || !flags.SIGNOFF_INDEPENDENT_RELEASE_GATE)process.exitCode=1;
