/**
 * V3.8.18.12 — approved manual payroll / miscellaneous cash or accrual document.
 * Flexible pay is AGREED_AMOUNT, not inferred from shift count. Invoice is optional;
 * INTERNAL_VOUCHER requires attestations and independent approval.
 * Pure validator; NEVER persists, posts, seeds, or authorizes deployment.
 */
export type ManualFinanceKind='PAYROLL'|'OPERATING_EXPENSE'|'DIRECT_COST'|'REVENUE';
export type ManualEvidence='SUPPLIER_INVOICE'|'INTERNAL_VOUCHER'|'SIGNED_AGREEMENT'|'RECEIPT_OTHER';
export type ManualEntry={
 entryId:string;version:string;kind:ManualFinanceKind;
 amountVnd:string;recognitionDate:string;
 category:string;description:string;counterpartyRef:string;
 payBasis:'AGREED_AMOUNT'|'APPROVED_TIMESHEET'|'MANUAL_OTHER'|'NOT_APPLICABLE';
 source:'MANUAL';evidenceType:ManualEvidence;
 evidenceDigest:string;approvalDigest:string;
 preparedBy:string;reviewedBy:string;approvedBy:string;
 verifiedEvidence:boolean;reconciled:boolean;
 approved:boolean;monthOpen:boolean;
 /** Same obligation / accounting event must remain unique across revisions and modules */
 financialOriginKey:string;
};
export type ManualReview={status:'BLOCKED'|'ELIGIBLE_FOR_FUTURE_POSTING_REVIEW';reasons:string[];
 originKey:string|null;postingEnabled:false};
const id=/^[a-zA-Z0-9_-]{1,160}$/;
const money=/^(0|[1-9]\d*)$/;
const sha=/^[a-f0-9]{64}$/;
function dateOk(s:string){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;}
export function assessManualFinanceEntry(x:ManualEntry|null):ManualReview{
 const reasons:string[]=[];
 if(!x||typeof x!=='object'||Array.isArray(x))return{status:'BLOCKED',reasons:['DOCUMENT_MISSING'],originKey:null,postingEnabled:false};
 for(const k of ['entryId','version','counterpartyRef','preparedBy','reviewedBy','approvedBy','financialOriginKey'] as const)
  if(!id.test(x[k]||''))reasons.push('INVALID_'+k);
 if(!['PAYROLL','OPERATING_EXPENSE','DIRECT_COST','REVENUE'].includes(x.kind))reasons.push('KIND_INVALID');
 if(!money.test(x.amountVnd||'')||BigInt(money.test(x.amountVnd||'')?x.amountVnd:'0')>9999999999999999n)reasons.push('AMOUNT_INVALID');
 if(!dateOk(x.recognitionDate))reasons.push('DATE_INVALID');
 if(typeof x.category!=='string'||x.category.trim().length<2||typeof x.description!=='string'||x.description.trim().length<8)reasons.push('BUSINESS_PURPOSE_REQUIRED');
 if(x.source!=='MANUAL')reasons.push('SOURCE_INVALID');
 if(!['SUPPLIER_INVOICE','INTERNAL_VOUCHER','SIGNED_AGREEMENT','RECEIPT_OTHER'].includes(x.evidenceType))reasons.push('EVIDENCE_TYPE_INVALID');
 if(!sha.test(x.evidenceDigest||'')||!sha.test(x.approvalDigest||'')||x.verifiedEvidence!==true)reasons.push('EVIDENCE_NOT_VERIFIED');
 if(new Set([x.preparedBy,x.reviewedBy,x.approvedBy]).size!==3)reasons.push('SEGREGATION_FAILED');
 if(x.reconciled!==true||x.approved!==true||x.monthOpen!==true)reasons.push('APPROVAL_RECONCILIATION_PERIOD_REQUIRED');
 if(x.kind==='PAYROLL'&&!['AGREED_AMOUNT','APPROVED_TIMESHEET','MANUAL_OTHER'].includes(x.payBasis))reasons.push('PAY_BASIS_REQUIRED');
 if(x.kind!=='PAYROLL'&&x.payBasis!=='NOT_APPLICABLE')reasons.push('PAY_BASIS_MISMATCH');
 // Any receipt represents evidence; it must not be automatically recognized
 // as revenue a second time when linked to an already posted invoice.
 if(x.kind==='REVENUE'&&x.evidenceType==='RECEIPT_OTHER')reasons.push('RECEIPT_IS_NOT_REVENUE');
 const originKey=id.test(x.financialOriginKey||'')?x.financialOriginKey:null;
 return {status:reasons.length?'BLOCKED':'ELIGIBLE_FOR_FUTURE_POSTING_REVIEW',reasons,originKey,postingEnabled:false};
}
