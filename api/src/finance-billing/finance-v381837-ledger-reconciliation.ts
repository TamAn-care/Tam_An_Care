/** V3.8.18.37 — CI-only mapping from V36 isolated ledger to live ledger contract.
 * No PostgreSQL access, no posting, no recognition from cash dates.
 * Status stays NOT_READY until independent live source and month-close evidence.
 */
export type V37LedgerInput={documentId:string;originKey:string;kind:'REVENUE'|'DIRECT_COST'|'OPERATING_EXPENSE'|'PAYROLL';amountVnd:string;recognitionDate:string;status:string;approvedRevision:number;postingClaimCount:number;postingAuditCount:number};
export type V37Decision={eligible:boolean;entryType:'REVENUE'|'EXPENSE'|null;recognitionDate:string|null;amountVnd:string|null;reasons:string[];readyForLivePosting:false};
const date=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const token=/^[a-zA-Z0-9_-]{1,160}$/;
export function reconcileV37(v:V37LedgerInput):V37Decision{
 const reasons:string[]=[];
 if(!v||!token.test(v.documentId)||!token.test(v.originKey))reasons.push('SOURCE_ID_INVALID');
 if(!['REVENUE','DIRECT_COST','OPERATING_EXPENSE','PAYROLL'].includes(v?.kind))reasons.push('KIND_INVALID');
 if(v?.status!=='APPROVED'||!Number.isSafeInteger(v?.approvedRevision)||v.approvedRevision<1)reasons.push('APPROVAL_UNVERIFIED');
 if(v?.postingClaimCount!==1||v?.postingAuditCount!==1)reasons.push('POSTING_PROOF_INCOMPLETE');
 if(typeof v?.amountVnd!=='string'||!/^(0|[1-9]\d{0,15})$/.test(v.amountVnd))reasons.push('AMOUNT_INVALID');
 if(typeof v?.recognitionDate!=='string'||!date.test(v.recognitionDate)||
  Number.isNaN(Date.parse(v.recognitionDate+'T00:00:00Z'))||
  new Date(v.recognitionDate+'T00:00:00Z').toISOString().slice(0,10)!==v.recognitionDate)reasons.push('RECOGNITION_DATE_INVALID');
 const valid=reasons.length===0;
 return{eligible:valid,entryType:valid?(v.kind==='REVENUE'?'REVENUE':'EXPENSE'):null,
 recognitionDate:valid?v.recognitionDate:null,amountVnd:valid?v.amountVnd:null,reasons,readyForLivePosting:false};
}
