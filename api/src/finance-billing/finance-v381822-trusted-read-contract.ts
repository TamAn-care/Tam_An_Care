/** V3.8.18.22 — strictly scoped read request validation.
 * Pure only, no HTTP registration and no database mutations.
 * The caller provides ONLY opaque document ID. The server must load metadata
 * from a trusted source and revalidate active session and resource permission.
 */
export type FinanceReadRequest={documentId:string};
export type ReadRequestResult={valid:boolean;documentId:string|null;errors:string[];writeEnabled:false};
const ID=/^[A-Za-z0-9_-]{1,160}$/;
export function validateFinanceReadRequest(body:unknown):ReadRequestResult{
 const deny=(reason:string):ReadRequestResult=>({valid:false,documentId:null,errors:[reason],writeEnabled:false});
 if(!body||typeof body!=='object'||Array.isArray(body))return deny('INVALID_REQUEST');
 const v=body as Record<string,unknown>;
 if(Object.keys(v).length!==1||!Object.prototype.hasOwnProperty.call(v,'documentId')||
 typeof v.documentId!=='string'||!ID.test(v.documentId))return deny('INVALID_OR_UNTRUSTED_FIELDS');
 return {valid:true,documentId:v.documentId,errors:[],writeEnabled:false};
}
export type TrustedReadSnapshot={documentId:string;documentKind:'PAYROLL'|'REVENUE'|'DIRECT_COST'|'OPERATING_EXPENSE';ownerActorId:string;revision:number;persisted:true};
export function verifyTrustedReadSnapshot(snapshot:TrustedReadSnapshot|null,requestedId:string):{valid:boolean;errors:string[];writeEnabled:false}{
 const errors:string[]=[];
 if(!ID.test(requestedId)||!snapshot||snapshot.persisted!==true||
 snapshot.documentId!==requestedId||!ID.test(snapshot.ownerActorId)||
 !Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||
 !['PAYROLL','REVENUE','DIRECT_COST','OPERATING_EXPENSE'].includes(snapshot.documentKind))
 errors.push('SERVER_DOCUMENT_SNAPSHOT_UNVERIFIED');
 return {valid:errors.length===0,errors,writeEnabled:false};
}
