import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';

type Identity={actorId:string;actorRole:string;sessionId:string};
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const month=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const wholeVnd=(value:unknown):string=>{const s=String(value);if(!/^[0-9]+$/.test(s)||BigInt(s)>9999999999999999n)throw new BadRequestException('FINANCE_INVALID_VND');return s;};

@Injectable()
export class GeneralFinanceWorkflowService {
  constructor(private readonly db:DatabaseService){}

  async assertActor(identity:Identity, roles:string[], enabled:string):Promise<void>{
    if(process.env[enabled]!=='true')throw new ForbiddenException('FINANCE_WORKFLOW_RELEASE_GATE_CLOSED');
    if(!identity||!id(identity.actorId)||!roles.includes(identity.actorRole))throw new ForbiddenException('FINANCE_ROLE_NOT_AUTHORIZED');
    const r=await this.db.query(`SELECT 1 FROM public.auth_sessions s JOIN public.staff_actors a ON a.actor_id=s.actor_id WHERE s.session_id=$1 AND s.actor_id=$2 AND s.actor_role=$3 AND s.revoked_at IS NULL AND s.expires_at>now() AND a.status='ACTIVE' AND a.primary_operational_role=$3`,[identity.sessionId,identity.actorId,identity.actorRole]);
    if(r.rowCount!==1)throw new ForbiddenException('FINANCE_SESSION_NOT_ACTIVE');
  }

  async createInvoice(identity:Identity,input:Record<string,unknown>){
    await this.assertActor(identity,(process.env.TAMANCARE_FINANCE_WRITE_ROLES||'').split(',').filter(Boolean),'TAMANCARE_FINANCE_WRITE_ENABLED');
    if(!id(input.invoiceId)||!id(input.invoiceCode)||!id(input.contractId)||!id(input.residentId)||!month(input.billingMonth))throw new BadRequestException('FINANCE_INVOICE_DRAFT_INVALID');
    const origin=`CONTRACT:${input.contractId}:${input.billingMonth}`;
    return this.db.withTransaction(async c=>{
      const contract=await c.query(`SELECT c.resident_id,c.version,v.status,v.effective_date,a.monthly_fee_vnd FROM public.service_contract_records c JOIN public.service_contract_versions v ON v.contract_id=c.contract_id AND v.version=c.version JOIN public.service_contract_approval_decisions a ON a.contract_id=v.contract_id AND a.version=v.version WHERE c.contract_id=$1 AND c.status='ACTIVE' AND v.status='ACTIVE'`,[input.contractId]);
      if(contract.rowCount!==1||contract.rows[0].resident_id!==input.residentId)throw new BadRequestException('FINANCE_CONTRACT_NOT_BILLABLE');
      const existing=await c.query(`SELECT invoice_id,status FROM public.billing_invoices WHERE billing_origin_key=$1`,[origin]);
      if(existing.rowCount)throw new ConflictException('FINANCE_DUPLICATE_BILLING_PERIOD');
      const approvedAmount=wholeVnd(contract.rows[0].monthly_fee_vnd);
      if(input.amountVnd!==undefined&&wholeVnd(input.amountVnd)!==approvedAmount)throw new BadRequestException('FINANCE_CONTRACT_PRICE_MISMATCH');
      const amount=approvedAmount;
      await c.query(`INSERT INTO public.billing_invoices(invoice_id,invoice_code,resident_id,contract_id,billing_month,contract_version,status,total_amount_vnd,prepared_by,invoice_kind,billing_origin_key) VALUES($1,$2,$3,$4,$5::date,$6,'DRAFT',$7,$8,'GENERAL',$9)`,[input.invoiceId,input.invoiceCode,input.residentId,input.contractId,`${input.billingMonth}-01`,contract.rows[0].version,amount,identity.actorId,origin]);
      await c.query(`INSERT INTO public.billing_invoice_items(item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,line_kind,service_period_start,service_period_end,financial_origin_key) VALUES($1,$2,'Contracted care package',1,$3,$3,'CONTRACT_FEE',$4::date,($4::date+INTERVAL '1 month')::date,$5)`,[`${input.invoiceId}-fee`,input.invoiceId,amount,`${input.billingMonth}-01`,`${origin}:CONTRACT_FEE`]);
      await c.query(`INSERT INTO public.finance_document_audit(document_type,document_id,action,actor_id,after_state,reason) VALUES('INVOICE',$1,'DRAFT_CREATED',$2,$3::jsonb,'General invoice draft created')`,[input.invoiceId,identity.actorId,JSON.stringify({amountVnd:amount,origin})]);
      return {invoiceId:input.invoiceId,status:'DRAFT',amountVnd:amount};
    });
  }

