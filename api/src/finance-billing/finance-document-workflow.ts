/**
 * V3.8.1 isolated document workflow. Pure reducer, no database writes.
 * Actual persistence, row locks, session RBAC and external evidence verification
 * are NOT implemented; posting is permanently disabled here.
 */
import {
  reviewFinanceSourceForFuturePosting,
  type FinanceSourceCandidate,
} from './finance-source-intake';

export type DocumentState = 'DRAFT'|'SUBMITTED'|'REVIEWED'|'APPROVED'|'REJECTED';
export type DocumentAction = 'SUBMIT'|'REVIEW'|'APPROVE'|'REJECT';
export type DocumentAudit = {
  sequence: number;
  action: DocumentAction;
  actorId: string;
  from: DocumentState;
  to: DocumentState;
  reason: string;
};
export type FinanceDocument = {
  documentId: string;
  revision: number;
  state: DocumentState;
  preparedBy: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  candidate: FinanceSourceCandidate;
  audit: readonly DocumentAudit[];
};
export type TransitionResult = {
  accepted: boolean;
  postingEnabled: false;
  reasons: string[];
  document: FinanceDocument;
};
const transitions: Record<DocumentAction,{from:DocumentState;to:DocumentState}> = {
  SUBMIT:{from:'DRAFT',to:'SUBMITTED'},
  REVIEW:{from:'SUBMITTED',to:'REVIEWED'},
  APPROVE:{from:'REVIEWED',to:'APPROVED'},
  REJECT:{from:'SUBMITTED',to:'REJECTED'},
};
const ACTOR=/^[A-Za-z0-9_-]{1,160}$/;
export function applyFinanceDocumentTransition(input: {
  document: FinanceDocument;
  action: DocumentAction;
  actorId: string;
  expectedRevision: number;
  reason: string;
  sourceKeyAlreadyUsed: boolean;
}): TransitionResult {
  const {document,action,actorId,expectedRevision,reason,sourceKeyAlreadyUsed}=input;
  const errors:string[]=[];
  const step=Object.prototype.hasOwnProperty.call(transitions,action)
    ? transitions[action] : null;
  if (!step || !document || !ACTOR.test(actorId ?? '')) errors.push('INVALID_ACTION_OR_ACTOR');
  if (!document || !Number.isSafeInteger(document.revision) ||
      document.revision<0 || document.revision!==expectedRevision)
    errors.push('STALE_DOCUMENT_REVISION');
  if (!step || document?.state!==step.from) errors.push('INVALID_TRANSITION');
  if (sourceKeyAlreadyUsed!==false) errors.push('DUPLICATE_OR_UNCHECKED_SOURCE');
  if (!document || !Array.isArray(document.audit) ||
      document.audit.length!==document.revision ||
      !ACTOR.test(document.preparedBy ?? '') ||
      !ACTOR.test(document.documentId ?? ''))
    errors.push('INVALID_DOCUMENT_HISTORY');
  if (typeof reason!=='string' || reason.trim().length<5)
    errors.push('AUDIT_REASON_REQUIRED');
  if (document) {
    const prepared=document.preparedBy;
    const reviewed=document.reviewedBy;
    if (action==='SUBMIT' && actorId!==prepared)
      errors.push('SUBMITTER_NOT_PREPARER');
    if (action==='REVIEW' && actorId===prepared)
      errors.push('SELF_REVIEW_FORBIDDEN');
    if (action==='APPROVE' &&
        (actorId===prepared || actorId===reviewed || !reviewed))
      errors.push('APPROVER_NOT_INDEPENDENT');
    if (action==='REJECT' && actorId===prepared)
      errors.push('SELF_REJECTION_FORBIDDEN');
    if (action==='APPROVE') {
      const outcome=reviewFinanceSourceForFuturePosting(document.candidate);
      if (!outcome.eligibleForFuturePosting) errors.push(...outcome.reasons);
      if (outcome.sourceKey===null) errors.push('SOURCE_KEY_MISSING');
      if (document.candidate.preparedBy!==prepared ||
          document.candidate.reviewedBy!==reviewed ||
          document.candidate.approvedBy!==actorId)
        errors.push('APPROVER_IDENTITY_MISMATCH');
    }
  }
  if (errors.length || !document || !step)
    return {accepted:false,postingEnabled:false,reasons:errors,
      document};
  const next:FinanceDocument={
    ...document,
    revision:document.revision+1,
    state:step.to,
    reviewedBy:action==='REVIEW'?actorId:document.reviewedBy,
    approvedBy:action==='APPROVE'?actorId:document.approvedBy,
    audit:[...document.audit,{
      sequence:document.revision+1,action,actorId,
      from:document.state,to:step.to,reason:reason.trim(),
    }],
  };
  return {accepted:true,postingEnabled:false,reasons:[],document:next};
}
