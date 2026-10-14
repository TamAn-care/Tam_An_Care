'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'../..');
const frontend=path.join(root,'frontend/src');
const contractApi=path.join(
  frontend,'api/service-contracts.ts'
);

const source=fs.readFileSync(contractApi,'utf8');

for(const banned of [
  'taman_service_contracts_v1',
  'getStoredServiceContracts',
  'saveStoredServiceContracts',
  'localStorage.getItem',
  'localStorage.setItem',
]) {
  assert.ok(!source.includes(banned),
    'Forbidden contract persistence: '+banned);
}

for(const required of [
  "apiRequest<ServiceContract[]>('/api/service-contracts'",
  "'/api/service-contract-drafts'",
  'CONTRACT_SERVER_SAVE_NOT_CONFIRMED',
  'CONTRACT_SIGNED_EDIT_REQUIRES_AMENDMENT',
  'CONTRACT_DELETION_REQUIRES_CONTROLLED_ARCHIVE',
  'CONTRACT_LOCAL_STORAGE_READ_FAILED',
]) {
  if(required==='CONTRACT_LOCAL_STORAGE_READ_FAILED') {
    assert.ok(!source.includes(required),
      'Legacy local storage fallback remains');
  } else {
    assert.ok(source.includes(required),
      'Canonical server behavior missing: '+required);
  }
}

const sourceFiles=[];
function walk(dir) {
  for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
    const full=path.join(dir,item.name);
    if(item.isDirectory())walk(full);
    else if(/\.(tsx?|jsx?)$/.test(item.name))sourceFiles.push(full);
  }
}
walk(frontend);

for(const file of sourceFiles) {
  const content=fs.readFileSync(file,'utf8');

  for(const legacy of [
    'getStoredServiceContracts',
    'saveStoredServiceContracts',
    'taman_service_contracts_v1',
  ]) {
    assert.ok(!content.includes(legacy),
      'Legacy contract reference: '+
      path.relative(root,file));
  }
}

console.log('CONTRACT_SERVER_ONLY_SOURCE_GATE=PASS');
console.log('LEGACY_CONTRACT_BROWSER_PERSISTENCE=ABSENT');
console.log('SERVER_DRAFT_API=RETAINED');
console.log('SERVER_CONTRACT_READ_API=RETAINED');
console.log('API_FAILURE_FALLBACK=NOT_ADDED');


// Startup cleanup must not delete historical contract data.
const startup=fs.readFileSync(
  path.join(frontend,'main.tsx'),'utf8'
);
assert.ok(!startup.includes('taman_service_contracts_v1'),
  'Startup cleanup would delete historical contracts');

console.log('HISTORICAL_CONTRACT_CLEANUP_GUARD=PASS');
