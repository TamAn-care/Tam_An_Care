export type ContractServicePriceEvidence={
  sourceType:'CONTRACT';residentId:string;contractId:string;version:number;status:string;
  serviceCode:string;scope:string;amountVnd:string;effectiveFrom:string;effectiveTo:string|null;
  signedAt:string|null;approvedAt:string|null;signedDocumentHash:string|null;approvedDocumentHash:string|null;
};
export type CatalogServicePriceEvidence={
  sourceType:'PRICE_LIST';priceListId:string;version:number;status:string;
  serviceCode:string;scope:string;amountVnd:string;effectiveFrom:string;effectiveTo:string|null;
  approvedBy:string|null;approvedAt:string|null;
};
export type ServicePriceEvidence=ContractServicePriceEvidence|CatalogServicePriceEvidence;
export type ResolvedServicePrice={sourceType:'CONTRACT'|'PRICE_LIST';sourceId:string;version:number;serviceCode:string;scope:string;amountVnd:string;effectivePeriod:{from:string;to:string|null};evidence:string};
const dateMs=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('FINANCE_PRICE_DATE_INVALID');const ms=Date.parse(`${s}T00:00:00Z`);if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==s)throw Error('FINANCE_PRICE_DATE_INVALID');return ms;};
const activeOn=(from:string,to:string|null,day:string)=>{const start=dateMs(from),end=to===null?Number.POSITIVE_INFINITY:dateMs(to);if(end<start)throw Error('FINANCE_PRICE_DATE_RANGE_INVALID');return start<=dateMs(day)&&dateMs(day)<=end;};
const amount=(value:string)=>{if(!/^(0|[1-9][0-9]{0,19})$/.test(value))throw Error('FINANCE_PRICE_VND_INVALID');return BigInt(value);};

/** Contract-specific signed terms take priority; only approved catalog fallback is eligible. */
export function resolveServicePrice(input:{residentId:string;serviceCode:string;scope:string;serviceDate:string;sources:ServicePriceEvidence[]}):ResolvedServicePrice{
  dateMs(input.serviceDate);
  const matching=input.sources.filter(s=>s.serviceCode===input.serviceCode&&s.scope===input.scope&&activeOn(s.effectiveFrom,s.effectiveTo,input.serviceDate));
  const contract=matching.filter((s):s is ContractServicePriceEvidence=>s.sourceType==='CONTRACT'&&s.residentId===input.residentId);
  if(contract.length>1)throw Error('FINANCE_CONTRACT_PRICE_CONFLICT');
  if(contract.length===1){
    const s=contract[0];
    if(s.status!=='ACTIVE'||!s.signedAt||!s.approvedAt||!s.signedDocumentHash||s.signedDocumentHash!==s.approvedDocumentHash)throw Error('FINANCE_CONTRACT_PRICE_UNVERIFIED');
    const value=amount(s.amountVnd);
    return {sourceType:'CONTRACT',sourceId:s.contractId,version:s.version,serviceCode:s.serviceCode,scope:s.scope,amountVnd:value.toString(),effectivePeriod:{from:s.effectiveFrom,to:s.effectiveTo},evidence:s.signedDocumentHash};
  }
  const catalog=matching.filter((s):s is CatalogServicePriceEvidence=>s.sourceType==='PRICE_LIST'&&s.status==='APPROVED');
  if(catalog.length===0)throw Error('FINANCE_PRICE_SOURCE_NOT_READY');
  if(catalog.length>1)throw Error('FINANCE_APPROVED_PRICE_CONFLICT');
  const s=catalog[0];
  if(!s.approvedBy||!s.approvedAt)throw Error('FINANCE_APPROVED_PRICE_EVIDENCE_MISSING');
  const value=amount(s.amountVnd);
  return {sourceType:'PRICE_LIST',sourceId:s.priceListId,version:s.version,serviceCode:s.serviceCode,scope:s.scope,amountVnd:value.toString(),effectivePeriod:{from:s.effectiveFrom,to:s.effectiveTo},evidence:`${s.approvedBy}:${s.approvedAt}`};
}
