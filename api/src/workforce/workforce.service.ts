import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

type Actor = { actorId: string; actorRole: string };
const HUMAN_ROLES = new Set([
  'SUPERVISOR',
  'CARE_MANAGER',
  'PSYCHOLOGIST',
  'SOCIAL_WORKER',
  'NURSE',
  'CAREGIVER',
  'NUTRITIONIST',
  'HOUSEKEEPING',
  'REHABILITATION_SPECIALIST',
  'SECURITY',
  'ACCOUNTANT',
  'RECEPTIONIST',
]);
const MGMT_ROLES = new Set(['CARE_MANAGER', 'SUPERVISOR']);
const VALID_SHIFT_TYPES = new Set(['MORNING', 'AFTERNOON', 'NIGHT', 'CUSTOM']);

@Injectable()
export class WorkforceService implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS shift_swap_requests (
          swap_request_id TEXT PRIMARY KEY,
          requester_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
          original_shift_id TEXT NOT NULL REFERENCES shift_assignments(shift_id),
          target_actor_id TEXT REFERENCES staff_actors(actor_id),
          target_shift_id TEXT REFERENCES shift_assignments(shift_id),
          reason TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
          approved_by TEXT REFERENCES staff_actors(actor_id),
          approved_by_role TEXT,
          rejection_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS staff_recognitions (
          recognition_id TEXT PRIMARY KEY,
          staff_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
          recognition_type TEXT NOT NULL CHECK (recognition_type IN ('COMMENDATION', 'SPECIAL_ACHIEVEMENT', 'EFFORT_RECOGNITION', 'DISCIPLINE_WARNING', 'SAFETY_AWARD')),
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          kpi_bonus_points INT NOT NULL DEFAULT 0,
          awarded_by TEXT NOT NULL REFERENCES staff_actors(actor_id),
          awarded_by_role TEXT NOT NULL,
          awarded_date DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    } catch (err) {
      console.warn('WorkforceService onModuleInit table check skipped or failed:', err);
    }
  }

  private req(v: any, name: string): string {
    const x = String(v ?? '').trim();
    if (!x) throw new BadRequestException(`${name} is required`);
    return x;
  }

  private page(l?: string, o?: string) {
    const limit = l ? Number(l) : 50;
    const offset = o ? Number(o) : 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException('offset must be non-negative');
    }
    return { limit, offset };
  }

  private async auth(a: Actor, roles: Set<string> = HUMAN_ROLES) {
    if (!a.actorId || !a.actorRole) {
      throw new UnauthorizedException('Authenticated human actor context is required');
    }
    if (!roles.has(a.actorRole)) {
      throw new ForbiddenException('Actor role is not authorized');
    }
    const q = await this.db.query(
      `SELECT primary_operational_role, status FROM staff_actors WHERE actor_id = $1 LIMIT 1`,
      [a.actorId],
    );
    const x = q.rows[0];
    if (!x || x.status !== 'ACTIVE' || x.primary_operational_role !== a.actorRole) {
      throw new ForbiddenException('Canonical active staff actor is required');
    }
  }

  async scheduleShift(a: Actor, body: any = {}) {
    await this.auth(a, MGMT_ROLES);

    const staffActorId = this.req(body?.staffActorId, 'staffActorId');
    const shiftDate = this.req(body?.shiftDate, 'shiftDate');
    const shiftType = this.req(body?.shiftType, 'shiftType').toUpperCase();
    if (!VALID_SHIFT_TYPES.has(shiftType)) {
      throw new BadRequestException(`shiftType must be one of: ${Array.from(VALID_SHIFT_TYPES).join(', ')}`);
    }

    const startTimeStr = this.req(body?.startTime, 'startTime');
    const endTimeStr = this.req(body?.endTime, 'endTime');
    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    if (Number.isNaN(startTime.getTime())) throw new BadRequestException('startTime is invalid');
    if (Number.isNaN(endTime.getTime())) throw new BadRequestException('endTime is invalid');
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const notes = String(body?.notes ?? '').trim() || null;

    return this.db.withTransaction(async c => {
      const sq = await c.query(
        `SELECT actor_id, display_name, primary_operational_role, status FROM staff_actors WHERE actor_id = $1`,
        [staffActorId],
      );
      if (sq.rowCount !== 1) throw new NotFoundException('Staff actor not found');
      if (sq.rows[0].status !== 'ACTIVE') throw new ConflictException('Staff actor is not active');

      const shiftId = `shift-${randomUUID()}`;

      const inserted = await c.query(
        `INSERT INTO shift_assignments (
           shift_id, staff_actor_id, shift_date, shift_type, start_time, end_time,
           status, assigned_by, assigned_by_role, notes, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, 'SCHEDULED', $7, $8, $9, now(), now()
         ) RETURNING *`,
        [shiftId, staffActorId, shiftDate, shiftType, startTime, endTime, a.actorId, a.actorRole, notes],
      );

      const row = inserted.rows[0];

      await c.query(
        `INSERT INTO shift_audit (
           audit_id, shift_id, event_type, actor_id, actor_role, previous_state, new_state, created_at
         ) VALUES (
           $1, $2, 'SHIFT_SCHEDULED', $3, $4, NULL, $5::jsonb, now()
         )`,
        [
          randomUUID(),
          shiftId,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            shiftId: row.shift_id,
            staffActorId: row.staff_actor_id,
            shiftDate: row.shift_date,
            shiftType: row.shift_type,
            status: row.status,
          }),
        ],
      );

      return this.mapShiftDto(row);
    });
  }

  async autoCompletePastShifts(a?: Actor) {
    const res = await this.db.query(
      `UPDATE shift_assignments
       SET status = 'COMPLETED',
           actual_checkout_at = COALESCE(actual_checkout_at, end_time),
           notes = CASE
             WHEN notes IS NULL OR notes = '' THEN 'Ca trực đã hoàn thành theo lịch'
             WHEN notes NOT LIKE '%[Đã kết thúc ca theo giờ trực]%' THEN notes || ' [Đã kết thúc ca theo giờ trực]'
             ELSE notes
           END,
           updated_at = now()
       WHERE end_time < now()
         AND status IN ('IN_PROGRESS', 'SCHEDULED')
       RETURNING shift_id`
    );
    return { updatedCount: res.rowCount || 0 };
  }

  async listShifts(a: Actor, query: any = {}) {
    await this.auth(a);
    await this.autoCompletePastShifts(a);
    const p = this.page(query?.limit, query?.offset);
    const params: any[] = [];
    const wheres: string[] = [];

    // Enforcement: Non-management staff can only see their own assigned shifts
    if (!MGMT_ROLES.has(a.actorRole)) {
      params.push(a.actorId);
      wheres.push(`s.staff_actor_id = $${params.length}`);
    } else if (query?.staffActorId) {
      params.push(String(query.staffActorId).trim());
      wheres.push(`s.staff_actor_id = $${params.length}`);
    }
    if (query?.shiftDate) {
      params.push(String(query.shiftDate).trim());
      wheres.push(`s.shift_date = $${params.length}`);
    }
    if (query?.status) {
      params.push(String(query.status).trim().toUpperCase());
      wheres.push(`s.status = $${params.length}`);
    }
    if (query?.shiftType) {
      params.push(String(query.shiftType).trim().toUpperCase());
      wheres.push(`s.shift_type = $${params.length}`);
    }

    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    params.push(p.limit, p.offset);

    const q = await this.db.query(
      `SELECT s.*, sa.display_name AS "staffName", sa.staff_code AS "staffCode",
              sa.primary_operational_role AS "staffRole",
              COUNT(*) OVER()::int AS "totalCount"
       FROM shift_assignments s
       JOIN staff_actors sa ON sa.actor_id = s.staff_actor_id
       ${whereSql}
       ORDER BY s.shift_date DESC, s.start_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      items: q.rows.map(x => this.mapShiftDto(x)),
      total: q.rows[0]?.totalCount ?? 0,
      limit: p.limit,
      offset: p.offset,
    };
  }

  async getShift(a: Actor, id?: string) {
    await this.auth(a);
    const shiftId = this.req(id, 'shiftId');

    const q = await this.db.query(
      `SELECT s.*, sa.display_name AS "staffName", sa.staff_code AS "staffCode",
              sa.primary_operational_role AS "staffRole"
       FROM shift_assignments s
       JOIN staff_actors sa ON sa.actor_id = s.staff_actor_id
       WHERE s.shift_id = $1 LIMIT 1`,
      [shiftId],
    );
    if (q.rowCount !== 1) throw new NotFoundException('Shift not found');

    const handoverQ = await this.db.query(
      `SELECT h.*, f.display_name AS "fromStaffName", t.display_name AS "toStaffName"
       FROM shift_handovers h
       JOIN staff_actors f ON f.actor_id = h.from_actor_id
       LEFT JOIN staff_actors t ON t.actor_id = h.to_actor_id
       WHERE h.shift_id = $1
       ORDER BY h.created_at DESC`,
      [shiftId],
    );

    const auditQ = await this.db.query(
      `SELECT audit_id "auditId", event_type "eventType", actor_id "actorId",
              actor_role "actorRole", previous_state "previousState",
              new_state "newState", created_at "createdAt"
       FROM shift_audit
       WHERE shift_id = $1
       ORDER BY created_at ASC`,
      [shiftId],
    );

    const dto = this.mapShiftDto(q.rows[0]);
    return {
      ...dto,
      handovers: handoverQ.rows.map(h => this.mapHandoverDto(h)),
      auditHistory: auditQ.rows,
    };
  }

  async checkinShift(a: Actor, id?: string) {
    await this.auth(a);
    const shiftId = this.req(id, 'shiftId');

    return this.db.withTransaction(async c => {
      const q = await c.query(
        `SELECT * FROM shift_assignments WHERE shift_id = $1 FOR UPDATE`,
        [shiftId],
      );
      if (q.rowCount !== 1) throw new NotFoundException('Shift not found');
      const old = q.rows[0];

      if (old.staff_actor_id !== a.actorId && !MGMT_ROLES.has(a.actorRole)) {
        throw new ForbiddenException('You can only check into your own assigned shift');
      }

      if (old.status !== 'SCHEDULED') {
        throw new ConflictException(`Cannot check in to shift with status ${old.status}`);
      }

      const updated = await c.query(
        `UPDATE shift_assignments
         SET status = 'IN_PROGRESS',
             actual_checkin_at = now(),
             updated_at = now()
         WHERE shift_id = $1
         RETURNING *`,
        [shiftId],
      );

      const next = updated.rows[0];

      await c.query(
        `INSERT INTO shift_audit (
           audit_id, shift_id, event_type, actor_id, actor_role, previous_state, new_state, created_at
         ) VALUES (
           $1, $2, 'SHIFT_CHECKIN', $3, $4, $5::jsonb, $6::jsonb, now()
         )`,
        [
          randomUUID(),
          shiftId,
          a.actorId,
          a.actorRole,
          JSON.stringify({ status: old.status, actualCheckinAt: old.actual_checkin_at }),
          JSON.stringify({ status: next.status, actualCheckinAt: next.actual_checkin_at }),
        ],
      );

      return this.mapShiftDto(next);
    });
  }

  async checkoutShift(a: Actor, id?: string, body: any = {}) {
    await this.auth(a);
    const shiftId = this.req(id, 'shiftId');

    return this.db.withTransaction(async c => {
      const q = await c.query(
        `SELECT * FROM shift_assignments WHERE shift_id = $1 FOR UPDATE`,
        [shiftId],
      );
      if (q.rowCount !== 1) throw new NotFoundException('Shift not found');
      const old = q.rows[0];

      if (old.staff_actor_id !== a.actorId && !MGMT_ROLES.has(a.actorRole)) {
        throw new ForbiddenException('You can only check out of your own assigned shift');
      }

      if (old.status === 'COMPLETED' || old.status === 'CANCELLED') {
        throw new ConflictException(`Cannot check out of shift with status ${old.status}`);
      }

      const notes = body?.notes ? `${old.notes ? old.notes + ' | ' : ''}${String(body.notes).trim()}` : old.notes;

      const updated = await c.query(
        `UPDATE shift_assignments
         SET status = 'COMPLETED',
             actual_checkout_at = now(),
             notes = $2,
             updated_at = now()
         WHERE shift_id = $1
         RETURNING *`,
        [shiftId, notes],
      );

      const next = updated.rows[0];

      await c.query(
        `INSERT INTO shift_audit (
           audit_id, shift_id, event_type, actor_id, actor_role, previous_state, new_state, created_at
         ) VALUES (
           $1, $2, 'SHIFT_CHECKOUT', $3, $4, $5::jsonb, $6::jsonb, now()
         )`,
        [
          randomUUID(),
          shiftId,
          a.actorId,
          a.actorRole,
          JSON.stringify({ status: old.status, actualCheckoutAt: old.actual_checkout_at }),
          JSON.stringify({ status: next.status, actualCheckoutAt: next.actual_checkout_at }),
        ],
      );

      return this.mapShiftDto(next);
    });
  }

  async submitHandover(a: Actor, id?: string, body: any = {}) {
    await this.auth(a);
    const shiftId = this.req(id, 'shiftId');
    const summaryNote = this.req(body?.summaryNote, 'summaryNote');
    const criticalAlerts = Array.isArray(body?.criticalAlerts) ? body.criticalAlerts : [];
    const toActorId = body?.toActorId ? String(body.toActorId).trim() : null;

    return this.db.withTransaction(async c => {
      const sq = await c.query(
        `SELECT * FROM shift_assignments WHERE shift_id = $1 FOR UPDATE`,
        [shiftId],
      );
      if (sq.rowCount !== 1) throw new NotFoundException('Shift not found');

      if (toActorId) {
        const toCheck = await c.query(
          `SELECT actor_id, status FROM staff_actors WHERE actor_id = $1`,
          [toActorId],
        );
        if (toCheck.rowCount !== 1 || toCheck.rows[0].status !== 'ACTIVE') {
          throw new BadRequestException('Recipient staff actor must be active');
        }
      }

      const handoverId = `handover-${randomUUID()}`;

      const inserted = await c.query(
        `INSERT INTO shift_handovers (
           handover_id, shift_id, from_actor_id, to_actor_id, summary_note,
           critical_alerts, status, submitted_at, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb, 'SUBMITTED', now(), now(), now()
         ) RETURNING *`,
        [handoverId, shiftId, a.actorId, toActorId, summaryNote, JSON.stringify(criticalAlerts)],
      );

      const row = inserted.rows[0];

      await c.query(
        `INSERT INTO shift_audit (
           audit_id, shift_id, event_type, actor_id, actor_role, previous_state, new_state, created_at
         ) VALUES (
           $1, $2, 'HANDOVER_SUBMITTED', $3, $4, NULL, $5::jsonb, now()
         )`,
        [
          randomUUID(),
          shiftId,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            handoverId: row.handover_id,
            fromActorId: row.from_actor_id,
            toActorId: row.to_actor_id,
            status: row.status,
          }),
        ],
      );

      return this.mapHandoverDto(row);
    });
  }

  async acknowledgeHandover(a: Actor, handoverId?: string) {
    await this.auth(a);
    const hid = this.req(handoverId, 'handoverId');

    return this.db.withTransaction(async c => {
      const hq = await c.query(
        `SELECT * FROM shift_handovers WHERE handover_id = $1 FOR UPDATE`,
        [hid],
      );
      if (hq.rowCount !== 1) throw new NotFoundException('Shift handover not found');
      const old = hq.rows[0];

      if (old.status === 'ACKNOWLEDGED') {
        throw new ConflictException('Handover is already acknowledged');
      }

      const updated = await c.query(
        `UPDATE shift_handovers
         SET status = 'ACKNOWLEDGED',
             to_actor_id = COALESCE(to_actor_id, $2),
             acknowledged_at = now(),
             updated_at = now()
         WHERE handover_id = $1
         RETURNING *`,
        [hid, a.actorId],
      );

      const next = updated.rows[0];

      await c.query(
        `INSERT INTO shift_audit (
           audit_id, shift_id, event_type, actor_id, actor_role, previous_state, new_state, created_at
         ) VALUES (
           $1, $2, 'HANDOVER_ACKNOWLEDGED', $3, $4, $5::jsonb, $6::jsonb, now()
         )`,
        [
          randomUUID(),
          old.shift_id,
          a.actorId,
          a.actorRole,
          JSON.stringify({ status: old.status }),
          JSON.stringify({ status: next.status, acknowledgedBy: a.actorId }),
        ],
      );

      return this.mapHandoverDto(next);
    });
  }

  async cancelShift(a: Actor, id?: string, body: any = {}) {
    await this.auth(a, MGMT_ROLES);
    const shiftId = this.req(id, 'shiftId');
    const reason = this.req(body?.reason, 'reason');

    return this.db.withTransaction(async c => {
      const q = await c.query(
        `SELECT * FROM shift_assignments WHERE shift_id = $1 FOR UPDATE`,
        [shiftId],
      );
      if (q.rowCount !== 1) throw new NotFoundException('Shift not found');
      const old = q.rows[0];

      if (old.status === 'COMPLETED' || old.status === 'CANCELLED') {
        throw new ConflictException(`Cannot cancel shift with status ${old.status}`);
      }

      const notes = `${old.notes ? old.notes + ' | ' : ''}CANCELLED: ${reason}`;

      const updated = await c.query(
        `UPDATE shift_assignments
         SET status = 'CANCELLED',
             notes = $2,
             updated_at = now()
         WHERE shift_id = $1
         RETURNING *`,
        [shiftId, notes],
      );

      const next = updated.rows[0];

      await c.query(
        `INSERT INTO shift_audit (
           audit_id, shift_id, event_type, actor_id, actor_role, previous_state, new_state, created_at
         ) VALUES (
           $1, $2, 'SHIFT_CANCELLED', $3, $4, $5::jsonb, $6::jsonb, now()
         )`,
        [
          randomUUID(),
          shiftId,
          a.actorId,
          a.actorRole,
          JSON.stringify({ status: old.status }),
          JSON.stringify({ status: next.status, reason }),
        ],
      );

      return this.mapShiftDto(next);
    });
  }

  private mapShiftDto(r: any) {
    return {
      shiftId: r.shift_id,
      staffActorId: r.staff_actor_id,
      staffName: r.staffName,
      staffCode: r.staffCode,
      staffRole: r.staffRole,
      shiftDate: typeof r.shift_date === 'string' ? r.shift_date : r.shift_date?.toISOString?.()?.slice(0, 10),
      shiftType: r.shift_type,
      startTime: r.start_time,
      endTime: r.end_time,
      actualCheckinAt: r.actual_checkin_at,
      actualCheckoutAt: r.actual_checkout_at,
      status: r.status,
      assignedBy: r.assigned_by,
      assignedByRole: r.assigned_by_role,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapHandoverDto(r: any) {
    return {
      handoverId: r.handover_id,
      shiftId: r.shift_id,
      fromActorId: r.from_actor_id,
      fromStaffName: r.fromStaffName,
      toActorId: r.to_actor_id,
      toStaffName: r.toStaffName,
      summaryNote: r.summary_note,
      criticalAlerts: r.critical_alerts,
      status: r.status,
      submittedAt: r.submitted_at,
      acknowledgedAt: r.acknowledged_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async requestShiftSwap(a: Actor, body: any = {}) {
    await this.auth(a);
    const originalShiftId = this.req(body?.originalShiftId, 'originalShiftId');
    const reason = this.req(body?.reason, 'reason');
    const targetActorId = body?.targetActorId ? String(body.targetActorId).trim() : null;
    const targetShiftId = body?.targetShiftId ? String(body.targetShiftId).trim() : null;

    const sq = await this.db.query(
      `SELECT * FROM shift_assignments WHERE shift_id = $1`,
      [originalShiftId],
    );
    if (sq.rowCount !== 1) throw new NotFoundException('Shift not found');
    const shift = sq.rows[0];

    if (shift.staff_actor_id !== a.actorId && !MGMT_ROLES.has(a.actorRole)) {
      throw new ForbiddenException('Chỉ có thể gửi đề nghị đổi ca của chính mình');
    }

    if (shift.status !== 'SCHEDULED') {
      throw new ConflictException(`Chỉ có thể đề nghị đổi ca ở trạng thái Đã phân ca (hiện tại: ${shift.status})`);
    }

    const swapRequestId = `swap-${randomUUID()}`;

    const res = await this.db.query(
      `INSERT INTO shift_swap_requests (
         swap_request_id, requester_actor_id, original_shift_id,
         target_actor_id, target_shift_id, reason, status, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, 'PENDING', now(), now()
       ) RETURNING *`,
      [swapRequestId, a.actorId, originalShiftId, targetActorId, targetShiftId, reason],
    );

    return res.rows[0];
  }

  async listSwapRequests(a: Actor, query: any = {}) {
    await this.auth(a);
    const status = query?.status ? String(query.status).trim().toUpperCase() : null;
    const params: any[] = [];
    const wheres: string[] = [];

    if (!MGMT_ROLES.has(a.actorRole)) {
      params.push(a.actorId);
      wheres.push(`(r.requester_actor_id = $${params.length} OR r.target_actor_id = $${params.length})`);
    }
    if (status && status !== 'ALL') {
      params.push(status);
      wheres.push(`r.status = $${params.length}`);
    }

    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

    const q = await this.db.query(
      `SELECT r.*,
              req.display_name AS "requesterName", req.staff_code AS "requesterCode", req.primary_operational_role AS "requesterRole",
              tgt.display_name AS "targetName", tgt.staff_code AS "targetCode", tgt.primary_operational_role AS "targetRole",
              appr.display_name AS "approverName",
              s1.shift_date AS "originalShiftDate", s1.shift_type AS "originalShiftType", s1.start_time AS "originalStartTime", s1.end_time AS "originalEndTime",
              s2.shift_date AS "targetShiftDate", s2.shift_type AS "targetShiftType", s2.start_time AS "targetStartTime", s2.end_time AS "targetEndTime"
       FROM shift_swap_requests r
       JOIN staff_actors req ON req.actor_id = r.requester_actor_id
       LEFT JOIN staff_actors tgt ON tgt.actor_id = r.target_actor_id
       LEFT JOIN staff_actors appr ON appr.actor_id = r.approved_by
       JOIN shift_assignments s1 ON s1.shift_id = r.original_shift_id
       LEFT JOIN shift_assignments s2 ON s2.shift_id = r.target_shift_id
       ${whereSql}
       ORDER BY r.created_at DESC`,
      params,
    );

    return q.rows;
  }

  async approveSwapRequest(a: Actor, swapRequestId: string, body: any = {}) {
    await this.auth(a, MGMT_ROLES);
    const notes = body?.notes ? String(body.notes).trim() : '';

    return this.db.withTransaction(async c => {
      const q = await c.query(
        `SELECT * FROM shift_swap_requests WHERE swap_request_id = $1 FOR UPDATE`,
        [swapRequestId],
      );
      if (q.rowCount !== 1) throw new NotFoundException('Đề nghị đổi ca không tồn tại');
      const swap = q.rows[0];

      if (swap.status !== 'PENDING') {
        throw new ConflictException(`Đề nghị đổi ca đã ở trạng thái ${swap.status}`);
      }

      // 1. Update original shift
      if (swap.target_actor_id) {
        await c.query(
          `UPDATE shift_assignments
           SET staff_actor_id = $1,
               notes = COALESCE(notes, '') || ' [Đã đổi ca cho ' || $2 || ' theo phê duyệt]',
               updated_at = now()
           WHERE shift_id = $3`,
          [swap.target_actor_id, swap.requester_actor_id, swap.original_shift_id],
        );
      }

      // 2. If target shift exists, assign to requester
      if (swap.target_shift_id) {
        await c.query(
          `UPDATE shift_assignments
           SET staff_actor_id = $1,
               notes = COALESCE(notes, '') || ' [Đã nhận đổi ca từ ' || $2 || ' theo phê duyệt]',
               updated_at = now()
           WHERE shift_id = $3`,
          [swap.requester_actor_id, swap.target_actor_id, swap.target_shift_id],
        );
      }

      // 3. Update swap request
      const updated = await c.query(
        `UPDATE shift_swap_requests
         SET status = 'APPROVED',
             approved_by = $1,
             approved_by_role = $2,
             updated_at = now()
         WHERE swap_request_id = $3
         RETURNING *`,
        [a.actorId, a.actorRole, swapRequestId],
      );

      // 4. Audit
      await c.query(
        `INSERT INTO shift_audit (
           audit_id, shift_id, event_type, actor_id, actor_role, previous_state, new_state, created_at
         ) VALUES (
           $1, $2, 'SHIFT_CANCELLED', $3, $4, NULL, $5::jsonb, now()
         )`,
        [
          randomUUID(),
          swap.original_shift_id,
          a.actorId,
          a.actorRole,
          JSON.stringify({ swapRequestId, approvedBy: a.actorId, targetActorId: swap.target_actor_id, notes }),
        ],
      );

      return updated.rows[0];
    });
  }

  async rejectSwapRequest(a: Actor, swapRequestId: string, body: any = {}) {
    await this.auth(a, MGMT_ROLES);
    const rejectionReason = this.req(body?.rejectionReason, 'rejectionReason');

    const updated = await this.db.query(
      `UPDATE shift_swap_requests
       SET status = 'REJECTED',
           approved_by = $1,
           approved_by_role = $2,
           rejection_reason = $3,
           updated_at = now()
       WHERE swap_request_id = $4 AND status = 'PENDING'
       RETURNING *`,
      [a.actorId, a.actorRole, rejectionReason, swapRequestId],
    );

    if (updated.rowCount !== 1) {
      throw new NotFoundException('Đề nghị đổi ca không tìm thấy hoặc đã được xử lý');
    }

    return updated.rows[0];
  }

  async createRecognition(a: Actor, body: any = {}) {
    await this.auth(a, MGMT_ROLES);
    const staffActorId = this.req(body?.staffActorId, 'staffActorId');
    const title = this.req(body?.title, 'title');
    const description = this.req(body?.description, 'description');
    const recognitionType = body?.recognitionType ? String(body.recognitionType).toUpperCase() : 'COMMENDATION';
    const kpiBonusPoints = Number(body?.kpiBonusPoints) || 10;
    const awardedDate = body?.awardedDate ? String(body.awardedDate).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const recognitionId = `recog-${randomUUID()}`;

    const res = await this.db.query(
      `INSERT INTO staff_recognitions (
         recognition_id, staff_actor_id, recognition_type, title, description,
         kpi_bonus_points, awarded_by, awarded_by_role, awarded_date, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, now()
       ) RETURNING *`,
      [recognitionId, staffActorId, recognitionType, title, description, kpiBonusPoints, a.actorId, a.actorRole, awardedDate],
    );

    return res.rows[0];
  }

  async listRecognitions(a: Actor, query: any = {}) {
    await this.auth(a);
    const staffActorId = query?.staffActorId ? String(query.staffActorId).trim() : null;
    const params: any[] = [];
    const wheres: string[] = [];

    if (staffActorId) {
      params.push(staffActorId);
      wheres.push(`r.staff_actor_id = $${params.length}`);
    }

    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

    const q = await this.db.query(
      `SELECT r.*,
              s.display_name AS "staffName", s.staff_code AS "staffCode", s.primary_operational_role AS "staffRole",
              a.display_name AS "awardedByName"
       FROM staff_recognitions r
       JOIN staff_actors s ON s.actor_id = r.staff_actor_id
       JOIN staff_actors a ON a.actor_id = r.awarded_by
       ${whereSql}
       ORDER BY r.awarded_date DESC, r.created_at DESC`,
      params,
    );

    return q.rows;
  }

  async getWorkforceKpiSummary(a: Actor, query: any = {}) {
    await this.auth(a);

    // Grouped KPI by Primary Operational Role
    const teamStatsQ = await this.db.query(`
      SELECT
        sa.primary_operational_role AS role,
        COUNT(DISTINCT sa.actor_id)::int AS "totalStaff",
        COUNT(s.shift_id)::int AS "totalShifts",
        COUNT(CASE WHEN s.status = 'COMPLETED' THEN 1 END)::int AS "completedShifts",
        COUNT(CASE WHEN s.status = 'IN_PROGRESS' THEN 1 END)::int AS "inProgressShifts",
        COUNT(CASE WHEN s.status = 'ABSENT' THEN 1 END)::int AS "absentShifts",
        COALESCE(SUM(
          CASE
            WHEN s.status = 'COMPLETED' AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0, 1)
            ELSE 0
          END
        ), 0)::float AS "totalHoursWorked",
        COUNT(DISTINCT sw.swap_request_id)::int AS "swapCount",
        COALESCE(SUM(rec.kpi_bonus_points), 0)::int AS "bonusPoints"
      FROM staff_actors sa
      LEFT JOIN shift_assignments s ON s.staff_actor_id = sa.actor_id
      LEFT JOIN shift_swap_requests sw ON (sw.requester_actor_id = sa.actor_id AND sw.status = 'APPROVED')
      LEFT JOIN staff_recognitions rec ON rec.staff_actor_id = sa.actor_id
      WHERE sa.status = 'ACTIVE'
      GROUP BY sa.primary_operational_role
      ORDER BY "totalShifts" DESC, "totalStaff" DESC
    `);

    // Individual staff performance
    const staffStatsQ = await this.db.query(`
      SELECT
        sa.actor_id AS "actorId",
        sa.staff_code AS "staffCode",
        sa.display_name AS "displayName",
        sa.primary_operational_role AS "role",
        COUNT(s.shift_id)::int AS "totalShifts",
        COUNT(CASE WHEN s.status = 'COMPLETED' THEN 1 END)::int AS "completedShifts",
        COUNT(CASE WHEN s.status = 'IN_PROGRESS' THEN 1 END)::int AS "inProgressShifts",
        COUNT(CASE WHEN s.status = 'ABSENT' THEN 1 END)::int AS "absentShifts",
        COALESCE(SUM(
          CASE
            WHEN s.status = 'COMPLETED' AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0, 1)
            ELSE 0
          END
        ), 0)::float AS "hoursWorked",
        COUNT(DISTINCT sw.swap_request_id)::int AS "swapsCount",
        COALESCE(SUM(rec.kpi_bonus_points), 0)::int AS "bonusPoints",
        COUNT(rec.recognition_id)::int AS "recognitionCount"
      FROM staff_actors sa
      LEFT JOIN shift_assignments s ON s.staff_actor_id = sa.actor_id
      LEFT JOIN shift_swap_requests sw ON (sw.requester_actor_id = sa.actor_id AND sw.status = 'APPROVED')
      LEFT JOIN staff_recognitions rec ON rec.staff_actor_id = sa.actor_id
      WHERE sa.status = 'ACTIVE'
      GROUP BY sa.actor_id, sa.staff_code, sa.display_name, sa.primary_operational_role
      ORDER BY "completedShifts" DESC, "hoursWorked" DESC
    `);

    return {
      teams: teamStatsQ.rows.map(t => {
        const completionRate = t.totalShifts > 0 ? Math.round((t.completedShifts / t.totalShifts) * 100) : 100;
        const kpiScore = Math.min(100, Math.max(0, Math.round(completionRate * 0.7 + (t.bonusPoints > 0 ? Math.min(30, t.bonusPoints) : 0))));
        return {
          ...t,
          completionRate,
          kpiScore,
        };
      }),
      staff: staffStatsQ.rows.map(s => {
        const completionRate = s.totalShifts > 0 ? Math.round((s.completedShifts / s.totalShifts) * 100) : 100;
        const kpiScore = Math.min(100, Math.max(0, Math.round(completionRate * 0.7 + (s.bonusPoints > 0 ? Math.min(30, s.bonusPoints) : 0))));
        return {
          ...s,
          completionRate,
          kpiScore,
        };
      }),
    };
  }
}
