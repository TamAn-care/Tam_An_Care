/** V3.8.18.43 — canonical entry_type reconciliation against V42 live catalog.
 * NEVER substitute EXPENSE as a value to INSERT into public.finance_entries.
 * Pure mapping only; no live data operations, posting, migrations or seed.
 */
export type V43Kind='REVENUE'|'DIRECT_COST'|'PAYROLL'|'OPERATING_EXPENSE'|'DEPRECIATION'|'INTEREST'|'TAX';
export const V43_KINDS:readonly V43Kind[]=['REVENUE','DIRECT_COST','PAYROLL','OPERATING_EXPENSE','DEPRECIATION','INTEREST','TAX'];
export function classifyV43(raw:unknown):{valid:boolean;canonicalKind:V43Kind|null;monthlyGroup:'REVENUE'|'EXPENSE'|null;livePostingEnabled:false}{
 if(typeof raw!=='string'||!V43_KINDS.includes(raw as V43Kind))
  return{valid:false,canonicalKind:null,monthlyGroup:null,livePostingEnabled:false};
 const canonicalKind=raw as V43Kind;
 return{valid:true,canonicalKind,monthlyGroup:canonicalKind==='REVENUE'?'REVENUE':'EXPENSE',livePostingEnabled:false};
}
export function manualVoucherKindV43(kind:unknown):{valid:boolean;canonicalKind:V43Kind|null;livePostingEnabled:false}{
 const allowed=kind==='REVENUE'||kind==='DIRECT_COST'||kind==='PAYROLL'||kind==='OPERATING_EXPENSE';
 return{valid:allowed,canonicalKind:allowed?kind as V43Kind:null,livePostingEnabled:false};
}
