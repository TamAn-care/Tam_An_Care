/**
 * V3.8.18.16 — server-authenticated manual finance command boundary.
 * Pure orchestration ONLY; no Nest controller registered and no database writes.
 * Caller must obtain identity via FinanceDocumentAuthorizationService (verified
 * session/RBAC) and load documents under a real SQL row lock in future integration.
 * The remote input MUST NOT supply actor identity or role.
 */
import {assessManualFinanceEntry,type ManualEntry} from './finance-v381812-manual-flexible-intake';
import {transitionManualDocument,type ManualAction,type ManualDocument,type ManualTransition} from './finance-v381813-manual-workflow';
export type ServerIdentity={actorId:string;actorRole:string;sessionId:string;verifiedFromServer:true};
export type ClientManualCommand={action:ManualAction;expectedRevision:number;reason:string};
export type ManualBoundaryResult={status:'DENIED'|'CANDIDATE_ONLY';errors:string[];transition:ManualTransition|null;postingEnabled:false;databaseWriteEnabled:false};
const ACTIONS=new Set(['SUBMIT','REVIEW','APPROVE','REJECT']);
const ID=/^[A-Za-z0-9_-]{1,160}$/;
export function assessAuthenticatedManualCommand(
 authenticated:ServerIdentity|null,client:ClientManualCommand|null,
 existing:ManualDocument|null,originAlreadyClaimed:boolean
):ManualBoundaryResult {
 const deny=(errors:string[]):ManualBoundaryResult=>({status:'DENIED',errors,transition:null,postingEnabled:false,databaseWriteEnabled:false});
 if(!authenticated||authenticated.verifiedFromServer!==true||
 !ID.test(authenticated.actorId)||!ID.test(authenticated.sessionId)||
 !/^[A-Z][A-Z0-9_]{1,63}$/.test(authenticated.actorRole))
 return deny(['VERIFIED_SERVER_SESSION_REQUIRED']);
 if(!client||typeof client!=='object'||Array.isArray(client)||
 Object.keys(client).some(k=>!['action','expectedRevision','reason'].includes(k))||
 !ACTIONS.has(client.action)||!Number.isSafeInteger(client.expectedRevision)||
 client.expectedRevision<0||typeof client.reason!=='string')
 return deny(['INVALID_COMMAND_OR_CLIENT_IDENTITY_INJECTION']);
 if(!existing||!existing.entry)return deny(['DOCUMENT_NOT_LOADED_UNDER_LOCK']);
 if(originAlreadyClaimed!==false)return deny(['ORIGIN_NOT_UNCLAIMED']);
 const t=transitionManualDocument({document:existing,action:client.action,
 actorId:authenticated.actorId,actorRole:authenticated.actorRole,
 expectedRevision:client.expectedRevision,reason:client.reason,
 originAlreadyClaimed});
 if(!t.accepted)return deny(t.reasons);
 return {status:'CANDIDATE_ONLY',errors:[],transition:t,postingEnabled:false,databaseWriteEnabled:false};
}
export function assessNewManualDraft(entry:ManualEntry|null,identity:ServerIdentity|null):{status:'DENIED'|'DRAFT_CANDIDATE';reasons:string[];databaseWriteEnabled:false}{
 if(!identity||identity.verifiedFromServer!==true||!ID.test(identity.actorId)||
 !ID.test(identity.sessionId)||!['FINANCE_MAKER','FINANCE_MANAGER'].includes(identity.actorRole)||
 entry?.preparedBy!==identity.actorId)
 return {status:'DENIED',reasons:['AUTHENTICATED_PREPARER_REQUIRED'],databaseWriteEnabled:false};
 const review=assessManualFinanceEntry(entry);
 return {status:review.status==='ELIGIBLE_FOR_FUTURE_POSTING_REVIEW'?'DRAFT_CANDIDATE':'DENIED',
 reasons:review.reasons,databaseWriteEnabled:false};
}
