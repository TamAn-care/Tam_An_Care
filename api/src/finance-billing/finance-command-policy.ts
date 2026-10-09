/**
 * Finance write-command preflight. Pure functions only:
 * no persistence, no HTTP routes, no auto-issued business documents.
 * A future authenticated transaction service may call these after
 * server-verified RBAC, session and canonical source checks.
 */
export type FinanceCommand =
  | { kind:'APPROVE_INVOICE'; currentStatus:string; invoiceTotalVnd:string; lineAmountsVnd:string[] }
  | { kind:'ISSUE_INVOICE'; currentStatus:string; invoiceTotalVnd:string; lineAmountsVnd:string[]; contractVerified:boolean }
  | { kind:'CONFIRM_RECEIPT'; currentStatus:string; amountVnd:string; paymentEvidenceVerified:boolean }
  | { kind:'ALLOCATE_RECEIPT'; receiptStatus:string; invoiceStatus:string; sameResident:boolean; amountVnd:string; receiptRemainingVnd:string; invoiceRemainingVnd:string };

function money(value:string): bigint {
  if (typeof value !== 'string' ||
      !/^(0|[1-9]\d*)(?:\.0{1,2})?$/.test(value)) {
    throw new Error('FINANCE_INVALID_INTEGER_VND');
  }
  const n=BigInt(value.split('.')[0]);
  if (n > 9999999999999999n) throw new Error('FINANCE_VND_LIMIT');
  return n;
}
function assertInvoiceLines(totalVnd:string, lines:string[]):void {
  if (!Array.isArray(lines) || lines.length===0) {
    throw new Error('FINANCE_INVOICE_LINES_REQUIRED');
  }
  const total=money(totalVnd);
  if (lines.reduce((sum,item)=>sum+money(item),0n)!==total) {
    throw new Error('FINANCE_INVOICE_TOTAL_MISMATCH');
  }
  if (total===0n) throw new Error('FINANCE_ZERO_INVOICE_NOT_AUTHORIZED');
}
export function validateFinanceCommand(command:FinanceCommand):void {
  switch(command.kind){
    case 'APPROVE_INVOICE':
      if(command.currentStatus!=='DRAFT') throw new Error('FINANCE_APPROVAL_STATUS_FORBIDDEN');
      assertInvoiceLines(command.invoiceTotalVnd,command.lineAmountsVnd);
      return;
    case 'ISSUE_INVOICE':
      if(command.currentStatus!=='APPROVED') throw new Error('FINANCE_ISSUANCE_STATUS_FORBIDDEN');
      if(command.contractVerified!==true) throw new Error('FINANCE_CONTRACT_UNVERIFIED');
      assertInvoiceLines(command.invoiceTotalVnd,command.lineAmountsVnd);
      return;
    case 'CONFIRM_RECEIPT':
      if(command.currentStatus!=='DRAFT') throw new Error('FINANCE_RECEIPT_STATUS_FORBIDDEN');
      if(command.paymentEvidenceVerified!==true) throw new Error('FINANCE_PAYMENT_EVIDENCE_UNVERIFIED');
      if(money(command.amountVnd)===0n) throw new Error('FINANCE_RECEIPT_AMOUNT_INVALID');
      return;
    case 'ALLOCATE_RECEIPT':
      if(command.receiptStatus!=='CONFIRMED') throw new Error('FINANCE_RECEIPT_NOT_CONFIRMED');
      if(!['ISSUED','PARTIAL'].includes(command.invoiceStatus)) throw new Error('FINANCE_INVOICE_NOT_PAYABLE');
      if(command.sameResident!==true) throw new Error('FINANCE_CROSS_RESIDENT_FORBIDDEN');
      const amount=money(command.amountVnd);
      if(amount===0n || amount>money(command.receiptRemainingVnd) ||
         amount>money(command.invoiceRemainingVnd)) {
        throw new Error('FINANCE_ALLOCATION_OUT_OF_BOUNDS');
      }
      return;
    default: {
      const neverCommand:never=command;
      throw new Error('FINANCE_UNSUPPORTED_COMMAND:'+String(neverCommand));
    }
  }
}
