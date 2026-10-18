/** Finance capabilities mirrored from the approved application role policy.
 * Sensitive approval/report permissions intentionally remain narrower. */
export type PricingCapability='VIEW'|'EDIT_DRAFT'|'SUBMIT'|'APPROVE';
const roles:Record<PricingCapability,ReadonlySet<string>>={
  VIEW:new Set(['ADMIN','SUPERVISOR','CARE_MANAGER','ACCOUNTANT']),
  EDIT_DRAFT:new Set(['ADMIN','SUPERVISOR','CARE_MANAGER']),
  SUBMIT:new Set(['ADMIN','SUPERVISOR','CARE_MANAGER']),
  // Care managers can prepare/submit a proposal but cannot approve a Finance source.
  APPROVE:new Set(['ADMIN','SUPERVISOR']),
};
export function hasPricingCapability(role:string,capability:PricingCapability):boolean{
  return roles[capability].has(role);
}
export function canViewUnapprovedPricing(role:string):boolean{
  return role==='ADMIN'||role==='SUPERVISOR'||role==='CARE_MANAGER';
}
