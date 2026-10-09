'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dist=path.resolve(__dirname,'../../api/dist');
function locate(folder,name){for(const x of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,x.name);if(x.isDirectory()){const r=locate(p,name);if(r)return r;}else if(x.name===name)return p;}}
const file=locate(dist,'contract-invoice-basis.js');assert.ok(file);
const {validateInvoiceContractBasis:check}=require(file);
const c={source:'VERIFIED_SERVER',contractId:'CI_CONTRACT',residentId:'CI_RESIDENT',version:2,status:'ACTIVE',approvedAt:'2026-09-20',signedAt:'2026-09-19',effectiveDate:'2026-10-01',monthlyFeeVnd:'120'};
const i={contractId:'CI_CONTRACT',residentId:'CI_RESIDENT',contractVersion:2,billingMonth:'2026-10-01',totalVnd:'120',status:'DRAFT'};
assert.equal(check(c,i).monthlyVnd,'120');
for(const [contract,invoice,error] of [
 [{...c,source:'BROWSER_LOCAL_STORAGE'},i,/SOURCE_UNVERIFIED/],
 [c,{...i,residentId:'DIFFERENT'},/IDENTITY_MISMATCH/],
 [c,{...i,contractVersion:1},/VERSION_MISMATCH/],
 [{...c,status:'DRAFT'},i,/NOT_APPROVED/],
 [{...c,effectiveDate:'2026-10-15'},i,/NOT_EFFECTIVE/],
 [c,{...i,totalVnd:'121'},/TOTAL_MISMATCH/],
 [c,{...i,status:'ISSUED'},/ISSUED_INVOICE_IMMUTABLE/],
])assert.throws(()=>check(contract,invoice),error);
console.log('CONTRACT_FINANCE_CANONICAL_INVOICE_BASIS_PASS');
console.log('FINANCE_LEDGER_WRITE=NO INVOICE_ISSUE=NO');
