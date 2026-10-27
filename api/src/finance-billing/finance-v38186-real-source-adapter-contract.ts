/**
 * V3.8.18.6 — server-side real-source adapter boundary / sync checkpoint evaluator.
 * Pure, dependency-free; no DB connection, no schedules, no writes, no seed.
 * The future server worker must independently verify transaction isolation,
 * persisted monotonic cursor, source snapshots and session permissions.
 */
import {planCanonicalFinanceSync, type SourceSnapshot, type SyncPlan} from './finance-v38185-source-sync-planner';
export type Readiness='VERIFIED'|'UNVERIFIED'|'MISSING';
export type CanonicalAdapterBatch={
 adapterId:string; authoritativeSource:'POSTGRESQL';
 snapshotId:string; cursorBefore:string; cursorAfter:string;
 sourceAvailability:Readiness; schemaVerified:Readiness;
 sessionRbacVerified:Readiness; evidenceChainVerified:Readiness;
 rows:readonly SourceSnapshot[];
};
export type AdapterAssessment={
 status:'BLOCKED'|'CANDIDATES_ONLY'; nextCursor:string|null;
 candidatePlan:SyncPlan; blockers:string[]; commitEnabled:false;
};
const ID=/^[A-Za-z0-9_-]{1,160}$/;
const CURSOR=/^(0|[1-9][0-9]*)$/;
export function assessAdapterBatch(batch:CanonicalAdapterBatch):AdapterAssessment {
 const fail=(reasons:string[]):AdapterAssessment=>({
  status:'BLOCKED',nextCursor:null,blockers:reasons,
  candidatePlan:{status:'BLOCKED',items:[],blockers:reasons,postingEnabled:false},
  commitEnabled:false
 });
 if(!batch||typeof batch!=='object'||Array.isArray(batch))return fail(['ADAPTER_MISSING']);
 const blockers:string[]=[];
 if(!ID.test(batch.adapterId||'')||!ID.test(batch.snapshotId||''))blockers.push('ADAPTER_IDENTITY_INVALID');
 if(batch.authoritativeSource!=='POSTGRESQL')blockers.push('NON_CANONICAL_SOURCE');
 if(!CURSOR.test(batch.cursorBefore||'')||!CURSOR.test(batch.cursorAfter||''))blockers.push('CURSOR_INVALID');
 else if(BigInt(batch.cursorAfter)<BigInt(batch.cursorBefore))blockers.push('CURSOR_REGRESSION');
 for(const [name,status] of [
  ['SOURCE',batch.sourceAvailability],['SCHEMA',batch.schemaVerified],
  ['RBAC',batch.sessionRbacVerified],['EVIDENCE',batch.evidenceChainVerified]
 ] as const)if(status!=='VERIFIED')blockers.push(name+'_NOT_VERIFIED');
 if(!Array.isArray(batch.rows))blockers.push('ROWS_INVALID');
 if(blockers.length)return fail(blockers);
 const plan=planCanonicalFinanceSync(batch.rows);
 if(plan.status==='BLOCKED')return fail(plan.blockers);
 // Cursor is NOT durable until a separate, audited transaction has
 // atomically persisted the corresponding ledger/reconciliation state.
 return {status:'CANDIDATES_ONLY',nextCursor:batch.cursorAfter,
  candidatePlan:plan,blockers:[],commitEnabled:false};
}
