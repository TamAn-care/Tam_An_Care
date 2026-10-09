/**
 * Strict operator-attested legacy browser contract triage.
 * Pure classification ONLY: never imports, deletes, writes, or claims authenticity.
 * Do not include names, phone numbers, identifiers or source payloads in CI reports.
 */
export type LegacyContractDisposition =
  'REJECT_DEMO'|'QUARANTINE_UNVERIFIED'|'READY_FOR_MANUAL_REVIEW';
export type LegacyContractMetadata = {
  source:'BROWSER_LOCAL_STORAGE';
  contractId:string; residentId:string; contractCode:string;
  hasSignedPaper:boolean; paperDocumentVerifiedByOperator:boolean;
  residentMatchedByOperator:boolean; appearsDemo:boolean;
};
export function classifyLegacyContract(m:LegacyContractMetadata):LegacyContractDisposition {
  if(m?.source!=='BROWSER_LOCAL_STORAGE')return 'QUARANTINE_UNVERIFIED';
  if(m.appearsDemo===true || /(?:^|[-_])(demo|mock|fake|sample)(?:$|[-_])/i.test(m.contractId) ||
    /(?:^|[-_])(demo|mock|fake|sample)(?:$|[-_])/i.test(m.residentId))
    return 'REJECT_DEMO';
  const id=(s:unknown)=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(s);
  if(!id(m.contractId)||!id(m.residentId)||typeof m.contractCode!=='string'||
    !m.contractCode.trim()||!m.hasSignedPaper||!m.paperDocumentVerifiedByOperator||
    !m.residentMatchedByOperator)return 'QUARANTINE_UNVERIFIED';
  return 'READY_FOR_MANUAL_REVIEW';
}
/** Explicit human review is still NOT authority to issue an invoice or auto-import. */
