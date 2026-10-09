/**
 * V3.8.7 API input contract — pure fail-closed validation, not an HTTP route.
 * Identity, RBAC, proof authenticity and idempotency are server-side concerns.
 * This module must NOT enable DB writes or create test business data.
 */
export type FinanceDocumentDraftInput = {
  documentId: string;
  sourceDomain: string;
  sourceEntityType: string;
  sourceEntityId: string;
  entryType: string;
  recognitionDate: string;
  amountVnd: string;
  externalEvidenceDigest: string;
  referenceNumber: string;
};
export type FinanceDraftCheck = {
  accepted: boolean;
  reasons: string[];
  postingEnabled: false;
};
const ID=/^[A-Za-z0-9_-]{1,160}$/;
const SOURCE=/^[A-Z][A-Z0-9_]{1,63}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const AMOUNT=/^(0|[1-9][0-9]*)$/;
const TYPES=new Set(['REVENUE','DIRECT_COST','PAYROLL',
  'OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX']);
export function validateFinanceDocumentDraft(
  value: unknown,
): FinanceDraftCheck {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {accepted:false,reasons:['INVALID_DOCUMENT_INPUT'],postingEnabled:false};
  const v=value as Record<string,unknown>;
  const reasons:string[]=[];
  const expected=['documentId','sourceDomain','sourceEntityType',
    'sourceEntityId','entryType','recognitionDate','amountVnd',
    'externalEvidenceDigest','referenceNumber'];
  if (Object.keys(v).some(key=>!expected.includes(key)))
    reasons.push('UNEXPECTED_FIELD');
  if (typeof v.documentId!=='string'||!ID.test(v.documentId)||
      typeof v.sourceEntityId!=='string'||!ID.test(v.sourceEntityId)||
      typeof v.sourceDomain!=='string'||!SOURCE.test(v.sourceDomain)||
      typeof v.sourceEntityType!=='string'||!SOURCE.test(v.sourceEntityType))
    reasons.push('INVALID_SOURCE_IDENTITY');
  if (typeof v.entryType!=='string'||!TYPES.has(v.entryType))
    reasons.push('INVALID_ENTRY_TYPE');
  if (typeof v.amountVnd!=='string'||!AMOUNT.test(v.amountVnd)||
      (typeof v.amountVnd==='string'&&AMOUNT.test(v.amountVnd)&&
       BigInt(v.amountVnd)>9999999999999999n))
    reasons.push('INVALID_AMOUNT');
  const date=v.recognitionDate;
  if (typeof date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||
      Number.isNaN(Date.parse(date))||
      new Date(date).toISOString().slice(0,10)!==date)
    reasons.push('INVALID_RECOGNITION_DATE');
  if (typeof v.externalEvidenceDigest!=='string'||
      !DIGEST.test(v.externalEvidenceDigest))
    reasons.push('INVALID_EVIDENCE_DIGEST');
  if (typeof v.referenceNumber!=='string'||
      v.referenceNumber.trim().length<2||v.referenceNumber.length>200)
    reasons.push('INVALID_REFERENCE');
  return {accepted:reasons.length===0,reasons,postingEnabled:false};
}
