import { BadRequestException, ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class FamilyMealBillingService {
  constructor(private readonly db: DatabaseService) {}

  async generateDraft(input: {residentId: string; billingMonth: string; actorId: string}) {
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.residentId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.billingMonth) || !/^[A-Za-z0-9_-]{1,160}$/.test(input.actorId)) throw new BadRequestException('FAMILY_MEAL_BILLING_REQUEST_INVALID');
    const start = `${input.billingMonth}-01`;
    const next = new Date(Date.UTC(Number(input.billingMonth.slice(0,4)), Number(input.billingMonth.slice(5,7)), 1)).toISOString().slice(0,10);
    return this.db.withTransaction(async c => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`family-meal-billing:${input.residentId}:${start}`]);
      const contract = await c.query(`SELECT r.contract_id,v.version,v.effective_date,a.monthly_fee_vnd::text AS package_fee_vnd,a.approved_sha256,s.document_sha256 FROM public.service_contract_records r JOIN public.service_contract_versions v ON v.contract_id=r.contract_id JOIN public.service_contract_signing_evidence s ON s.contract_id=v.contract_id AND s.version=v.version JOIN public.service_contract_approval_decisions a ON a.contract_id=v.contract_id AND a.version=v.version WHERE r.resident_id=$1 AND r.status='ACTIVE' AND v.status='ACTIVE' AND v.effective_date <= $2::date AND s.document_sha256=a.approved_sha256 ORDER BY v.effective_date DESC,v.version DESC LIMIT 2 FOR SHARE`, [input.residentId,start]);
      if (contract.rowCount !== 1) throw new UnprocessableEntityException('FINANCE_ACTIVE_SIGNED_CONTRACT_UNVERIFIED');
      if (contract.rows[0].package_fee_vnd === null || !/^(0|[1-9][0-9]{0,15})(?:\.0+)?$/.test(contract.rows[0].package_fee_vnd)) throw new UnprocessableEntityException('FINANCE_CONTRACT_PACKAGE_FEE_INVALID');
      const changes = await c.query(`SELECT 1 FROM public.service_contract_versions v JOIN public.service_contract_signing_evidence s USING(contract_id,version) JOIN public.service_contract_approval_decisions a USING(contract_id,version) WHERE v.contract_id=$1 AND v.status IN ('SIGNED','ACTIVE','SUPERSEDED') AND v.effective_date>$2::date AND v.effective_date<$3::date AND s.document_sha256=a.approved_sha256 LIMIT 1`, [contract.rows[0].contract_id,start,next]);
      if (changes.rowCount) throw new UnprocessableEntityException('FINANCE_CONTRACT_CHANGED_MID_MONTH_REQUIRES_SEGMENT_POLICY');
      const adjustments = await c.query(`SELECT 1 FROM public.finance_discount_assignments x JOIN public.finance_discount_policies p ON p.discount_id=x.discount_id WHERE x.resident_id=$1 AND x.contract_id=$2 AND p.approval_state='APPROVED' AND x.effective_from<$4::date AND COALESCE(x.effective_to,'infinity'::date)>=$3::date LIMIT 1`, [input.residentId,contract.rows[0].contract_id,start,next]);
      if (adjustments.rowCount) throw new UnprocessableEntityException('FINANCE_APPROVED_DISCOUNT_ENGINE_REQUIRED');
      const absences = await c.query(`SELECT 1 FROM public.finance_absence_deduction_evidence WHERE resident_id=$1 AND approved_by IS NOT NULL AND absence_from<$3::date AND absence_to >= $2::date LIMIT 1`, [input.residentId,start,next]);
      if (absences.rowCount) throw new UnprocessableEntityException('FINANCE_APPROVED_ABSENCE_ADJUSTMENT_ENGINE_REQUIRED');

      const existing = await c.query(`SELECT invoice_id,invoice_code,status,contract_id,contract_version,reviewed_by,total_amount_vnd::text FROM public.billing_invoices WHERE resident_id=$1 AND billing_month=$2::date FOR UPDATE`, [input.residentId,start]);
      if (existing.rows.length > 1) throw new ConflictException('FINANCE_DUPLICATE_INVOICE_FOR_PERIOD');
      if (existing.rowCount && existing.rows[0].status !== 'DRAFT') throw new ConflictException('FINANCE_INVOICE_PERIOD_ALREADY_FINAL');
      const invoiceId = existing.rows[0]?.invoice_id ?? `inv_${randomUUID().replaceAll('-','')}`;
      if (existing.rowCount && (existing.rows[0].contract_id !== contract.rows[0].contract_id || Number(existing.rows[0].contract_version) !== Number(contract.rows[0].version))) throw new ConflictException('FINANCE_DRAFT_CONTRACT_SOURCE_CHANGED');
      if (existing.rowCount && existing.rows[0].reviewed_by) throw new ConflictException('FINANCE_DRAFT_ALREADY_REVIEWED_RECALCULATION_BLOCKED');

      const meals = await c.query(`SELECT order_id,resident_id,contract_id,service_date::text,meal_type,confirmed_quantity,confirmed_by,confirmed_role,confirmed_at,confirmation_reason,price_list_id,price_list_version,service_code,unit_price_vnd::text,amount_vnd::text FROM public.family_extra_meal_orders WHERE resident_id=$1 AND contract_id=$2 AND status='CONFIRMED' AND service_date >= $3::date AND service_date < $4::date ORDER BY service_date,order_id FOR SHARE`, [input.residentId,contract.rows[0].contract_id,start,next]);
      for (const meal of meals.rows) {
        const linked = await c.query(`SELECT invoice_id FROM public.billing_invoice_items WHERE financial_origin_key=$1`, [`NUTRITION:FAMILY_EXTRA_MEAL:${meal.order_id}`]);
        if (linked.rowCount && linked.rows[0].invoice_id !== invoiceId) throw new ConflictException('FAMILY_MEAL_SOURCE_ALREADY_BILLED');
      }

      const invoiceCode = existing.rowCount ? undefined : `INV-${input.billingMonth}-${randomUUID().slice(0,8).toUpperCase()}`;
      if (!existing.rowCount) await c.query(`INSERT INTO public.billing_invoices(invoice_id,invoice_code,resident_id,contract_id,billing_month,contract_version,status,total_amount_vnd,prepared_by) VALUES($1,$2,$3,$4,$5::date,$6,'DRAFT',0,$7)`, [invoiceId,invoiceCode,input.residentId,contract.rows[0].contract_id,start,contract.rows[0].version,input.actorId]);
      else {
        await c.query(`UPDATE public.billing_invoices SET prepared_by=$2,total_amount_vnd=0 WHERE invoice_id=$1 AND status='DRAFT'`, [invoiceId,input.actorId]);
        await c.query(`DELETE FROM public.billing_invoice_items WHERE invoice_id=$1`, [invoiceId]);
      }
      const packageFeeText = String(contract.rows[0].package_fee_vnd).replace(/\.0+$/, '');
      let total = BigInt(packageFeeText);
      const fee = total;
      const packageOrigin = createHash('sha256').update(`${contract.rows[0].contract_id}:${contract.rows[0].version}:${input.billingMonth}`).digest('hex');
      await c.query(`INSERT INTO public.billing_invoice_items(item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,line_kind,service_period_start,service_period_end,source_domain,source_entity_type,source_entity_id,source_evidence_sha256,financial_origin_key,discount_scope) VALUES($1,$2,'Gói dịch vụ hợp đồng (đã bao gồm bữa ăn người cao tuổi)',1,$3::numeric,$3::numeric,'CONTRACT_FEE',$4::date,$5::date,NULL,NULL,NULL,NULL,$6,NULL)`, [`item_${randomUUID().replaceAll('-','')}`,invoiceId,fee.toString(),start,next,`CONTRACT:${packageOrigin}:v${contract.rows[0].version}:${input.billingMonth}`]);
      for (const meal of meals.rows) {
        if (meal.service_code !== 'FAMILY_EXTRA_MEAL' || BigInt(meal.amount_vnd) !== BigInt(String(meal.confirmed_quantity).replace(/\.0+$/, '')) * BigInt(String(meal.unit_price_vnd).replace(/\.0+$/, ''))) throw new UnprocessableEntityException('BILLING_EXTRA_MEAL_SOURCE_INVALID');
        const evidence = createHash('sha256').update(JSON.stringify({orderId:meal.order_id,residentId:meal.resident_id,contractId:meal.contract_id,serviceDate:meal.service_date,mealType:meal.meal_type,quantity:meal.confirmed_quantity,confirmedBy:meal.confirmed_by,confirmedAt:meal.confirmed_at,confirmationReason:meal.confirmation_reason,priceListId:meal.price_list_id,priceListVersion:meal.price_list_version,unitPriceVnd:meal.unit_price_vnd,amountVnd:meal.amount_vnd})).digest('hex');
        const dayAfter = new Date(`${meal.service_date}T00:00:00.000Z`); dayAfter.setUTCDate(dayAfter.getUTCDate()+1);
        const amount = BigInt(meal.amount_vnd); total += amount;
        await c.query(`INSERT INTO public.billing_invoice_items(item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,line_kind,service_period_start,service_period_end,source_domain,source_entity_type,source_entity_id,source_evidence_sha256,financial_origin_key,discount_scope,service_code,price_list_id,price_list_version) VALUES($1,$2,'FAMILY_EXTRA_MEAL',$3::numeric,$4::numeric,$5::numeric,'APPROVED_SERVICE',$6::date,$7::date,'NUTRITION','FAMILY_EXTRA_MEAL',$8,$9,$10,'SERVICE','FAMILY_EXTRA_MEAL',$11,$12)`, [`item_${randomUUID().replaceAll('-','')}`,invoiceId,String(meal.confirmed_quantity),meal.unit_price_vnd,amount.toString(),meal.service_date,dayAfter.toISOString().slice(0,10),meal.order_id,evidence,`NUTRITION:FAMILY_EXTRA_MEAL:${meal.order_id}`,meal.price_list_id,meal.price_list_version]);
      }
      if (total > 9999999999999999n) throw new UnprocessableEntityException('FINANCE_INVOICE_TOTAL_OUT_OF_RANGE');
      await c.query(`UPDATE public.billing_invoices SET total_amount_vnd=$2::numeric WHERE invoice_id=$1 AND status='DRAFT'`, [invoiceId,total.toString()]);
      return {invoiceId,invoiceCode:invoiceCode ?? existing.rows[0]?.invoice_code,billingMonth:input.billingMonth,residentId:input.residentId,contractId:contract.rows[0].contract_id,contractVersion:Number(contract.rows[0].version),packageFeeVnd:fee.toString(),familyMealCount:meals.rowCount,familyMealTotalVnd:(total-fee).toString(),familyMeals:meals.rows.map(meal=>({sourceEventId:meal.order_id,serviceDate:meal.service_date,mealType:meal.meal_type,quantity:String(meal.confirmed_quantity),unitPriceVnd:String(meal.unit_price_vnd),amountVnd:String(meal.amount_vnd),priceListId:meal.price_list_id,priceListVersion:Number(meal.price_list_version),serviceCode:meal.service_code})),totalAmountVnd:total.toString(),status:'DRAFT',residentMealsIncludedInPackage:true};
    }).catch(error => { throw this.mapDatabaseBusinessError(error); });
  }

  async reviewInvoice(input: {invoiceId: string; actorId: string; actorRole: string; reason: string}) {
    return this.transitionInvoice(input, 'REVIEW', async c => {
      const q = await c.query(`SELECT invoice_id,status,prepared_by,reviewed_by FROM public.billing_invoices WHERE invoice_id=$1 FOR UPDATE`, [input.invoiceId]);
      if (q.rowCount !== 1) throw new UnprocessableEntityException('FINANCE_INVOICE_NOT_FOUND');
      const row = q.rows[0];
      if (row.status !== 'DRAFT') throw new ConflictException('FINANCE_INVOICE_NOT_REVIEWABLE');
      if (row.prepared_by === input.actorId) throw new ConflictException('FINANCE_INVOICE_SELF_REVIEW_FORBIDDEN');
      if (row.reviewed_by && row.reviewed_by !== input.actorId) throw new ConflictException('FINANCE_INVOICE_ALREADY_REVIEWED');
      await c.query(`UPDATE public.billing_invoices SET reviewed_by=$2 WHERE invoice_id=$1 AND status='DRAFT'`, [input.invoiceId,input.actorId]);
      return {invoiceId:input.invoiceId,status:'DRAFT',reviewedBy:input.actorId};
    });
  }

  async approveInvoice(input: {invoiceId: string; actorId: string; actorRole: string; reason: string}) {
    return this.transitionInvoice(input, 'APPROVE', async c => {
      const q = await c.query(`SELECT i.invoice_id,i.status,i.prepared_by,i.reviewed_by,i.contract_id,i.contract_version,v.status AS contract_status,s.document_sha256,a.approved_sha256,a.approved_at FROM public.billing_invoices i JOIN public.service_contract_versions v ON v.contract_id=i.contract_id AND v.version=i.contract_version JOIN public.service_contract_signing_evidence s ON s.contract_id=v.contract_id AND s.version=v.version JOIN public.service_contract_approval_decisions a ON a.contract_id=v.contract_id AND a.version=v.version WHERE i.invoice_id=$1 FOR UPDATE OF i`, [input.invoiceId]);
      if (q.rowCount !== 1) throw new UnprocessableEntityException('FINANCE_INVOICE_OR_CONTRACT_EVIDENCE_NOT_FOUND');
      const row = q.rows[0];
      if (row.status !== 'DRAFT' || !row.reviewed_by) throw new ConflictException('FINANCE_INVOICE_REVIEW_REQUIRED');
      if (row.prepared_by === input.actorId || row.reviewed_by === input.actorId) throw new ConflictException('FINANCE_INVOICE_SEPARATION_OF_DUTIES_REQUIRED');
      if (row.contract_status !== 'ACTIVE' || row.document_sha256 !== row.approved_sha256) throw new UnprocessableEntityException('FINANCE_INVOICE_CONTRACT_EVIDENCE_INVALID');
      const updated = await c.query(`UPDATE public.billing_invoices SET status='APPROVED',approved_by=$2,approved_at=now(),approval_evidence_sha256=$3 WHERE invoice_id=$1 AND status='DRAFT' RETURNING invoice_id,status,approved_by,approved_at`, [input.invoiceId,input.actorId,row.approved_sha256]);
      if (updated.rowCount !== 1) throw new ConflictException('FINANCE_INVOICE_APPROVAL_RACE');
      return {...updated.rows[0],status:'APPROVED'};
    });
  }

  async issueInvoice(input: {invoiceId: string; actorId: string; actorRole: string; reason: string}) {
    return this.transitionInvoice(input, 'ISSUE', async c => {
      const q = await c.query(`SELECT invoice_id,status,prepared_by,reviewed_by,approved_by,total_amount_vnd::text AS total_amount_vnd,source_snapshot,source_snapshot_sha256,issued_at FROM public.billing_invoices WHERE invoice_id=$1 FOR UPDATE`, [input.invoiceId]);
      if (q.rowCount !== 1) throw new UnprocessableEntityException('FINANCE_INVOICE_NOT_FOUND');
      const row = q.rows[0];
      if (row.status !== 'APPROVED') throw new ConflictException('FINANCE_INVOICE_APPROVAL_REQUIRED');
      if ([row.prepared_by,row.reviewed_by,row.approved_by].includes(input.actorId)) throw new ConflictException('FINANCE_INVOICE_SEPARATION_OF_DUTIES_REQUIRED');
      const updated = await c.query(`UPDATE public.billing_invoices SET status='ISSUED' WHERE invoice_id=$1 AND status='APPROVED' RETURNING invoice_id,status,total_amount_vnd::text AS total_amount_vnd,source_snapshot,source_snapshot_sha256,issued_at`, [input.invoiceId]);
      if (updated.rowCount !== 1 || !updated.rows[0].source_snapshot) throw new ConflictException('FINANCE_INVOICE_ISSUE_RACE');
      const issued = updated.rows[0];
      return {invoiceId:issued.invoice_id,status:issued.status,totalAmountVnd:issued.total_amount_vnd,snapshot:issued.source_snapshot,snapshotSha256:String(issued.source_snapshot_sha256).trim(),issuedAt:issued.issued_at};
    });
  }

  private async transitionInvoice<T>(input: {invoiceId:string;actorId:string;actorRole:string;reason:string}, action: 'REVIEW'|'APPROVE'|'ISSUE', mutate: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.invoiceId) || input.reason.trim().length < 5 || input.reason.length > 1000) throw new BadRequestException('FINANCE_INVOICE_ACTION_INVALID');
    const operationKey = `family-meal-invoice:${input.invoiceId}:${action.toLowerCase()}`;
    const requestHash = createHash('sha256').update(JSON.stringify({invoiceId:input.invoiceId,actorId:input.actorId,actorRole:input.actorRole,reason:input.reason.trim()})).digest('hex');
    return this.db.withTransaction(async c => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`finance-invoice-action:${input.invoiceId}`]);
      const prior = await c.query(`SELECT actor_id,request_hash,status,result_payload FROM public.finance_operation_idempotency WHERE operation_key=$1 FOR UPDATE`, [operationKey]);
      if (prior.rowCount) {
        if (prior.rows[0].actor_id !== input.actorId || prior.rows[0].request_hash !== requestHash) throw new ConflictException('FINANCE_IDEMPOTENCY_CONFLICT');
        if (prior.rows[0].status === 'COMPLETED' && prior.rows[0].result_payload) return prior.rows[0].result_payload as T;
        throw new ConflictException('FINANCE_OPERATION_INCOMPLETE');
      }
      await c.query(`INSERT INTO public.finance_operation_idempotency(operation_key,operation_type,request_hash,actor_id,status) VALUES($1,$2,$3,$4,'IN_PROGRESS')`, [operationKey,`FAMILY_MEAL_INVOICE_${action}`,requestHash,input.actorId]);
      const result = await mutate(c);
      await c.query(`INSERT INTO public.finance_operation_audit(operation_key,actor_id,action,details) VALUES($1,$2,$3,$4::jsonb)`, [operationKey,input.actorId,action,JSON.stringify({invoiceId:input.invoiceId,actorRole:input.actorRole,reason:input.reason.trim()})]);
      await c.query(`UPDATE public.finance_operation_idempotency SET status='COMPLETED',result_payload=$2::jsonb,completed_at=now() WHERE operation_key=$1`, [operationKey,JSON.stringify(result)]);
      return result;
    }).catch(error => { throw this.mapDatabaseBusinessError(error); });
  }

  private mapDatabaseBusinessError(error: unknown): Error {
    const message = error instanceof Error ? error.message : '';
    const conflicts = new Set([
      'FINANCE_STATUS_TRANSITION_FORBIDDEN','FINANCE_APPROVED_INVOICE_IMMUTABLE',
      'FINANCE_INVOICE_ALREADY_SNAPSHOTTED','FINANCE_ISSUED_INVOICE_LINES_IMMUTABLE',
    ]);
    const invalid = new Set([
      'FINANCE_INVOICE_CONTRACT_APPROVAL_MISMATCH','FINANCE_INVOICE_APPROVAL_ACTORS_INVALID',
      'FINANCE_INVOICE_TOTAL_DOES_NOT_MATCH_LINES','FINANCE_INVOICE_SERVICE_PERIOD_OUTSIDE_BILLING_MONTH',
      'FINANCE_INVOICE_BASE_FEE_DIFFERS_FROM_APPROVED_CONTRACT',
      'FINANCE_INVOICE_SNAPSHOT_CONTRACT_EVIDENCE_INVALID','FINANCE_INVOICE_SNAPSHOT_TOTAL_INVALID',
      'FINANCE_FAMILY_MEAL_SOURCE_MISMATCH','FINANCE_FAMILY_MEAL_SOURCE_OMITTED',
    ]);
    if (conflicts.has(message)) return new ConflictException(message);
    if (invalid.has(message)) return new UnprocessableEntityException(message);
    return error instanceof Error ? error : new Error('FINANCE_BILLING_OPERATION_FAILED');
  }
}
