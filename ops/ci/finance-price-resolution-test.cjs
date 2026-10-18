'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
function find(dir,name){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);if(x.isDirectory()){const r=find(p,name);if(r)return r;}else if(x.name===name)return p;}}
const file=find(path.join(__dirname,'../../api/dist'),'finance-price-resolution.js');assert.ok(file,'Compiled price resolver missing');
const {resolveServicePrice:resolve}=require(file);
const catalog={sourceType:'PRICE_LIST',priceListId:'PL_CI',version:2,status:'APPROVED',serviceCode:'ROOM_STANDARD',scope:'ROOM',amountVnd:'5000000',effectiveFrom:'2026-10-01',effectiveTo:null,approvedBy:'CI_DIRECTOR',approvedAt:'2026-09-01T08:00:00+07:00'};
const contract={sourceType:'CONTRACT',residentId:'RES_CI',contractId:'CTR_CI',version:3,status:'ACTIVE',serviceCode:'ROOM_STANDARD',scope:'ROOM',amountVnd:'4500000',effectiveFrom:'2026-10-15',effectiveTo:null,signedAt:'2026-10-01T08:00:00+07:00',approvedAt:'2026-10-02T08:00:00+07:00',signedDocumentHash:'a'.repeat(64),approvedDocumentHash:'a'.repeat(64)};
const base={residentId:'RES_CI',serviceCode:'ROOM_STANDARD',scope:'ROOM',serviceDate:'2026-10-20',sources:[catalog,contract]};
assert.deepEqual(resolve(base),{sourceType:'CONTRACT',sourceId:'CTR_CI',version:3,serviceCode:'ROOM_STANDARD',scope:'ROOM',amountVnd:'4500000',effectivePeriod:{from:'2026-10-15',to:null},evidence:'a'.repeat(64)});
assert.equal(resolve({...base,serviceDate:'2026-10-14'}).sourceType,'PRICE_LIST');
assert.equal(resolve({...base,residentId:'OTHER'}).sourceType,'PRICE_LIST');
const rejects=(i,code)=>assert.throws(()=>resolve(i),new RegExp(code));
rejects({...base,sources:[catalog,{...catalog,priceListId:'PL_CONFLICT'}]},'FINANCE_APPROVED_PRICE_CONFLICT');
rejects({...base,sources:[catalog,{...contract,signedDocumentHash:null}]},'FINANCE_CONTRACT_PRICE_UNVERIFIED');
rejects({...base,sources:[{...catalog,status:'DRAFT'}]},'FINANCE_PRICE_SOURCE_NOT_READY');
rejects({...base,sources:[{...catalog,amountVnd:'1.5'}]},'FINANCE_PRICE_VND_INVALID');
rejects({...base,sources:[{...catalog,effectiveTo:'2026-09-30'}]},'FINANCE_PRICE_DATE_RANGE_INVALID');
console.log('FINANCE_CONTRACT_PRICE_PRECEDENCE_PASS');
