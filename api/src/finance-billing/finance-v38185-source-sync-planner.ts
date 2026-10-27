/**
 * V3.8.18.5 — deterministic canonical source synchronization planner.
 * Pure only: NO API, DB, writes, migration, seed, timers or runtime wiring.
 * Applications must read verified PostgreSQL source snapshots and independently
 * approve any future posting via an atomic transaction; this planner cannot post.
 */
export type SourceFamily='APPROVED_INVOICE'|'PAYMENT_RECEIPT'|'PAYMENT_ALLOCATION'|'CONTRACT_VERSION'|'KITCHEN_RECEIPT'|'INVENTORY_MOVEMENT'|'RESIDENT_CONSUMPTION'|'PAYROLL_APPROVED'|'EXPENSE_APPROVED'|'DEPRECIATION_APPROVED'|'INTEREST_APPROVED'|'TAX_APPROVED';
export type LedgerKind='REVENUE'|'DIRECT_COST'|'PAYROLL'|'OPERATING_EXPENSE'|'DEPRECIATION'|'INTEREST'|'TAX';
export type SourceSnapshot={
 family:SourceFamily; sourceId:string; sourceVersion:string;
 date:string; amountVnd:string; entryType:LedgerKind;
 approval:'VERIFIED'|'UNVERIFIED';
 evidence:'VERIFIED'|'UNVERIFIED';
 reconciled:'VERIFIED'|'UNVERIFIED';
 /** Link to financially authoritative document, not a resident's personal data. */
 originKey:string;
};
export type PlanItem={key:string;kind:LedgerKind;month:string;amountVnd:string;originKey:string};
export type SyncPlan={status:'BLOCKED'|'CANDIDATES_ONLY';items:PlanItem[];blockers:string[];postingEnabled:false};
const FAMILIES:Record<SourceFamily,LedgerKind|null>={
 APPROVED_INVOICE:'REVENUE',PAYMENT_RECEIPT:null,PAYMENT_ALLOCATION:null,CONTRACT_VERSION:null,
 KITCHEN_RECEIPT:null,INVENTORY_MOVEMENT:null,RESIDENT_CONSUMPTION:null,
 PAYROLL_APPROVED:'PAYROLL',EXPENSE_APPROVED:'OPERATING_EXPENSE',
 DEPRECIATION_APPROVED:'DEPRECIATION',INTEREST_APPROVED:'INTEREST',TAX_APPROVED:'TAX'
};
const MONEY=/^(0|[1-9]\d*)$/;
const ID=/^[A-Za-z0-9_-]{1,160}$/;
const day=(s:string):boolean=>{
 if(!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');
 return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;
};
export function planCanonicalFinanceSync(snapshots:readonly SourceSnapshot[]):SyncPlan {
 const blockers:string[]=[];
 const items:PlanItem[]=[];
 const bySource=new Map<string,string>();
 const byOrigin=new Map<string,string>();
 if(!Array.isArray(snapshots))return{status:'BLOCKED',items:[],blockers:['SNAPSHOTS_INVALID'],postingEnabled:false};
 for(let i=0;i<snapshots.length;i++){
  const s=snapshots[i];
  if(!s||typeof s!=='object'||!(s.family in FAMILIES)){blockers.push('UNSUPPORTED_SOURCE:'+i);continue;}
  const family=s.family as SourceFamily;
  const expected=FAMILIES[family];
  // Cash movements, contracts, stock receipt/issue and resident consumption
  // must never become implicit revenue or expense: need approved accounting document.
  if(expected===null){blockers.push('NON_POSTING_SOURCE:'+s.family);continue;}
  if(!ID.test(s.sourceId)||!ID.test(s.sourceVersion)||!ID.test(s.originKey)){
   blockers.push('INVALID_IDENTITY:'+i);continue;
  }
  if(!day(s.date)){blockers.push('INVALID_DATE:'+i);continue;}
  if(!MONEY.test(s.amountVnd)||BigInt(s.amountVnd)>9999999999999999n){
   blockers.push('INVALID_AMOUNT:'+i);continue;
  }
  if(s.entryType!==expected){blockers.push('CATEGORY_MISMATCH:'+i);continue;}
  if(s.approval!=='VERIFIED'||s.evidence!=='VERIFIED'||s.reconciled!=='VERIFIED'){
   blockers.push('UNVERIFIED_EVIDENCE:'+i);continue;
  }
  const sourceKey=s.family+':'+s.sourceId;
  const prior=bySource.get(sourceKey);
  if(prior!==undefined){blockers.push('DUPLICATE_SOURCE:'+sourceKey);continue;}
  bySource.set(sourceKey,s.sourceVersion);
  const originKey=s.entryType+':'+s.originKey;
  if(byOrigin.has(originKey)){blockers.push('DUPLICATE_ORIGIN:'+originKey);continue;}
  byOrigin.set(originKey,sourceKey);
  items.push({key:sourceKey,kind:s.entryType,month:s.date.slice(0,7),amountVnd:s.amountVnd,originKey:s.originKey});
 }
 // Never release partial results if any source failed validation.
 return{status:blockers.length?'BLOCKED':'CANDIDATES_ONLY',items:blockers.length?[]:items,
   blockers,postingEnabled:false};
}
