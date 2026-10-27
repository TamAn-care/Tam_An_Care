/**
 * V3.8.18.20 — confidential finance document read authorization boundary.
 * Only authorizes a future read, never fetches payroll records, returns sensitive
 * fields, or exposes a registered HTTP endpoint. Server-verification is required.
 */
export type DocumentReadActor={actorId:string;actorRole:string;sessionId:string;serverVerified:true;sessionActive:true};
export type DocumentReadMeta={documentId:string;kind:'PAYROLL'|'REVENUE'|'DIRECT_COST'|'OPERATING_EXPENSE';preparedBy:string;staffActorId:string|null;state:string};
export type ReadAccess={authorized:boolean;reason:string;databaseWriteEnabled:false};
const ID=/^[A-Za-z0-9_-]{1,160}$/;
const ROLE=/^[A-Z][A-Z0-9_]{1,63}$/;
export function assessFinanceDocumentRead(actor:DocumentReadActor|null,doc:DocumentReadMeta|null,
 financeRoles:readonly string[],payrollRoles:readonly string[]):ReadAccess {
 const no=(reason:string):ReadAccess=>({authorized:false,reason,databaseWriteEnabled:false});
 if(!actor||actor.serverVerified!==true||actor.sessionActive!==true||
 !ID.test(actor.actorId)||!ID.test(actor.sessionId)||!ROLE.test(actor.actorRole))
 return no('SESSION_UNVERIFIED');
 if(!doc||!ID.test(doc.documentId)||!ID.test(doc.preparedBy)||
 !['PAYROLL','REVENUE','DIRECT_COST','OPERATING_EXPENSE'].includes(doc.kind))
 return no('DOCUMENT_INVALID');
 if(!Array.isArray(financeRoles)||!financeRoles.length||financeRoles.some(r=>!ROLE.test(r))||
 !financeRoles.includes(actor.actorRole))return no('FINANCE_READ_SCOPE_DENIED');
 if(doc.kind==='PAYROLL'&&(!Array.isArray(payrollRoles)||!payrollRoles.length||
 payrollRoles.some(r=>!ROLE.test(r))||!payrollRoles.includes(actor.actorRole)))
 return no('PAYROLL_READ_SCOPE_DENIED');
 return {authorized:true,reason:'AUTHORIZED_FOR_METADATA_READ_ONLY',databaseWriteEnabled:false};
}