  async transitionInvoice(identity:Identity,invoiceId:string,action:'REVIEW'|'APPROVE'|'ISSUE',reason:string){
    if(!id(invoiceId)||reason.trim().length<5)throw new BadRequestException('FINANCE_INVOICE_ACTION_INVALID');
    const env=action==='REVIEW'?'TAMANCARE_FINANCE_INVOICE_REVIEW_ROLES':action==='APPROVE'?'TAMANCARE_FINANCE_INVOICE_APPROVE_ROLES':'TAMANCARE_FINANCE_INVOICE_ISSUE_ROLES';
    const roles=(process.env[env]||'').split(',').filter(Boolean); await this.assertActor(identity,roles,'TAMANCARE_FINANCE_WRITE_ENABLED');
    return this.db.withTransaction(async c=>{
      const row=await c.query(`SELECT i.*,a.approved_sha256 AS contract_approved_sha256 FROM public.billing_invoices i JOIN public.service_contract_approval_decisions a ON a.contract_id=i.contract_id AND a.version=i.contract_version WHERE i.invoice_id=$1 FOR UPDATE`,[invoiceId]); if(row.rowCount!==1)throw new BadRequestException('FINANCE_INVOICE_NOT_FOUND');
      const current=row.rows[0].status; const next=action==='REVIEW'?'REVIEWED':action==='APPROVE'?'APPROVED':'ISSUED';
      const allowed=(action==='REVIEW'&&current==='DRAFT')||(action==='APPROVE'&&current==='REVIEWED')||(action==='ISSUE'&&current==='APPROVED'); if(!allowed)throw new ConflictException('FINANCE_INVALID_INVOICE_TRANSITION');
      const hash=createHash('sha256').update(`${invoiceId}:${next}:${reason}`).digest('hex');
      if(action==='REVIEW') await c.query(`UPDATE public.billing_invoices SET status='REVIEWED',reviewed_by=$2,reviewed_at=now(),review_reason=$3 WHERE invoice_id=$1`,[invoiceId,identity.actorId,reason]);
      else if(action==='APPROVE') await c.query(`UPDATE public.billing_invoices SET status='APPROVED',approved_by=$2,approved_at=now(),approval_evidence_sha256=$3 WHERE invoice_id=$1`,[invoiceId,identity.actorId,row.rows[0].contract_approved_sha256||hash]);
      else await c.query(`UPDATE public.billing_invoices SET status='ISSUED',issued_by=$2 WHERE invoice_id=$1`,[invoiceId,identity.actorId]);
      await c.query(`INSERT INTO public.finance_document_audit(document_type,document_id,action,actor_id,before_state,after_state,reason) VALUES('INVOICE',$1,$2,$3,$4::jsonb,$5::jsonb,$6)`,[invoiceId,`STATUS_${next}`,identity.actorId,JSON.stringify({status:current}),JSON.stringify({status:next}),reason]);
      return {invoiceId,status:next,actorId:identity.actorId};
    });
  }

  async createReceipt(identity:Identity,input:Record<string,unknown>){
    const roles=(process.env.TAMANCARE_FINANCE_RECEIPT_WRITE_ROLES||'ACCOUNTANT').split(',').filter(Boolean); await this.assertActor(identity,roles,'TAMANCARE_FINANCE_WRITE_ENABLED');
    if(!id(input.receiptId)||!id(input.receiptCode)||!id(input.residentId)||typeof input.receivedDate!=='string')throw new BadRequestException('FINANCE_RECEIPT_INVALID');
    const amount=wholeVnd(input.amountVnd); return this.db.query(`INSERT INTO public.billing_receipts(receipt_id,receipt_code,resident_id,amount_vnd,received_date,status,external_reference,payment_method,supporting_document_ref) VALUES($1,$2,$3,$4,$5::date,'DRAFT',$6,$7,$8) RETURNING receipt_id,status`,[input.receiptId,input.receiptCode,input.residentId,amount,input.receivedDate,input.externalReference??null,input.paymentMethod??null,input.supportingDocumentRef??null]).then(r=>({receiptId:r.rows[0].receipt_id,status:r.rows[0].status}));
  }

  async verifyReceipt(identity:Identity,receiptId:string,reason:string){
    const roles=(process.env.TAMANCARE_FINANCE_RECEIPT_VERIFY_ROLES||'ADMIN,SUPERVISOR').split(',').filter(Boolean); await this.assertActor(identity,roles,'TAMANCARE_FINANCE_WRITE_ENABLED');
    if(!id(receiptId)||reason.trim().length<5)throw new BadRequestException('FINANCE_RECEIPT_VERIFY_INVALID');
    return this.db.withTransaction(async c=>{const r=await c.query(`UPDATE public.billing_receipts SET status='CONFIRMED',verified_by=$2,verified_at=now() WHERE receipt_id=$1 AND status='DRAFT' RETURNING receipt_id,status`,[receiptId,identity.actorId]);if(r.rowCount!==1)throw new ConflictException('FINANCE_RECEIPT_INVALID_STATE');await c.query(`INSERT INTO public.finance_document_audit(document_type,document_id,action,actor_id,reason) VALUES('RECEIPT',$1,'VERIFIED',$2,$3)`,[receiptId,identity.actorId,reason]);return r.rows[0];});
  }

