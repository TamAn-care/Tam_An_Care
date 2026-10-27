/**
 * V3.8.18.12 — verified V3.8.18.11 PostgreSQL operational-source contract.
 * Read-only mapping of actual table/column names from the 190-table catalog.
 * Deliberately NOT a financial posting adapter: no authoritative approved
 * invoice/payroll/expense ledger source was verified in that catalog.
 */
export const VERIFIED_OPERATIONAL_SOURCES=[
 {group:'ADMISSION',table:'admission_cases',id:'admission_case_id',columns:['resident_id','actual_admission_date','status','record_version'],financeRole:'BILLING_CONTEXT_ONLY'},
 {group:'CARE_LEVEL',table:'admission_care_classifications',id:'admission_care_classification_id',columns:['approved_care_level','review_status','approved_at','rule_set_version'],financeRole:'BILLING_CONTEXT_ONLY'},
 {group:'RESIDENT_LEAVE',table:'resident_leave_requests',id:'leave_request_id',columns:['is_advance_notice_48h','first_day_chargeable','subsequent_days_confirmed','meal_deduction_eligible','status'],financeRole:'BILLING_ADJUSTMENT_CONTEXT_ONLY'},
 {group:'KITCHEN_BATCH',table:'kitchen_receiving_batches',id:'kitchen_receiving_batch_id',columns:['overall_status','total_value','signature_confirmed','received_at'],financeRole:'COST_EVIDENCE_ONLY'},
 {group:'KITCHEN_ITEMS',table:'kitchen_receiving_batch_items',id:'kitchen_receiving_batch_item_id',columns:['kitchen_receiving_batch_id','actual_quantity','unit_price','total_price','receiving_status'],financeRole:'COST_EVIDENCE_ONLY'},
 {group:'INVENTORY',table:'inventory_transactions',id:'inventory_transaction_id',columns:['inventory_item_id','transaction_type','quantity','source_domain','source_entity_id'],financeRole:'QUANTITY_EVIDENCE_ONLY'},
 {group:'RESIDENT_USAGE',table:'resident_consumption_events',id:'resident_consumption_event_id',columns:['inventory_transaction_id','resident_id','quantity','occurred_at'],financeRole:'QUANTITY_EVIDENCE_ONLY'},
 {group:'STAFF',table:'staff_actors',id:'actor_id',columns:['staff_code','status','department'],financeRole:'PAYROLL_IDENTITY_ONLY'},
 {group:'FINANCE_LEDGER',table:'finance_entries',id:'finance_entry_id',columns:['entry_type','amount_vnd','recognition_date','source_mode','source_entity_id','status'],financeRole:'LEDGER_ONLY'}
] as const;
export type OperationalMapAssessment={state:'BLOCKED'|'READ_ONLY_CONTEXT_AVAILABLE';missing:string[];financialPostingEnabled:false};
export function assessOperationalSourceCatalog(tables:readonly {table:string;columns:readonly string[]}[]):OperationalMapAssessment{
 if(!Array.isArray(tables))return {state:'BLOCKED',missing:['CATALOG_MISSING'],financialPostingEnabled:false};
 const index=new Map(tables.map(t=>[t.table,new Set(t.columns)]));
 const missing:string[]=[];
 for(const s of VERIFIED_OPERATIONAL_SOURCES){
  const actual=index.get(s.table);
  if(!actual){missing.push('TABLE_MISSING:'+s.table);continue;}
  for(const key of [s.id,...s.columns])
   if(!actual.has(key))missing.push('COLUMN_MISSING:'+s.table+'.'+key);
 }
 return {state:missing.length?'BLOCKED':'READ_ONLY_CONTEXT_AVAILABLE',missing,financialPostingEnabled:false};
}
