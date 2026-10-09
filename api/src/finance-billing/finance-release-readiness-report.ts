/** V3.8.14 structured, fail-closed release-readiness report.
 * Isolated pure policy: never deploys, mutates data, or certifies a month.
 */
import type { AttachmentIncident } from './finance-attachment-reconciliation';
export type FinanceReleaseEvidence={
  snapshotConsistent:boolean;
  authenticatedRoleGatePassed:boolean;
  realSourceVerified:boolean;
  backupIsolatedRestorePassed:boolean;
  parentSymlinkSafetyPassed:boolean;
  durableMetadataObjectConsistencyPassed:boolean;
  productionMigrationAuthorized:boolean;
};
export function evaluateFinanceReleaseReadiness(input:{
  incidents:readonly AttachmentIncident[];
  scanned:number;
  evidence:FinanceReleaseEvidence;
}):{
  decision:'GO'|'NO_GO';
  blockers:string[];
  summary:{scanned:number;missing:number;corrupt:number;orphan:number;unsafe:number;errors:number};
  productionDeployAuthorized:false;
  monthlyCloseCertified:false;
}{
 const incidents=Array.isArray(input?.incidents)?input.incidents:[];
 const fields:readonly (keyof FinanceReleaseEvidence)[]=[
  'snapshotConsistent','authenticatedRoleGatePassed',
  'realSourceVerified','backupIsolatedRestorePassed',
  'parentSymlinkSafetyPassed','durableMetadataObjectConsistencyPassed',
  'productionMigrationAuthorized',
 ];
 const blockers:string[]=[];
 const evidence=input?.evidence;
 for(const field of fields)if(evidence?.[field]!==true)blockers.push('MISSING_PROOF_'+field);
 if(!Array.isArray(input?.incidents))blockers.push('INCIDENTS_NOT_VERIFIED');
 if(!Number.isSafeInteger(input?.scanned)||input.scanned<0)blockers.push('SCAN_COUNT_INVALID');
 const summary={scanned:Number.isSafeInteger(input?.scanned)?input.scanned:0,
  missing:0,corrupt:0,orphan:0,unsafe:0,errors:0};
 for(const i of incidents){
  if(i.code==='MISSING')summary.missing++;
  else if(i.code==='CORRUPT')summary.corrupt++;
  else if(i.code==='ORPHAN')summary.orphan++;
  else if(i.code==='UNSAFE_PATH')summary.unsafe++;
  else summary.errors++;
 }
 if(incidents.length)blockers.push('ATTACHMENT_RECONCILIATION_INCIDENTS');
 // CI proof cannot authorize production launch. Explicit independent
 // human release procedure required even if all inputs claim true.
 blockers.push('PRODUCTION_HUMAN_RELEASE_APPROVAL_REQUIRED');
 return {decision:'NO_GO',blockers,summary,
  productionDeployAuthorized:false,monthlyCloseCertified:false};
}
