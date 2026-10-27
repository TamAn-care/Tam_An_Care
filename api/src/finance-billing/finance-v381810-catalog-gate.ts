/**
 * V3.8.18.10 — fail-closed catalog-to-adapter compatibility assessment.
 * Schema metadata only. NO SQL execution, DB network, I/O, mutation or seeding.
 * Does not authorize posting; verified canonical adapter implementation remains pending.
 */
export type SourceGroup='CONTRACT'|'BILLING'|'RECEIPT'|'KITCHEN'|'INVENTORY'|'PAYROLL'|'OPERATING_EXPENSE';
export type CatalogColumn={schema:string;table:string;column:string;dataType:string;nullable:boolean};
export type CatalogRelation={schema:string;table:string;primaryKey:string[];columns:CatalogColumn[]};
export type AdapterRequirement={group:SourceGroup;schema:string;table:string;primaryKey:string[];requiredColumns:string[];approvalColumn:string;periodColumn:string;sourceVersionColumn:string};
export type CatalogGate={status:'BLOCKED'|'SCHEMA_CANDIDATE';reasons:string[];mapping:AdapterRequirement|null;postingEnabled:false};
const IDENT=/^[a-z_][a-z0-9_]{0,62}$/;
export function assessCatalogSource(requirement:AdapterRequirement,relation:CatalogRelation|null):CatalogGate{
 const block=(reasons:string[]):CatalogGate=>({status:'BLOCKED',reasons,mapping:null,postingEnabled:false});
 if(!requirement||!relation)return block(['SOURCE_TABLE_NOT_VERIFIED']);
 const identifiers=[requirement.schema,requirement.table,requirement.approvalColumn,requirement.periodColumn,requirement.sourceVersionColumn,...requirement.primaryKey,...requirement.requiredColumns];
 if(identifiers.some(x=>!IDENT.test(x))||requirement.primaryKey.length===0||requirement.requiredColumns.length===0)return block(['MAPPING_INVALID']);
 if(relation.schema!==requirement.schema||relation.table!==requirement.table)return block(['SOURCE_TABLE_MISMATCH']);
 const reasons:string[]=[];
 const pk=new Set(relation.primaryKey);
 if(requirement.primaryKey.some(k=>!pk.has(k)))reasons.push('PRIMARY_KEY_UNVERIFIED');
 const cols=new Map(relation.columns.filter(c=>c.schema===relation.schema&&c.table===relation.table).map(c=>[c.column,c]));
 for(const k of new Set([...requirement.primaryKey,...requirement.requiredColumns,requirement.approvalColumn,requirement.periodColumn,requirement.sourceVersionColumn])){
  if(!cols.has(k))reasons.push('COLUMN_MISSING:'+k);
 }
 if(reasons.length)return block(reasons);
 return {status:'SCHEMA_CANDIDATE',reasons:[],mapping:requirement,postingEnabled:false};
}
export function assessRequiredModules(results:readonly {group:SourceGroup;gate:CatalogGate}[]):{readyForReadAdapter:boolean;missing:SourceGroup[]}{
 const required:SourceGroup[]=['CONTRACT','BILLING','RECEIPT','KITCHEN','INVENTORY','PAYROLL','OPERATING_EXPENSE'];
 const missing=required.filter(g=>!results.some(r=>r.group===g&&r.gate.status==='SCHEMA_CANDIDATE'));
 return {readyForReadAdapter:missing.length===0,missing};
}
