/** V3.8.18.48 — conservative provenance reconciliation, pure CI-only.
 * A receipt is evidence of settlement, NOT a second revenue recognition event.
 * Never guess a business origin by customer, amount or date alone.
 */
export type V48Evidence={id:string;type:'INVOICE'|'RECEIPT'|'LEDGER'|'ADJUSTMENT';businessOrigin:string|null;amountVnd:string;recognitionDate:string|null;ledgerKind:'REVENUE'|'DIRECT_COST'|'PAYROLL'|'OPERATING_EXPENSE'|null;approved:boolean};
export type V48Result={state:'VERIFIED'|'CHUA_DU_DU_LIEU';revenueVnd:string|null;reasons:string[];livePostingEnabled:false};
export function reconcileRevenueV48(rows:readonly V48Evidence[]):V48Result{
 const reasons:string[]=[];
 if(!Array.isArray(rows)||rows.length===0)return{state:'CHUA_DU_DU_LIEU',revenueVnd:null,reasons:['SOURCE_EVIDENCE_MISSING'],livePostingEnabled:false};
 const ids=new Set<string>();const origins=new Map<string,number>();let revenue=0n;
 for(const v of rows){
  if(!v||typeof v.id!=='string'||!v.id.trim()||ids.has(v.id)){reasons.push('DUPLICATE_OR_INVALID_EVIDENCE_ID');continue;}ids.add(v.id);
  if(!v.businessOrigin||!/^[-\w:]{1,160}$/.test(v.businessOrigin))reasons.push('CANONICAL_ORIGIN_UNVERIFIED');
  if(typeof v.amountVnd!=='string'||!/^(0|[1-9]\d{0,15})$/.test(v.amountVnd)){reasons.push('AMOUNT_INVALID');continue;}
  if(v.approved!==true){reasons.push('UNAPPROVED_EVIDENCE');continue;}
  if(v.type==='RECEIPT')continue; // cash settlement must never recognize revenue
  if(v.type==='INVOICE'||v.type==='ADJUSTMENT')continue; // evidence only; accounting posting is canonical
  if(v.type!=='LEDGER'||v.ledgerKind!=='REVENUE'){reasons.push('UNKNOWN_OR_NON_REVENUE_POSTING');continue;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.recognitionDate||'')){reasons.push('RECOGNITION_DATE_UNVERIFIED');continue;}
  if(v.businessOrigin){
   const current=origins.get(v.businessOrigin)||0;origins.set(v.businessOrigin,current+1);
  }
  revenue+=BigInt(v.amountVnd);
 }
 if([...origins.values()].some(n=>n>1))reasons.push('DUPLICATE_REVENUE_ORIGIN');
 for(const v of rows){if(v?.type==='RECEIPT'||v?.type==='INVOICE'||v?.type==='ADJUSTMENT'){
  if(!v.businessOrigin||!origins.has(v.businessOrigin))reasons.push('EVIDENCE_WITHOUT_CANONICAL_REVENUE_POSTING');
 }}
 if(origins.size===0)reasons.push('CANONICAL_REVENUE_POSTING_MISSING');
 if(revenue>9999999999999999n)reasons.push('REVENUE_OVERFLOW');
 if(reasons.length)return{state:'CHUA_DU_DU_LIEU',revenueVnd:null,reasons:[...new Set(reasons)],livePostingEnabled:false};
 return{state:'VERIFIED',revenueVnd:revenue.toString(),reasons:[],livePostingEnabled:false};
}
