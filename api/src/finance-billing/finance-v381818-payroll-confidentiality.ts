/**
 * V3.8.18.18 Confidential payroll read authorization policy.
 * Pure fail-closed contract; role must be obtained from verified session on server.
 * NEVER return payroll data based on client-supplied identity or scope.
 */
export type VerifiedPayrollPrincipal={actorId:string;actorRole:string;sessionId:string;sessionActive:true;serverVerified:true};
export type PayrollResource={staffActorId:string;isPayroll:boolean};
export type PayrollReadDecision={allowed:boolean;reason:string;financialWriteEnabled:false};
const ID=/^[A-Za-z0-9_-]{1,160}$/;
export function authorizePayrollRead(p:VerifiedPayrollPrincipal|null,resource:PayrollResource|null,
 grantedPayrollReadRoles:readonly string[],allowSelf:boolean=false):PayrollReadDecision{
 const reject=(reason:string):PayrollReadDecision=>({allowed:false,reason,financialWriteEnabled:false});
 if(!p||!p.serverVerified||!p.sessionActive||!ID.test(p.sessionId)||!ID.test(p.actorId)||
 !/^[A-Z][A-Z0-9_]{1,63}$/.test(p.actorRole))return reject('SERVER_VERIFIED_ACTIVE_SESSION_REQUIRED');
 if(!resource||!resource.isPayroll||!ID.test(resource.staffActorId))return reject('INVALID_PAYROLL_RESOURCE');
 if(!Array.isArray(grantedPayrollReadRoles)||grantedPayrollReadRoles.length===0||
 grantedPayrollReadRoles.some(r=>!/^[A-Z][A-Z0-9_]{1,63}$/.test(r)))return reject('PAYROLL_READ_ALLOWLIST_UNCONFIGURED');
 if(grantedPayrollReadRoles.includes(p.actorRole))return{allowed:true,reason:'EXPLICIT_PAYROLL_ROLE',financialWriteEnabled:false};
 if(allowSelf&&resource.staffActorId===p.actorId)return{allowed:true,reason:'SELF_ONLY',financialWriteEnabled:false};
 return reject('PAYROLL_SCOPE_DENIED');
}
