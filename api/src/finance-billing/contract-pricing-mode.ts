export type ContractPricingMode = 'PACKAGE' | 'ITEMIZED' | 'HYBRID';
export type ContractPriceComponent = {
  serviceCode: string;
  amountVnd: string;
  includedInPackage: boolean;
  billableSeparately: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceContractVersion: number;
};
export type ContractPriceResolution = {
  mode: ContractPricingMode;
  lines: Array<{ serviceCode: string; amountVnd: string; includedInPackage: boolean; billableSeparately: boolean; sourceContractVersion: number; effectiveFrom:string; effectiveTo:string|null }>;
  totalVnd: string;
  blockers: string[];
};

const validVnd = (value: string): boolean => /^(0|[1-9][0-9]{0,15})$/.test(value);
const validCode = (value: string): boolean => /^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(value);
const validDate=(value:string):boolean=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

/** Resolve only explicit signed contract terms. Never infer components from a legacy total. */
export function resolveContractPricingMode(input: {
  mode: ContractPricingMode | null;
  signedAndApproved: boolean;
  contractVersion: number;
  serviceDate:string;
  packageServiceCode?: string | null;
  packageAmountVnd?: string | null;
  packageEffectiveFrom?:string|null;
  packageEffectiveTo?:string|null;
  components?: ContractPriceComponent[];
}): ContractPriceResolution {
  const blockers: string[] = [];
  const lines: ContractPriceResolution['lines'] = [];
  if (!input.signedAndApproved) blockers.push('SIGNED_CONTRACT_REQUIRED');
  if (!Number.isSafeInteger(input.contractVersion) || input.contractVersion < 1) blockers.push('CONTRACT_VERSION_INVALID');
  if (!validDate(input.serviceDate)) blockers.push('CONTRACT_SERVICE_DATE_INVALID');
  if (!input.mode) blockers.push('NEEDS_CONTRACT_PRICE_CLARIFICATION');
  const mode = input.mode ?? 'PACKAGE';
  const components = input.components ?? [];
  const validateComponent = (c: ContractPriceComponent) => {
    if (!validCode(c.serviceCode) || !validVnd(c.amountVnd) ||
      c.sourceContractVersion !== input.contractVersion ||
      !validDate(c.effectiveFrom) ||
      (c.effectiveTo !== null && (!validDate(c.effectiveTo) || c.effectiveTo < c.effectiveFrom))) {
      blockers.push('CONTRACT_COMPONENT_INVALID');return false;
    }
    if (c.includedInPackage && c.billableSeparately) {
      blockers.push('CONTRACT_COMPONENT_DOUBLE_BILLING_RISK');return false;
    }
    if(input.serviceDate<c.effectiveFrom||(c.effectiveTo!==null&&input.serviceDate>c.effectiveTo)){
      blockers.push('CONTRACT_COMPONENT_OUTSIDE_EFFECTIVE_PERIOD');return false;
    }
    return true;
  };
  const addComponent = (c: ContractPriceComponent) => {
    if(!validateComponent(c))return;
    if (c.includedInPackage) return;
    if (!c.billableSeparately) {
      blockers.push('CONTRACT_COMPONENT_BILLABILITY_UNSPECIFIED');
      return;
    }
    lines.push({serviceCode:c.serviceCode,amountVnd:c.amountVnd,includedInPackage:false,billableSeparately:true,sourceContractVersion:c.sourceContractVersion,effectiveFrom:c.effectiveFrom,effectiveTo:c.effectiveTo});
  };
  if (mode === 'PACKAGE' || mode === 'HYBRID') {
    if (!input.packageServiceCode || !validCode(input.packageServiceCode) || !input.packageAmountVnd || !validVnd(input.packageAmountVnd) ||
      !input.packageEffectiveFrom || !validDate(input.packageEffectiveFrom) ||
      (input.packageEffectiveTo!==undefined&&input.packageEffectiveTo!==null&&!validDate(input.packageEffectiveTo)) ||
      (input.packageEffectiveTo!==undefined&&input.packageEffectiveTo!==null&&input.packageEffectiveTo<input.packageEffectiveFrom) ||
      (input.serviceDate<input.packageEffectiveFrom) || (input.packageEffectiveTo!==undefined&&input.packageEffectiveTo!==null&&input.serviceDate>input.packageEffectiveTo)) {
      blockers.push('SIGNED_PACKAGE_PRICE_REQUIRED');
    } else {
      lines.push({serviceCode:input.packageServiceCode,amountVnd:input.packageAmountVnd,includedInPackage:false,billableSeparately:true,sourceContractVersion:input.contractVersion,effectiveFrom:input.packageEffectiveFrom,effectiveTo:input.packageEffectiveTo??null});
    }
  }
  if (mode === 'ITEMIZED' || mode === 'HYBRID') {
    if (!components.length) blockers.push('CONTRACT_ITEMIZED_COMPONENTS_REQUIRED');
    for (const component of components) {
      if(mode==='ITEMIZED'&&component.includedInPackage)blockers.push('ITEMIZED_COMPONENT_CANNOT_BE_INCLUDED');
      else addComponent(component);
    }
  }
  if (mode === 'PACKAGE' && components.length) {
    for (const component of components) {
      if (!validateComponent(component) || !component.includedInPackage || component.billableSeparately) {
        blockers.push('PACKAGE_COMPONENT_MUST_BE_INCLUDED_ONLY');
      }
    }
  }
  if (!lines.length) blockers.push('CONTRACT_PRICE_LINES_REQUIRED');
  const total = lines.reduce((sum, line) => sum + BigInt(line.amountVnd), 0n);
  return {mode,lines,totalVnd:total.toString(),blockers:[...new Set(blockers)]};
}