  async postInvoiceLedger(identity:Identity,invoiceId:string,reason:string){
    const roles=(process.env.TAMANCARE_FINANCE_LEDGER_POST_ROLES||'ACCOUNTANT,ADMIN,SUPERVISOR').split(',').filter(Boolean); await this.assertActor(identity,roles,'TAMANCARE_FINANCE_WRITE_ENABLED');
    if(!id(invoiceId)||reason.trim().length<5)throw new BadRequestException('FINANCE_LEDGER_POST_INVALID');
    return this.db.withTransaction(async c=>{
      const invoice=await c.query(`SELECT invoice_id,resident_id,total_amount_vnd,billing_month,status FROM public.billing_invoices WHERE invoice_id=$1 FOR UPDATE`,[invoiceId]);
      if(invoice.rowCount!==1)throw new BadRequestException('FINANCE_INVOICE_NOT_FOUND');
      if(!['ISSUED','PARTIAL','PAID'].includes(invoice.rows[0].status))throw new ConflictException('FINANCE_INVOICE_NOT_ISSUED');
      const origin=`INVOICE:${invoiceId}:REVENUE`;
      const existing=await c.query(`SELECT finance_entry_id,status FROM public.finance_entries WHERE financial_origin_key=$1`,[origin]);
      if(existing.rowCount)return {financeEntryId:existing.rows[0].finance_entry_id,status:existing.rows[0].status,replayed:true};
      const entryId=`LEDGER-${invoiceId}`;
      await c.query(`INSERT INTO public.finance_entries(finance_entry_id,entry_type,category,description,amount_vnd,recognition_date,cash_date,resident_id,source_mode,source_domain,source_entity_type,source_entity_id,status,reference_number,note,created_by,created_by_role,financial_origin_key) VALUES($1,'REVENUE','CONTRACTED_CARE','Issued general invoice', $2,$3::date,NULL,$4,'SYSTEM','FINANCE','INVOICE',$5,'POSTED',$5,$6,$7,$8,$9)`,[entryId,invoice.rows[0].total_amount_vnd,invoice.rows[0].billing_month,invoice.rows[0].resident_id,invoiceId,reason,identity.actorId,identity.actorRole,origin]);
      await c.query(`INSERT INTO public.finance_document_audit(document_type,document_id,action,actor_id,after_state,reason) VALUES('INVOICE',$1,'LEDGER_POSTED',$2,$3::jsonb,$4)`,[invoiceId,identity.actorId,JSON.stringify({financeEntryId:entryId,origin}),reason]);
      return {financeEntryId:entryId,status:'POSTED',replayed:false};
    });
  }

  async closePeriod(identity:Identity,period:string,reason:string,reopen=false){
    const roles=['ADMIN','SUPERVISOR']; await this.assertActor(identity,roles,'TAMANCARE_FINANCE_WRITE_ENABLED'); if(!month(period)||reason.trim().length<10)throw new BadRequestException('FINANCE_PERIOD_INVALID');
    return this.db.withTransaction(async c=>{if(reopen){const r=await c.query(`UPDATE public.finance_periods SET status='OPEN',closed_by=NULL,closed_at=NULL,reopened_by=$2,reopened_at=now(),reopen_reason=$3 WHERE period_month=$1::date AND status='CLOSED' RETURNING period_month,status`,[`${period}-01`,identity.actorId,reason]);if(r.rowCount!==1)throw new ConflictException('FINANCE_PERIOD_NOT_CLOSED');await c.query(`INSERT INTO public.finance_document_audit(document_type,document_id,action,actor_id,reason) VALUES('PERIOD',$1,'REOPENED',$2,$3)`,[period,identity.actorId,reason]);return r.rows[0];}
      if(process.env.TAMANCARE_FINANCE_ALLOW_UNRECONCILED_CLOSE!=='true'){
        const evidence=await c.query(`SELECT count(*)::int AS count FROM public.finance_entries WHERE recognition_date >= $1::date AND recognition_date < ($1::date + INTERVAL '1 month') AND status='POSTED'`,[`${period}-01`]);
        if(evidence.rows[0].count===0)throw new ConflictException('FINANCE_PERIOD_RECONCILIATION_REQUIRED');
      }
      const r=await c.query(`INSERT INTO public.finance_periods(period_month,status,closed_by,closed_at) VALUES($1::date,'CLOSED',$2,now()) ON CONFLICT(period_month) DO UPDATE SET status='CLOSED',closed_by=EXCLUDED.closed_by,closed_at=EXCLUDED.closed_at WHERE finance_periods.status='OPEN' RETURNING period_month,status`,[`${period}-01`,identity.actorId]);if(r.rowCount!==1)throw new ConflictException('FINANCE_PERIOD_ALREADY_CLOSED');await c.query(`INSERT INTO public.finance_document_audit(document_type,document_id,action,actor_id,reason) VALUES('PERIOD',$1,'CLOSED',$2,$3)`,[period,identity.actorId,reason]);return r.rows[0];});
  }
}
