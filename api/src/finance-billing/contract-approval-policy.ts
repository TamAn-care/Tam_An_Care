/**
 * Pure contract-signing acceptance rules.
 * Not a write API. Prevents activation until verified operational sources
 * and separate human approval attestations are supplied by backend.
 */
export type ContractApprovalEvidence = {
 contractId:string; residentId:string;
 version:number; authorId:string; signerId:string; approverId:string;
 signedDocumentHash:string; signedAt:string;
 approvedAt:string; effectiveDate:string;
 source:'VERIFIED_SERVER';
 admissionResidentId:string; assignedResidentId:string;
 admissionApprovedCareLevel:string; currentCareLevel:string;
 roomBedConfirmed:boolean; pricingReviewed:boolean;
 amendmentApproved:boolean;
};
export function validateContractActivation(e:ContractApprovalEvidence):void {
 if(e?.source!=='VERIFIED_SERVER')throw Error('CONTRACT_SOURCE_UNVERIFIED');
 const id=(s:unknown)=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(s);
 if(![e.contractId,e.residentId,e.authorId,e.signerId,e.approverId,
   e.admissionResidentId,e.assignedResidentId].every(id)||
   !Number.isSafeInteger(e.version)||e.version<1)
  throw Error('CONTRACT_ACTIVATION_ID_INVALID');
 if(e.authorId===e.approverId||e.signerId===e.approverId)
  throw Error('CONTRACT_APPROVER_MUST_BE_INDEPENDENT');
 if(!/^[a-f0-9]{64}$/i.test(e.signedDocumentHash))
  throw Error('CONTRACT_SIGNED_DOCUMENT_HASH_REQUIRED');
 for(const value of [e.signedAt,e.approvedAt]){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||
      !Number.isFinite(Date.parse(value)))throw Error('CONTRACT_APPROVAL_DATE_INVALID');
 }
 if(Date.parse(e.approvedAt)<Date.parse(e.signedAt))
  throw Error('CONTRACT_APPROVAL_PRECEDES_SIGNATURE');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.effectiveDate)||
    Number.isNaN(Date.parse(e.effectiveDate+'T00:00:00Z')))
  throw Error('CONTRACT_EFFECTIVE_DATE_INVALID');
 if(e.residentId!==e.admissionResidentId||
    e.residentId!==e.assignedResidentId)
  throw Error('CONTRACT_RESIDENT_REFERENCE_MISMATCH');
 if(!e.currentCareLevel||e.currentCareLevel!==e.admissionApprovedCareLevel||
    !e.roomBedConfirmed||!e.pricingReviewed||!e.amendmentApproved)
  throw Error('CONTRACT_CARE_PRICE_OR_BED_NOT_APPROVED');
}
