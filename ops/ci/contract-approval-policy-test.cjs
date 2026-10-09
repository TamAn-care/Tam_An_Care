'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function find(dir,name){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory()){const x=find(p,name);if(x)return x;}else if(f.name===name)return p;}}
const m=require(find(path.join(__dirname,'../../api/dist'),'contract-approval-policy.js'));
const e={source:'VERIFIED_SERVER',contractId:'C1',residentId:'R1',version:1,
 authorId:'AUTHOR',signerId:'SIGNER',approverId:'DIRECTOR',
 signedDocumentHash:'a'.repeat(64),signedAt:'2026-10-01T09:00:00Z',
 approvedAt:'2026-10-01T10:00:00Z',effectiveDate:'2026-10-02',
 admissionResidentId:'R1',assignedResidentId:'R1',
 admissionApprovedCareLevel:'II',currentCareLevel:'II',
 roomBedConfirmed:true,pricingReviewed:true,amendmentApproved:true};
assert.doesNotThrow(()=>m.validateContractActivation(e));
const cases=[
 [{source:'LOCAL_STORAGE'},/SOURCE_UNVERIFIED/],
 [{approverId:'SIGNER'},/APPROVER_MUST_BE_INDEPENDENT/],
 [{signedDocumentHash:'bad'},/DOCUMENT_HASH_REQUIRED/],
 [{admissionResidentId:'R2'},/RESIDENT_REFERENCE_MISMATCH/],
 [{assignedResidentId:'R2'},/RESIDENT_REFERENCE_MISMATCH/],
 [{currentCareLevel:'III'},/CARE_PRICE_OR_BED_NOT_APPROVED/],
 [{roomBedConfirmed:false},/CARE_PRICE_OR_BED_NOT_APPROVED/],
 [{pricingReviewed:false},/CARE_PRICE_OR_BED_NOT_APPROVED/],
 [{amendmentApproved:false},/CARE_PRICE_OR_BED_NOT_APPROVED/],
 [{approvedAt:'2026-09-30T10:00:00Z'},/APPROVAL_PRECEDES_SIGNATURE/],
];
for(const [v,re] of cases)assert.throws(()=>m.validateContractActivation({...e,...v}),re);
console.log('CONTRACT_SEPARATE_APPROVAL_ADMISSION_ROOM_PRICE_PASS');
