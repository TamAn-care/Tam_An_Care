/**
 * Finance V3.8.18.13 — in-memory approval workflow for manual payroll and
 * non-invoice income/expense vouchers. Pure reducer, no persistence / endpoints.
 * The request actorRole is declarative TEST INPUT, not authenticated server RBAC.
 */
import {assessManualFinanceEntry,type ManualEntry} from './finance-v381812-manual-flexible-intake';
export type ManualState='DRAFT'|'SUBMITTED'|'REVIEWED'|'APPROVED'|'REJECTED';
export type ManualAction='SUBMIT'|'REVIEW'|'APPROVE'|'REJECT';
export type ManualAudit={revision:number;action:ManualAction;actorId:string;from:ManualState;to:ManualState;reason:string};
export type ManualDocument={revision:number;state:ManualState;entry:ManualEntry;audit:readonly ManualAudit[]};
export type ManualTransition={accepted:boolean;postingEnabled:false;reasons:string[];document:ManualDocument};
const roles:Record<ManualAction,readonly string[]>={
 SUBMIT:['FINANCE_MAKER','FINANCE_MANAGER'],
 REVIEW:['FINANCE_REVIEWER','FINANCE_MANAGER'],
 APPROVE:['FINANCE_APPROVER','DIRECTOR'],
 REJECT:['FINANCE_REVIEWER','FINANCE_MANAGER','FINANCE_APPROVER','DIRECTOR']
};
const target:Record<ManualAction,{from:ManualState;to:ManualState}>={
 SUBMIT:{from:'DRAFT',to:'SUBMITTED'},REVIEW:{from:'SUBMITTED',to:'REVIEWED'},
 APPROVE:{from:'REVIEWED',to:'APPROVED'},REJECT:{from:'SUBMITTED',to:'REJECTED'}
};
export function transitionManualDocument(input:{
 document:ManualDocument;action:ManualAction;actorId:string;actorRole:string;
 expectedRevision:number;reason:string;originAlreadyClaimed:boolean;
}):ManualTransition{
 const d=input?.document;const a=input?.action;
 const errors:string[]=[];const step=Object.prototype.hasOwnProperty.call(target,a)?target[a]:null;
 if(!d||!Array.isArray(d.audit)||!Number.isSafeInteger(d.revision)||d.revision<0||d.audit.length!==d.revision)
  errors.push('INVALID_DOCUMENT_HISTORY');
 if(!step||!d||d.state!==step.from)errors.push('INVALID_TRANSITION');
 if(!d||d.revision!==input.expectedRevision)errors.push('STALE_REVISION');
 if(!step||!roles[a].includes(input.actorRole))errors.push('ROLE_NOT_PERMITTED');
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(input.actorId||''))errors.push('ACTOR_INVALID');
 if(typeof input.reason!=='string'||input.reason.trim().length<5)errors.push('AUDIT_REASON_REQUIRED');
 if(input.originAlreadyClaimed!==false)errors.push('DUPLICATE_OR_UNCHECKED_ORIGIN');
 if(d){
  if(a==='SUBMIT'&&input.actorId!==d.entry.preparedBy)errors.push('PREPARER_REQUIRED');
  if(a==='REVIEW'&&(input.actorId===d.entry.preparedBy||input.actorId!==d.entry.reviewedBy))
   errors.push('INDEPENDENT_REVIEWER_REQUIRED');
  if(a==='APPROVE'&&(input.actorId===d.entry.preparedBy||
   input.actorId===d.entry.reviewedBy||input.actorId!==d.entry.approvedBy))
   errors.push('INDEPENDENT_APPROVER_REQUIRED');
  if(a==='APPROVE'&&assessManualFinanceEntry(d.entry).status!=='ELIGIBLE_FOR_FUTURE_POSTING_REVIEW')
   errors.push('DOCUMENT_NOT_VERIFIED');
  if(a==='REJECT'&&input.actorId===d.entry.preparedBy)errors.push('SELF_REJECTION_FORBIDDEN');
 }
 if(errors.length)return{accepted:false,postingEnabled:false,reasons:errors,document:d};
 const next:ManualDocument={revision:d.revision+1,state:step!.to,entry:d.entry,
  audit:[...d.audit,{revision:d.revision+1,action:a,actorId:input.actorId,
  from:d.state,to:step!.to,reason:input.reason.trim()}]};
 return{accepted:true,postingEnabled:false,reasons:[],document:next};
}
