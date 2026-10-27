/**
 * V3.8 pre-posting finance source intake contract (pure validation only).
 * No controller, DML, auto-post, migration or test data on live systems.
 * Source identity, separation of duties and reconciliation evidence must be
 * checked again inside a future database transaction before a write is enabled.
 */
export type CanonicalKind = 'REVENUE'|'DIRECT_COST'|'PAYROLL'|'OPERATING_EXPENSE'|
  'DEPRECIATION'|'INTEREST'|'TAX';
export type FinanceSourceCandidate = {
  sourceMode: 'SYSTEM'|'MANUAL';
  sourceDomain: string;
  sourceEntityType: string;
  sourceEntityId: string;
  entryType: CanonicalKind;
  recognitionDate: string;
  amountVnd: string;
  referenceNumber: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  externalEvidenceDigest: string;
  approvalEvidenceDigest: string;
  sourceReconciled: boolean;
  ledgerMonthOpen: boolean;
};
export type SourceIntakeReview = {
  eligibleForFuturePosting: boolean;
  postingEnabled: false;
  reasons: string[];
  sourceKey: string | null;
};
const TYPES = new Set<string>([
  'REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE',
  'DEPRECIATION','INTEREST','TAX',
]);
const ID = /^[A-Za-z0-9_-]{1,160}$/;
const SOURCE = /^[A-Z][A-Z0-9_]{1,63}$/;
const VND = /^(0|[1-9]\d*)(?:\.0{1,2})?$/;
const DIGEST = /^[a-f0-9]{64}$/;
export function reviewFinanceSourceForFuturePosting(
  candidate: FinanceSourceCandidate,
): SourceIntakeReview {
  const reasons: string[] = [];
  if (!candidate || typeof candidate !== 'object')
    return {eligibleForFuturePosting:false,postingEnabled:false,
      reasons:['SOURCE_CANDIDATE_MISSING'],sourceKey:null};
  if (!SOURCE.test(candidate.sourceDomain ?? '') ||
      !SOURCE.test(candidate.sourceEntityType ?? '') ||
      !ID.test(candidate.sourceEntityId ?? '') ||
      !['SYSTEM','MANUAL'].includes(candidate.sourceMode))
    reasons.push('SOURCE_IDENTITY_INVALID');
  if (!TYPES.has(candidate.entryType)) reasons.push('ENTRY_TYPE_INVALID');
  if (typeof candidate.amountVnd !== 'string' || !VND.test(candidate.amountVnd) ||
      BigInt(VND.test(candidate.amountVnd ?? '') ?
        candidate.amountVnd.split('.')[0] : '0') > 9999999999999999n)
    reasons.push('AMOUNT_INVALID');
  const d=candidate.recognitionDate;
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      Number.isNaN(Date.parse(d)) ||
      new Date(d).toISOString().slice(0,10)!==d)
    reasons.push('RECOGNITION_DATE_INVALID');
  if (typeof candidate.referenceNumber !== 'string' ||
      candidate.referenceNumber.trim().length < 2)
    reasons.push('REFERENCE_REQUIRED');
  if (![candidate.preparedBy,candidate.reviewedBy,candidate.approvedBy]
      .every(v=>typeof v==='string' && ID.test(v)))
    reasons.push('ACTOR_IDENTITY_INVALID');
  if (candidate.preparedBy === candidate.reviewedBy ||
      candidate.preparedBy === candidate.approvedBy ||
      candidate.reviewedBy === candidate.approvedBy)
    reasons.push('SEGREGATION_OF_DUTIES_FAILED');
  if (!DIGEST.test(candidate.externalEvidenceDigest ?? '') ||
      !DIGEST.test(candidate.approvalEvidenceDigest ?? ''))
    reasons.push('EVIDENCE_MISSING');
  if (candidate.sourceReconciled !== true) reasons.push('SOURCE_NOT_RECONCILED');
  if (candidate.ledgerMonthOpen !== true) reasons.push('PERIOD_NOT_OPEN');
  const sourceKey=reasons.includes('SOURCE_IDENTITY_INVALID') ? null :
    [candidate.sourceDomain,candidate.sourceEntityType,
      candidate.sourceEntityId,candidate.entryType].join('|');
  return {eligibleForFuturePosting:reasons.length===0,
    postingEnabled:false,reasons,sourceKey};
}
