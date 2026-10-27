/**
 * Finance V3.8.18.4 — pure source-to-ledger monthly recognition contract.
 * No I/O, database writes, seed, demo rows, endpoints or runtime registration.
 * Monetary values remain integer decimal strings: never use JS floats.
 */
export type FinanceRecognitionKind =
  'REVENUE'|'DIRECT_COST'|'PAYROLL'|'OPERATING_EXPENSE'|'DEPRECIATION'|'INTEREST'|'TAX';
export type FinanceEvidenceStatus = 'VERIFIED'|'UNVERIFIED';
export type RecognitionCandidate = {
  sourceDomain:string;
  sourceEntityType:string;
  sourceEntityId:string;
  entryType:FinanceRecognitionKind;
  recognitionDate:string;
  amountVnd:string;
  documentStatus:'APPROVED'|'DRAFT'|'VOID';
  sourceEvidence:FinanceEvidenceStatus;
  approvalEvidence:FinanceEvidenceStatus;
  reconciliationEvidence:FinanceEvidenceStatus;
  sourceKind:'CONTRACT'|'INVOICE'|'RECEIPT'|'PAYMENT_ALLOCATION'|'COST_DOCUMENT'|'PAYROLL_DOCUMENT'|'MANUAL_DOCUMENT';
};
export type RecognitionAssessment={
  eligibleForFuturePosting:false;
  sourceKey:string|null;
  recognitionMonth:string|null;
  reasons:string[];
};
const KINDS=new Set<string>(['REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX']);
const FINANCIAL_ORIGINS=new Set<string>(['INVOICE','COST_DOCUMENT','PAYROLL_DOCUMENT','MANUAL_DOCUMENT']);
const VALID_DATE=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const VALID_VND=/^(0|[1-9]\d*)$/;
const VALID_ID=/^[A-Za-z0-9_-]{1,160}$/;
export function assessMonthlyRecognition(value:unknown):RecognitionAssessment {
 const fail=(reasons:string[],key:string|null=null,month:string|null=null):RecognitionAssessment=>({
   eligibleForFuturePosting:false,sourceKey:key,recognitionMonth:month,reasons
 });
 if(!value || typeof value!=='object'||Array.isArray(value))return fail(['INVALID_SOURCE']);
 const v=value as Partial<RecognitionCandidate>;
 const reasons:string[]=[];
 const idFields=[v.sourceDomain,v.sourceEntityType,v.sourceEntityId];
 if(idFields.some(x=>typeof x!=='string'||!VALID_ID.test(x)))reasons.push('SOURCE_IDENTITY_INVALID');
 const key=reasons.includes('SOURCE_IDENTITY_INVALID')?null:idFields.join(':');
 if(!KINDS.has(v.entryType||''))reasons.push('ENTRY_TYPE_INVALID');
 if(!VALID_DATE.test(v.recognitionDate||'') ||
  Number.isNaN(Date.parse((v.recognitionDate||'')+'T00:00:00Z')) ||
  new Date((v.recognitionDate||'')+'T00:00:00Z').toISOString().slice(0,10)!==v.recognitionDate)reasons.push('RECOGNITION_DATE_INVALID');
 if(typeof v.amountVnd!=='string'||!VALID_VND.test(v.amountVnd) ||
  (VALID_VND.test(v.amountVnd||'') && BigInt(v.amountVnd!)>9999999999999999n))reasons.push('AMOUNT_INVALID');
 if(v.documentStatus!=='APPROVED')reasons.push('DOCUMENT_NOT_APPROVED');
 if(v.sourceEvidence!=='VERIFIED')reasons.push('SOURCE_UNVERIFIED');
 if(v.approvalEvidence!=='VERIFIED')reasons.push('APPROVAL_UNVERIFIED');
 if(v.reconciliationEvidence!=='VERIFIED')reasons.push('RECONCILIATION_UNVERIFIED');
 if(!FINANCIAL_ORIGINS.has(v.sourceKind||''))reasons.push('NON_RECOGNITION_SOURCE');
 // Invoice can be an evidence basis for revenue, not cash settlement.
 if(v.sourceKind==='INVOICE'&&v.entryType!=='REVENUE')reasons.push('INVOICE_CATEGORY_MISMATCH');
 // Payment receipts and allocations never create a second revenue event.
 // Contract alone proves a tariff, not a delivered service or accrued fee.
 if(v.sourceKind==='COST_DOCUMENT'&&v.entryType==='REVENUE')reasons.push('COST_CATEGORY_MISMATCH');
 if(v.sourceKind==='PAYROLL_DOCUMENT'&&v.entryType!=='PAYROLL')reasons.push('PAYROLL_CATEGORY_MISMATCH');
 if(reasons.length===0)reasons.push('PERSISTENCE_AND_MONTH_CLOSE_UNVERIFIED');
 return fail(reasons,key,
   VALID_DATE.test(v.recognitionDate||'')&& !reasons.includes('RECOGNITION_DATE_INVALID')?
   v.recognitionDate!.slice(0,7):null);
}
