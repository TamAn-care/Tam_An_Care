import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';
import type { ServerVerifiedFinanceIdentity } from '../security/verified-finance-identity';

const mealTypes = ['BREAKFAST', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER'];
const dateOnly = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

@Injectable()
export class FamilyMealService {
  constructor(private readonly db: DatabaseService, private readonly residentScope: ResidentAccessScopeService) {}

  private async active(identity: ServerVerifiedFinanceIdentity) {
    const r = await this.db.query(`SELECT 1 FROM public.auth_sessions s JOIN public.staff_actors a ON a.actor_id=s.actor_id WHERE s.session_id=$1 AND s.actor_id=$2 AND s.actor_role=$3 AND s.revoked_at IS NULL AND s.expires_at>now() AND a.status='ACTIVE' AND a.primary_operational_role=$3 LIMIT 1`, [identity.sessionId, identity.actorId, identity.actorRole]);
    if (r.rowCount !== 1) throw new ForbiddenException('ACTIVE_SESSION_REQUIRED');
  }

  private async scope(identity: ServerVerifiedFinanceIdentity, residentId: string) {
    await this.active(identity);
    if (identity.actorRole !== 'GUARDIAN' || !await this.residentScope.canAccessResident(identity.actorId, 'GUARDIAN', residentId)) throw new ForbiddenException('FAMILY_MEAL_RESIDENT_SCOPE_DENIED');
  }

  async list(identity: ServerVerifiedFinanceIdentity, residentId: string) {
    await this.scope(identity, residentId);
    const r = await this.db.query(`SELECT order_id AS "orderId",resident_id AS "residentId",contract_id AS "contractId",service_date AS "serviceDate",meal_type AS "mealType",registered_quantity AS "registeredQuantity",status,registered_at AS "registeredAt",confirmed_quantity AS "confirmedQuantity",unit_price_vnd AS "unitPriceVnd",amount_vnd AS "amountVnd" FROM public.family_extra_meal_orders WHERE resident_id=$1 ORDER BY service_date DESC,registered_at DESC LIMIT 200`, [residentId]);
    return r.rows;
  }

  async register(identity: ServerVerifiedFinanceIdentity, input: {residentId: string; serviceDate: string; mealType: string; quantity: number; idempotencyKey: string}) {
    if (!input || !/^[A-Za-z0-9_-]{1,160}$/.test(input.residentId) || !dateOnly(input.serviceDate) || !mealTypes.includes(input.mealType) || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100 || !/^[A-Za-z0-9_-]{16,120}$/.test(input.idempotencyKey)) throw new BadRequestException('FAMILY_MEAL_REGISTRATION_INVALID');
    await this.scope(identity, input.residentId);
    return this.db.withTransaction(async c => {
      const existing = await c.query(`SELECT order_id AS "orderId",resident_id AS "residentId",contract_id AS "contractId",service_date::text AS "serviceDate",meal_type AS "mealType",registered_quantity AS "registeredQuantity",registered_by AS "registeredBy",status,registered_at AS "registeredAt" FROM public.family_extra_meal_orders WHERE idempotency_key=$1`, [input.idempotencyKey]);
      if (existing.rowCount) {
        const row = existing.rows[0];
        if (row.residentId !== input.residentId || row.serviceDate !== input.serviceDate || row.mealType !== input.mealType || row.registeredQuantity !== input.quantity || row.registeredBy !== identity.actorId) throw new BadRequestException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
        return row;
      }
      const contract = await c.query(`SELECT v.contract_id,v.version FROM public.service_contract_records r JOIN public.service_contract_versions v ON v.contract_id=r.contract_id JOIN public.service_contract_signing_evidence e ON e.contract_id=v.contract_id AND e.version=v.version WHERE r.resident_id=$1 AND v.status='ACTIVE' AND v.effective_date <= $2::date ORDER BY v.effective_date DESC,v.version DESC LIMIT 1`, [input.residentId, input.serviceDate]);
      if (contract.rowCount !== 1) throw new BadRequestException('FAMILY_MEAL_ACTIVE_SIGNED_CONTRACT_UNVERIFIED');
      const orderId = `fme_${randomUUID().replaceAll('-', '')}`;
      const inserted = await c.query(`INSERT INTO public.family_extra_meal_orders(order_id,resident_id,contract_id,service_date,meal_type,registered_quantity,registered_by,registered_role,idempotency_key) VALUES($1,$2,$3,$4::date,$5,$6,$7,'GUARDIAN',$8) ON CONFLICT (idempotency_key) DO NOTHING RETURNING order_id AS "orderId",resident_id AS "residentId",contract_id AS "contractId",service_date::text AS "serviceDate",meal_type AS "mealType",registered_quantity AS "registeredQuantity",status,registered_at AS "registeredAt"`, [orderId,input.residentId,contract.rows[0].contract_id,input.serviceDate,input.mealType,input.quantity,identity.actorId,input.idempotencyKey]);
      if (!inserted.rowCount) {
        const replay = await c.query(`SELECT order_id AS "orderId",resident_id AS "residentId",contract_id AS "contractId",service_date::text AS "serviceDate",meal_type AS "mealType",registered_quantity AS "registeredQuantity",registered_by AS "registeredBy",status,registered_at AS "registeredAt" FROM public.family_extra_meal_orders WHERE idempotency_key=$1`, [input.idempotencyKey]);
        const row = replay.rows[0];
        if (!row || row.residentId !== input.residentId || row.serviceDate !== input.serviceDate || row.mealType !== input.mealType || row.registeredQuantity !== input.quantity || row.registeredBy !== identity.actorId) throw new BadRequestException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
        return row;
      }
      await c.query(`INSERT INTO public.family_extra_meal_audit(order_id,actor_id,actor_role,action,reason) VALUES($1,$2,'GUARDIAN','REGISTERED','Family portal registration')`, [orderId,identity.actorId]);
      return inserted.rows[0];
    });
  }

  async confirm(identity: ServerVerifiedFinanceIdentity, orderId: string, quantity: number, reason: string) {
    await this.active(identity);
    if (!['NUTRITIONIST','SUPERVISOR','ADMIN'].includes(identity.actorRole)) throw new ForbiddenException('FAMILY_MEAL_CONFIRM_PERMISSION_DENIED');
    if (!/^fme_[a-f0-9]{32}$/.test(orderId) || !Number.isInteger(quantity) || quantity < 1 || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000) throw new BadRequestException('FAMILY_MEAL_CONFIRMATION_INVALID');
    return this.db.withTransaction(async c => {
      const order = await c.query(`SELECT * FROM public.family_extra_meal_orders WHERE order_id=$1 FOR UPDATE`, [orderId]);
      if (!order.rowCount) throw new NotFoundException('FAMILY_MEAL_ORDER_NOT_FOUND');
      const row = order.rows[0];
      if (row.status !== 'REGISTERED' || quantity > row.registered_quantity) throw new BadRequestException('FAMILY_MEAL_ORDER_NOT_CONFIRMABLE');
      const rates = await c.query(`SELECT v.price_list_id,v.version,item.value->>'amountVnd' AS amount FROM public.service_price_list_versions v JOIN LATERAL jsonb_array_elements(v.items) AS item(value) ON true WHERE v.status='APPROVED' AND v.effective_from <= $1::date AND (v.effective_to IS NULL OR v.effective_to >= $1::date) AND item.value->>'serviceCode'='FAMILY_EXTRA_MEAL' AND item.value->>'scope'='MEAL' AND item.value->>'unit'='MEAL' ORDER BY v.effective_from DESC,v.version DESC`, [row.service_date]);
      if (rates.rowCount !== 1) throw new BadRequestException('BILLING_EXTRA_MEAL_UNVERIFIED');
      const amountText = rates.rows[0].amount;
      if (typeof amountText !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(amountText)) throw new BadRequestException('BILLING_EXTRA_MEAL_PRICE_INVALID');
      const unit = BigInt(amountText); const total = BigInt(quantity) * unit;
      if (total > 9223372036854775807n) throw new BadRequestException('BILLING_EXTRA_MEAL_AMOUNT_OVERFLOW');
      const saved = await c.query(`UPDATE public.family_extra_meal_orders SET status='CONFIRMED',confirmed_quantity=$2,confirmed_by=$3,confirmed_role=$4,confirmed_at=now(),price_list_id=$5,price_list_version=$6,service_code='FAMILY_EXTRA_MEAL',unit_price_vnd=$7::bigint,amount_vnd=$8::bigint,confirmation_reason=$9 WHERE order_id=$1 AND status='REGISTERED' RETURNING order_id AS "orderId",resident_id AS "residentId",contract_id AS "contractId",service_date AS "serviceDate",meal_type AS "mealType",registered_quantity AS "registeredQuantity",confirmed_quantity AS "confirmedQuantity",status,price_list_id AS "priceListId",price_list_version AS "priceListVersion",service_code AS "serviceCode",unit_price_vnd AS "unitPriceVnd",amount_vnd AS "amountVnd",confirmed_at AS "confirmedAt"`, [orderId,quantity,identity.actorId,identity.actorRole,rates.rows[0].price_list_id,rates.rows[0].version,amountText,total.toString(),reason.trim()]);
      if (!saved.rowCount) throw new BadRequestException('FAMILY_MEAL_ORDER_NOT_CONFIRMABLE');
      await c.query(`INSERT INTO public.family_extra_meal_audit(order_id,actor_id,actor_role,action,reason) VALUES($1,$2,$3,'CONFIRMED',$4)`, [orderId,identity.actorId,identity.actorRole,reason.trim()]);
      return saved.rows[0];
    });
  }
}
