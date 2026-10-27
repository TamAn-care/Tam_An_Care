/** V3.8.18.39 — verified-source coverage mapping, pure and fail closed.
 * A catalog table is NOT proof of approved business rows. All proof fields
 * must originate from server-side bounded and reconciled queries, not browser.
 * No database IO / migrations / posting / routes.
 */
import {calculateV38MonthlyClose,type V38SourceCoverage,type V38MonthlyResult} from './finance-v381838-month-close-gate';
import type {MonthlyLedgerEntry} from './monthly-operating-result';
export type V39Source='invoices'|'careFees'|'leaveAdjustments'|'inventoryConsumption'|'payroll'|'manualVouchers'|'otherExpenses';
export type V39Proof={source:V39Source;catalogVerified:boolean;approvedRowsVerified:boolean;ledgerLinked:boolean;periodComplete:boolean;reviewedByServer:boolean};
const SOURCES:readonly V39Source[]=['invoices','careFees','leaveAdjustments','inventoryConsumption','payroll','manualVouchers','otherExpenses'];
export function assessV39(month:string,entries:readonly MonthlyLedgerEntry[],proofs:readonly V39Proof[]|null,counts:{unpostedApprovedCount:number;duplicateOriginCount:number;unlinkedSourceCount:number}|null):V38MonthlyResult{
 const valid=Array.isArray(proofs)?proofs:[];
 const flags={} as Record<V39Source,boolean>;
 for(const source of SOURCES){
  const matching=valid.filter(x=>x?.source===source);
  flags[source]=matching.length===1&&matching[0].catalogVerified===true&&
   matching[0].approvedRowsVerified===true&&matching[0].ledgerLinked===true&&
   matching[0].periodComplete===true&&matching[0].reviewedByServer===true;
 }
 // No default zeros: absence of independent counts forces CHUA_DU_DU_LIEU.
 const coverage:V38SourceCoverage={...flags,
  unpostedApprovedCount:counts?.unpostedApprovedCount as number,
  duplicateOriginCount:counts?.duplicateOriginCount as number,
  unlinkedSourceCount:counts?.unlinkedSourceCount as number};
 return calculateV38MonthlyClose(month,entries,coverage);
}
