/**
 * Pure, immutable billing basis guard. Does not write or issue an invoice.
 * The caller MUST load both snapshots from one authorized PostgreSQL read/transaction.
 */
export type ContractVersionBasis = {
 source:'VERIFIED_SERVER'; contractId:string;residentId:string;
 version:number;status:string;approvedAt:string|null;signedAt:string|null;
 effectiveDate:string;monthlyFeeVnd:string;
};
export type InvoiceDraftBasis = {
 contractId:string;residentId:string;contractVersion:number;
 billingMonth:string;totalVnd:string;status:string;
};
const vnd=(s:string):bigint=>{
 if(typeof s!=='string'||!/^(0|[1-9][0-9]*)(?:\.00?)?$/.test(s))throw Error('CONTRACT_BILLING_VND_INVALID');
 return BigInt(s.split('.')[0]);
};
export function validateInvoiceContractBasis(
 c:ContractVersionBasis,i:InvoiceDraftBasis
):{contractId:string;version:number;monthlyVnd:string}{
 if(!c||c.source!=='VERIFIED_SERVER'||!i)throw Error('CONTRACT_BILLING_SOURCE_UNVERIFIED');
 if(!c.contractId||!c.residentId||c.contractId!==i.contractId||
    c.residentId!==i.residentId)throw Error('CONTRACT_BILLING_IDENTITY_MISMATCH');
 if(!Number.isSafeInteger(c.version)||c.version<1||
    i.contractVersion!==c.version)throw Error('CONTRACT_BILLING_VERSION_MISMATCH');
 if(c.status!=='ACTIVE'||!c.approvedAt||!c.signedAt)
    throw Error('CONTRACT_BILLING_NOT_APPROVED');
 if(!/^\d{4}-\d{2}-01$/.test(i.billingMonth)||
    !/^\d{4}-\d{2}-\d{2}$/.test(c.effectiveDate)||
    Number.isNaN(Date.parse(i.billingMonth+'T00:00:00Z'))||
    Number.isNaN(Date.parse(c.effectiveDate+'T00:00:00Z')))
    throw Error('CONTRACT_BILLING_DATE_INVALID');
 if(c.effectiveDate>i.billingMonth)throw Error('CONTRACT_BILLING_NOT_EFFECTIVE_AT_PERIOD_START');
 if(i.status!=='DRAFT')throw Error('CONTRACT_BILLING_ISSUED_INVOICE_IMMUTABLE');
 const expected=vnd(c.monthlyFeeVnd),actual=vnd(i.totalVnd);
 if(actual!==expected)throw Error('CONTRACT_BILLING_TOTAL_MISMATCH');
 return {contractId:c.contractId,version:c.version,monthlyVnd:expected.toString()};
}
