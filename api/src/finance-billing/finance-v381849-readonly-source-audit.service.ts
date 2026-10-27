/** V3.8.18.49 — unregistered READ-ONLY source/ledger audit adapter.
 * No ledger posting, no inferred origin joins, no payroll detail, no API route.
 * Counts are diagnostics only, never an attestation to READY/month-close.
 */
import {Injectable} from '@nestjs/common';
import type {DatabaseService} from '../database/database.service';

export type V49Audit={
 month:string;ledgerRows:number;postedSystemRows:number;
 unlinkedPostedRows:number;manualPostedRows:number;duplicateSystemOrigins:number;
 truncated:boolean;state:'CHUA_DU_DU_LIEU';readyForLivePosting:false;
 reasons:string[];
};
const MONTH=/^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
@Injectable()
export class FinanceReadOnlySourceAuditV381849 {
 constructor(private readonly db:DatabaseService){}
 async audit(month:string):Promise<V49Audit>{
  if(typeof month!=='string'||!MONTH.test(month))throw new Error('FINANCE_V49_INVALID_MONTH');
  const cols=await this.db.query<{column_name:string}>(`
   SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='finance_entries'
   AND column_name=ANY($1::text[])`,[[
   'finance_entry_id','recognition_date','status','source_mode',
   'source_domain','source_entity_type','source_entity_id','entry_type'
  ]]);
  const wanted=['finance_entry_id','recognition_date','status','source_mode','source_domain','source_entity_type','source_entity_id','entry_type'];
  if(wanted.some(k=>!cols.rows.some(c=>c.column_name===k))){
   return {month,ledgerRows:0,postedSystemRows:0,unlinkedPostedRows:0,manualPostedRows:0,duplicateSystemOrigins:0,truncated:false,
    state:'CHUA_DU_DU_LIEU',readyForLivePosting:false,reasons:['LIVE_LEDGER_SCHEMA_INCOMPLETE']};
  }
  // Bounded read, no finance amounts or resident/staff identifiers returned.
  const result=await this.db.query<{
   total:string;posted_system:string;unlinked:string;manual_posted:string;dup_system:string;bounded:string
  }>(`
  WITH sampled AS MATERIALIZED (
   SELECT status,source_mode,source_domain,source_entity_type,source_entity_id,entry_type
   FROM public.finance_entries
   WHERE recognition_date >= $1::date
     AND recognition_date < ($1::date + INTERVAL '1 month')
   ORDER BY recognition_date,finance_entry_id
   LIMIT 10001
  ), duplicates AS (
   SELECT count(*) AS n FROM (
     SELECT source_domain,source_entity_type,source_entity_id,entry_type
     FROM sampled WHERE source_mode='SYSTEM'
      AND source_domain IS NOT NULL AND source_entity_type IS NOT NULL AND source_entity_id IS NOT NULL
     GROUP BY 1,2,3,4 HAVING count(*)>1
   ) x
  )
  SELECT count(*)::text AS total,
   count(*) FILTER (WHERE status='POSTED' AND source_mode='SYSTEM')::text AS posted_system,
   count(*) FILTER (WHERE status='POSTED' AND (source_domain IS NULL OR source_entity_type IS NULL OR source_entity_id IS NULL))::text AS unlinked,
   count(*) FILTER (WHERE status='POSTED' AND source_mode='MANUAL')::text AS manual_posted,
   (SELECT n::text FROM duplicates) AS dup_system,
   (count(*)>10000)::text AS bounded
  FROM sampled`,[month+'-01']);
  if(result.rows.length!==1)throw new Error('FINANCE_V49_AUDIT_RESPONSE_INVALID');
  const v=result.rows[0];const parse=(x:string)=>{const n=Number(x);if(!Number.isSafeInteger(n)||n<0)throw new Error('FINANCE_V49_COUNT_INVALID');return n};
  const ledgerRows=parse(v.total),postedSystemRows=parse(v.posted_system),unlinkedPostedRows=parse(v.unlinked),
   manualPostedRows=parse(v.manual_posted),duplicateSystemOrigins=parse(v.dup_system),truncated=v.bounded==='true';
  const reasons=['LIVE_SOURCE_TO_LEDGER_PROVENANCE_UNVERIFIED'];
  if(truncated)reasons.push('LEDGER_QUERY_TRUNCATED');
  if(unlinkedPostedRows>0)reasons.push('POSTED_LEDGER_SOURCE_MISSING');
  if(manualPostedRows>0)reasons.push('MANUAL_APPROVAL_SOURCE_NOT_VERIFIED');
  if(duplicateSystemOrigins>0)reasons.push('SYSTEM_ORIGIN_DUPLICATE');
  return {month,ledgerRows,postedSystemRows,unlinkedPostedRows,manualPostedRows,duplicateSystemOrigins,truncated,
   state:'CHUA_DU_DU_LIEU',readyForLivePosting:false,reasons};
 }
}
