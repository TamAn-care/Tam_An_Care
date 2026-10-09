'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const c=fs.readFileSync(path.join(__dirname,'../../frontend/src/api/service-contracts.ts'),'utf8');
function fn(name,next){
 const i=c.indexOf('export async function '+name+'(');
 assert.ok(i>=0,name+' exported');
 return c.slice(i,next?c.indexOf('export async function '+next+'(',i):c.length);
}
const list=fn('listServiceContracts','getServiceContract');
const get=fn('getServiceContract','saveServiceContract');
const save=fn('saveServiceContract','deleteServiceContract');
const remove=fn('deleteServiceContract','proposeServiceContractAmendment');
assert.doesNotMatch(c,/MOCK_SERVICE_CONTRACTS|res-demo-001|ctr-demo-001/,'Demo contract must not be bundled');
for(const [name,body] of [['list',list],['get',get],['save',save],['delete',remove]]){
 assert.doesNotMatch(body,/getStoredServiceContracts\(|saveStoredServiceContracts\(|localStorage/,'Backend operation '+name+' must never use local cache');
}
assert.match(list,/apiRequest/);
assert.match(get,/apiRequest/);
assert.match(save,/apiRequest/);
assert.match(save,/CONTRACT_SERVER_SAVE_NOT_CONFIRMED/);
assert.match(remove,/CONTRACT_DELETION_REQUIRES_CONTROLLED_ARCHIVE/);
assert.doesNotMatch(save,/catch\s*\{\s*\}/);
assert.doesNotMatch(remove,/catch\s*\{\s*\}/);
console.log('SHARED_CONTRACT_BROWSER_SOURCE_ISOLATION_PASS');
console.log('OLD_LOCAL_STORAGE_NOT_CLEARED=YES');
console.log('PRODUCTION_MOCK_AUTO_SEED=NO');
