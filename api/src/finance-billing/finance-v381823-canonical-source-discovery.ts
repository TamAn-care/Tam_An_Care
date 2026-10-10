/**
 * Finance V3.8.18.23 — read-only PostgreSQL catalog provenance gate.
 * Public finance_entries is a LEDGER, not an authoritative manually approved
 * voucher/payroll source. Never coerce ledger rows into trusted document metadata.
 * Caller must provide catalog metadata observed on its intended DB connection.
 * No query, DML, migration, seed, route registration or deployment here.
 */
export type CatalogTable={schema:string;name:string;columns:readonly string[]};
export type CanonicalSourceDiscovery={
 status:'BLOCKED_NO_AUTHORITATIVE_DOCUMENT_SOURCE'|'CANDIDATE_SCHEMA_ONLY';
 candidate:string|null;blockers:string[];enableRead:false;enableWrite:false
};
const required=['document_id','origin_key','document_type','amount_vnd','recognition_date',
 'evidence_type','description','maker_id','reviewer_id','approver_id','state','revision'];
export function discoverCanonicalManualFinanceSource(tables:readonly CatalogTable[]|null):CanonicalSourceDiscovery{
 const deny=(blockers:string[]):CanonicalSourceDiscovery=>({
 status:'BLOCKED_NO_AUTHORITATIVE_DOCUMENT_SOURCE',candidate:null,
 blockers,enableRead:false,enableWrite:false});
 if(!Array.isArray(tables))return deny(['CATALOG_NOT_VERIFIED']);
 // Only an explicitly audited canonical business table can be proposed.
 // Isolated CI schemas and the existing finance_entries ledger are never sources.
 const eligible=tables.filter(t=>t&&t.schema==='public'&&
 t.name==='finance_manual_documents'&&Array.isArray(t.columns)&&
 required.every(c=>t.columns.includes(c)));
 if(eligible.length!==1)return deny(['CANONICAL_MANUAL_DOCUMENT_SCHEMA_NOT_VERIFIED']);
 return{status:'CANDIDATE_SCHEMA_ONLY',candidate:'public.finance_manual_documents',
 blockers:['SOURCE_APPROVAL_AUDIT_AND_ROW_PROVENANCE_REQUIRED'],
 enableRead:false,enableWrite:false};
}
