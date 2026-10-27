/**
 * Bridge contract snapshots ONLY from an authenticated, canonical backend.
 * Never treat frontend localStorage, mock fallback or user-submitted drafts as billing authority.
 * This is a pure preflight; no data are copied or persisted.
 */
export interface SignedContractSnapshot {
  contractId:string; contractCode:string; residentId:string;
  status:'DRAFT'|'SIGNED'|'ACTIVE'|'TERMINATED'|'CANCELLED';
  signedDate:string; effectiveDate:string; updatedAt:string;
  appendix:{
    roomType:string;bedCode:string;baseMonthlyFee:number;
    additionalServices:Array<{name:string;fee:number;selected:boolean}>;
    discount:number;totalMonthlyFee:number;
  };
}
export interface CanonicalContractContext {
  source:'VERIFIED_SERVER';
  residentId:string;
  admissionResidentId:string;
  approvedCareLevel:string;
  currentCareLevel:string;
  asOfDate:string;
  approvalVersion:string;
  changesAfterAdmissionApproved:boolean;
  effectiveTermsApproved:boolean;
}
function date(s:string):void{
 if(typeof s!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(s)||
   Number.isNaN(Date.parse(s+'T00:00:00Z'))) throw Error('CONTRACT_DATE_INVALID');
}
function amount(v:number):bigint{
 if(!Number.isSafeInteger(v)||v<0||v>9999999999999999)
  throw Error('CONTRACT_AMOUNT_INVALID');
 return BigInt(v);
}
export function validateCanonicalContractForBilling(
 contract:SignedContractSnapshot,
 ctx:CanonicalContractContext,
):{contractId:string;residentId:string;effectiveDate:string;totalMonthlyVnd:string;approvalVersion:string}{
 if(ctx?.source!=='VERIFIED_SERVER')throw Error('CONTRACT_SOURCE_UNVERIFIED');
 if(!contract || !ctx || !contract.contractId || !contract.contractCode ||
   !ctx.approvalVersion || !ctx.approvedCareLevel || !ctx.currentCareLevel)
  throw Error('CONTRACT_PROVENANCE_MISSING');
 if(contract.status!=='ACTIVE' && contract.status!=='SIGNED')
  throw Error('CONTRACT_NOT_SIGNED_OR_ACTIVE');
 if(contract.residentId!==ctx.residentId||ctx.admissionResidentId!==ctx.residentId)
  throw Error('CONTRACT_RESIDENT_MISMATCH');
 if(ctx.currentCareLevel!==ctx.approvedCareLevel ||
    ctx.changesAfterAdmissionApproved!==true || ctx.effectiveTermsApproved!==true)
  throw Error('CONTRACT_AMENDMENT_APPROVAL_REQUIRED');
 date(contract.signedDate);date(contract.effectiveDate);date(ctx.asOfDate);
 if(contract.signedDate>ctx.asOfDate||contract.effectiveDate>ctx.asOfDate)
  throw Error('CONTRACT_NOT_YET_EFFECTIVE');
 const a=contract.appendix;
 if(!a || !a.roomType?.trim() || !a.bedCode?.trim() ||
   !Array.isArray(a.additionalServices))
  throw Error('CONTRACT_ROOM_BED_OR_SERVICES_REQUIRED');
 const base=amount(a.baseMonthlyFee);
 const services=a.additionalServices.reduce((sum,s)=>{
   if(!s.name?.trim())throw Error('CONTRACT_SERVICE_UNNAMED');
   return sum+(s.selected?amount(s.fee):0n);
 },0n);
 const discount=amount(a.discount), total=amount(a.totalMonthlyFee);
 if(discount>base+services||base+services-discount!==total)
  throw Error('CONTRACT_SIGNED_FEE_MISMATCH');
 return {
  contractId:contract.contractId,residentId:ctx.residentId,
  effectiveDate:contract.effectiveDate,
  totalMonthlyVnd:total.toString(),approvalVersion:ctx.approvalVersion,
 };
}
