/**
 * V3.8.18.7 — deterministic replay and change-detection preflight.
 * Pure source-level decision, NO database access or writes, no scheduler.
 * Durable uniqueness and cursor commits require a separately approved
 * PostgreSQL transaction + immutable audit; this alone does not guarantee
 * exactly-once delivery.
 */
import {createHash} from 'crypto';
import {assessAdapterBatch,type CanonicalAdapterBatch} from './finance-v38186-real-source-adapter-contract';
export type PreviouslyObserved={sourceKey:string;sourceVersion:string;digest:string;posted:boolean};
export type ReplayDecision={state:'BLOCKED'|'CANDIDATES_ONLY'|'NO_CHANGE';reasons:string[];sourceDigests:{sourceKey:string;sourceVersion:string;digest:string}[];nextCursor:string|null;commitEnabled:false};
const hex=/^[a-f0-9]{64}$/;
export function evaluateReplay(batch:CanonicalAdapterBatch,observed:readonly PreviouslyObserved[]):ReplayDecision{
 const deny=(reasons:string[]):ReplayDecision=>({state:'BLOCKED',reasons,sourceDigests:[],nextCursor:null,commitEnabled:false});
 const evaluated=assessAdapterBatch(batch);
 if(evaluated.status!=='CANDIDATES_ONLY')return deny(evaluated.blockers);
 if(!Array.isArray(observed))return deny(['OBSERVED_STATE_INVALID']);
 const index=new Map<string,PreviouslyObserved>();
 for(const prev of observed){
  if(!prev||typeof prev.sourceKey!=='string'||typeof prev.sourceVersion!=='string'||!hex.test(prev.digest)||typeof prev.posted!=='boolean')
   return deny(['OBSERVED_STATE_INVALID']);
  if(index.has(prev.sourceKey))return deny(['OBSERVED_DUPLICATE_SOURCE']);
  index.set(prev.sourceKey,prev);
 }
 const changes:{sourceKey:string;sourceVersion:string;digest:string}[]=[];
 const reasons:string[]=[];
 let unchanged=0;
 for(const row of batch.rows){
  const sourceKey=row.family+':'+row.sourceId;
  const digest=createHash('sha256').update(JSON.stringify([
   row.family,row.sourceId,row.sourceVersion,row.date,row.amountVnd,
   row.entryType,row.approval,row.evidence,row.reconciled,row.originKey
  ])).digest('hex');
  const prev=index.get(sourceKey);
  if(prev){
   if(prev.sourceVersion===row.sourceVersion&&prev.digest!==digest)
    reasons.push('SAME_VERSION_CHANGED_CONTENT:'+sourceKey);
   else if(prev.posted && (prev.sourceVersion!==row.sourceVersion||prev.digest!==digest))
    reasons.push('POSTED_SOURCE_AMENDED_REQUIRES_REVERSAL:'+sourceKey);
   else if(prev.sourceVersion===row.sourceVersion&&prev.digest===digest)unchanged++;
  }
  changes.push({sourceKey,sourceVersion:row.sourceVersion,digest});
 }
 if(reasons.length)return deny(reasons);
 return {state:unchanged===batch.rows.length?'NO_CHANGE':'CANDIDATES_ONLY',reasons:[],
  sourceDigests:changes,nextCursor:evaluated.nextCursor,commitEnabled:false};
}
