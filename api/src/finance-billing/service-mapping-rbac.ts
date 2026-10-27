export type ServiceMappingCapability='VIEW'|'EDIT_DRAFT'|'SUBMIT'|'APPROVE'|'SUPERSEDE';
const roles:Record<ServiceMappingCapability,ReadonlySet<string>>={
  VIEW:new Set(['ADMIN','SUPERVISOR','ACCOUNTANT']),
  EDIT_DRAFT:new Set(['ADMIN','SUPERVISOR']),
  SUBMIT:new Set(['ADMIN','SUPERVISOR']),
  APPROVE:new Set(['ADMIN','SUPERVISOR']),
  SUPERSEDE:new Set(['ADMIN','SUPERVISOR']),
};
export function hasServiceMappingCapability(role:string,capability:ServiceMappingCapability):boolean{return roles[capability].has(role);}
