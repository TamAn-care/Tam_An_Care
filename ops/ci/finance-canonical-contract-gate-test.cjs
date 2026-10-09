'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
function find(dir,name){
 for(const x of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,x.name);
  if(x.isDirectory()){const r=find(p,name);if(r)return r;}
  else if(x.name===name)return p;
 }
}
const compiled=find(path.join(__dirname,'../../api/dist'),'finance-canonical-contract-gate.js');
assert.ok(compiled,'Compiled contract gate missing');
const {validateCanonicalContractForBilling:check}=require(compiled);
const contract={
 contractId:'CI_CONTRACT',contractCode:'CI_CODE',residentId:'CI_RESIDENT',status:'ACTIVE',
 signedDate:'2026-10-01',effectiveDate:'2026-10-01',updatedAt:'2026-10-02',
 appendix:{roomType:'CI_ROOM',bedCode:'CI_BED',baseMonthlyFee:100,
 additionalServices:[{name:'CI_SERVICE',fee:30,selected:true}],discount:10,totalMonthlyFee:120},
};
const ctx={source:'VERIFIED_SERVER',residentId:'CI_RESIDENT',admissionResidentId:'CI_RESIDENT',
 approvedCareLevel:'II',currentCareLevel:'II',asOfDate:'2026-10-09',
 approvalVersion:'CI_VERSION',changesAfterAdmissionApproved:true,effectiveTermsApproved:true};
assert.equal(check(contract,ctx).totalMonthlyVnd,'120');
const rejects=(c,d,pattern)=>assert.throws(()=>check(c,d),pattern);
rejects(contract,{...ctx,source:'FRONTEND_LOCAL_STORAGE'},/CONTRACT_SOURCE_UNVERIFIED/);
rejects({...contract,status:'DRAFT'},ctx,/CONTRACT_NOT_SIGNED_OR_ACTIVE/);
rejects({...contract,residentId:'OTHER'},ctx,/CONTRACT_RESIDENT_MISMATCH/);
rejects(contract,{...ctx,currentCareLevel:'III'},/CONTRACT_AMENDMENT_APPROVAL_REQUIRED/);
rejects(contract,{...ctx,changesAfterAdmissionApproved:false},/CONTRACT_AMENDMENT_APPROVAL_REQUIRED/);
rejects({...contract,appendix:{...contract.appendix,totalMonthlyFee:125}},ctx,/CONTRACT_SIGNED_FEE_MISMATCH/);
rejects({...contract,effectiveDate:'2026-11-01'},ctx,/CONTRACT_NOT_YET_EFFECTIVE/);
console.log('FINANCE_CANONICAL_CONTRACT_GATE_PASS');
