/**
 * V3.8.15 evidence packet policy. No live data collection, no production
 * migration, no deployment, no implied authorization from CI evidence.
 */
export type ProofItem = {
  kind:'POSTGRES_SNAPSHOT'|'AUTHZ'|'RESTORE'|'PARENT_PATH'|'OBJECT_CONSISTENCY'|'SOURCE_PROVENANCE';
  environment:'ISOLATED_CI'|'PRODUCTION_TEST';
  observedAt:string;
  reference:string;
  verified:boolean;
};
const KINDS=['POSTGRES_SNAPSHOT','AUTHZ','RESTORE','PARENT_PATH','OBJECT_CONSISTENCY','SOURCE_PROVENANCE'] as const;
const TIME=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
export function assessFinanceEvidencePacket(proofs:readonly ProofItem[]):{
 decision:'NO_GO';
 missing:string[];
 ciEvidenceCount:number;
 productionEvidenceCount:number;
 productionDeployAuthorized:false;
}{
 const missing:string[]=[];
 if(!Array.isArray(proofs)||proofs.length>1000){
  return {decision:'NO_GO',missing:['INVALID_PROOF_PACKET'],ciEvidenceCount:0,productionEvidenceCount:0,productionDeployAuthorized:false};
 }
 for(const kind of KINDS){
  if(!proofs.some(p=>p?.kind===kind&&p.environment==='PRODUCTION_TEST'&&
    p.verified===true&&typeof p.reference==='string'&&p.reference.length>5&&
    typeof p.observedAt==='string'&&TIME.test(p.observedAt)&&!Number.isNaN(Date.parse(p.observedAt))))
   missing.push(kind+'_PRODUCTION_EVIDENCE_NOT_VERIFIED');
 }
 missing.push('INDEPENDENT_CHANGE_APPROVAL_NOT_GRANTED');
 return {decision:'NO_GO',missing,
  ciEvidenceCount:proofs.filter(p=>p?.environment==='ISOLATED_CI').length,
  productionEvidenceCount:proofs.filter(p=>p?.environment==='PRODUCTION_TEST'&&p.verified===true).length,
  productionDeployAuthorized:false};
}
