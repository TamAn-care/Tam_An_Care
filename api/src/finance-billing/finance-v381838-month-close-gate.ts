/** V3.8.18.38: conservative monthly close completeness gate, pure CI code.
 * Source attestations MUST originate from independent backend reconciliation.
 * A claimed READY from caller is never accepted. No database I/O or posting.
 */
import {calculateMonthlyOperatingResult,type MonthlyLedgerEntry,type MonthlyResult} from './monthly-operating-result';
export type V38SourceCoverage={invoices:boolean;careFees:boolean;leaveAdjustments:boolean;inventoryConsumption:boolean;payroll:boolean;manualVouchers:boolean;otherExpenses:boolean;unpostedApprovedCount:number;duplicateOriginCount:number;unlinkedSourceCount:number};
export type V38MonthlyResult=MonthlyResult&{operationalReleaseReady:false};
export function calculateV38MonthlyClose(month:string,entries:readonly MonthlyLedgerEntry[],coverage:V38SourceCoverage):V38MonthlyResult{
 const reasons:string[]=[];
 const names=['invoices','careFees','leaveAdjustments','inventoryConsumption','payroll','manualVouchers','otherExpenses'] as const;
 if(!coverage||typeof coverage!=='object')reasons.push('COVERAGE_EVIDENCE_MISSING');
 else {
  for(const name of names)if(coverage[name]!==true)reasons.push('SOURCE_NOT_ATTESTED_'+name.toUpperCase());
  for(const name of ['unpostedApprovedCount','duplicateOriginCount','unlinkedSourceCount'] as const){
   if(!Number.isSafeInteger(coverage[name])||coverage[name]<0)reasons.push('RECONCILIATION_COUNT_INVALID_'+name.toUpperCase());
   else if(coverage[name]>0)reasons.push('RECONCILIATION_PENDING_'+name.toUpperCase());
  }
 }
 const base=calculateMonthlyOperatingResult({month,entries,ledgerCoverageComplete:reasons.length===0,reconciliationComplete:reasons.length===0});
 const all=[...new Set([...reasons,...base.reasons])];
 return{...base,state:all.length?'CHUA_DU_DU_LIEU':base.state,
 revenueVnd:all.length?null:base.revenueVnd,expenseVnd:all.length?null:base.expenseVnd,
 profitVnd:all.length?null:base.profitVnd,reasons:all,operationalReleaseReady:false};
}
