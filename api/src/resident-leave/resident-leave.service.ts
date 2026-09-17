import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

type Actor = { actorId: string; actorRole: string };
const HUMAN_ROLES = new Set(['CAREGIVER', 'NURSE', 'CARE_MANAGER', 'SUPERVISOR']);
const MGMT_ROLES = new Set(['NURSE', 'CARE_MANAGER', 'SUPERVISOR']);
const ALL_STAFF_ROLES = new Set([
  'CAREGIVER', 'NURSE', 'CARE_MANAGER', 'SUPERVISOR', 'NUTRITIONIST',
  'SOCIAL_WORKER', 'PSYCHOLOGIST', 'REHABILITATION_SPECIALIST',
  'HOUSEKEEPING', 'SECURITY', 'ACCOUNTANT', 'RECEPTIONIST', 'ADMIN'
]);
const STAFF_LEAVE_APPROVER_ROLES = new Set(['CARE_MANAGER', 'SUPERVISOR', 'ADMIN']);
const VALID_LEAVE_TYPES = new Set(['FAMILY_VISIT', 'MEDICAL_OUTING', 'TEMPORARY_HOSPITALIZATION', 'VACATION', 'OTHER']);
const VALID_STAFF_LEAVE_TYPES = new Set(['ANNUAL', 'PERSONAL', 'SICK', 'UNPAID', 'OTHER']);

@Injectable()
export class ResidentLeaveService {
  constructor(private readonly db: DatabaseService) {}

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

  async createLeaveRequest(a: Actor, body: any = {}) {
    await this.auth(a, MGMT_ROLES);

    const residentId = this.req(body?.residentId, 'residentId');
    const leaveType = this.req(body?.leaveType, 'leaveType').toUpperCase();
    if (!VALID_LEAVE_TYPES.has(leaveType)) {
      throw new BadRequestException(`leaveType must be one of: ${Array.from(VALID_LEAVE_TYPES).join(', ')}`);
    }

    const startDateStr = this.req(body?.startDate, 'startDate');
    const expectedEndDateStr = this.req(body?.expectedEndDate, 'expectedEndDate');
    const startDate = new Date(startDateStr);
    const expectedEndDate = new Date(expectedEndDateStr);

    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('startDate is invalid');
    if (Number.isNaN(expectedEndDate.getTime())) throw new BadRequestException('expectedEndDate is invalid');
    if (expectedEndDate < startDate) {
      throw new BadRequestException('expectedEndDate cannot be before startDate');
    }

    const noticeSubmittedAt = body?.noticeSubmittedAt ? new Date(body.noticeSubmittedAt) : new Date();
    if (Number.isNaN(noticeSubmittedAt.getTime())) {
      throw new BadRequestException('noticeSubmittedAt is invalid');
    }

    const reportedBy = this.req(body?.reportedBy, 'reportedBy');
    const reporterRelationship = this.req(body?.reporterRelationship, 'reporterRelationship');
    const note = String(body?.note ?? '').trim() || null;

    // RLA-BR-01 Notice & Deduction Math
    const diffMs = startDate.getTime() - noticeSubmittedAt.getTime();
    const noticeHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    const isAdvanceNotice48h = noticeHours >= 48.0;
    const firstDayChargeable = !isAdvanceNotice48h;
    const subsequentDaysConfirmed = isAdvanceNotice48h; // If >=48h advance notice, whole period is pre-eligible
    const mealDeductionEligible = isAdvanceNotice48h;

    return this.db.withTransaction(async c => {
      const rq = await c.query(
        `SELECT resident_id, display_name, active_status FROM residents WHERE resident_id = $1 FOR UPDATE`,
        [residentId],
      );
      if (rq.rowCount !== 1) throw new NotFoundException('Resident not found');
      if (!rq.rows[0].active_status) throw new ConflictException('Resident is not active');

      const leaveRequestId = `rla-${randomUUID()}`;

      const inserted = await c.query(
        `INSERT INTO resident_leave_requests (
           leave_request_id, resident_id, leave_type, start_date, expected_end_date,
           notice_submitted_at, notice_hours, is_advance_notice_48h, first_day_chargeable,
           subsequent_days_confirmed, meal_deduction_eligible, status, reported_by,
           reporter_relationship, recorded_by, recorded_by_role, note, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'REGISTERED', $12, $13, $14, $15, $16, now(), now()
         ) RETURNING *`,
        [
          leaveRequestId, residentId, leaveType, startDate, expectedEndDate,
          noticeSubmittedAt, noticeHours, isAdvanceNotice48h, firstDayChargeable,
          subsequentDaysConfirmed, mealDeductionEligible, reportedBy,
          reporterRelationship, a.actorId, a.actorRole, note,
        ],
      );

      const row = inserted.rows[0];

      await c.query(
        `INSERT INTO resident_leave_audit (
           audit_id, leave_request_id, resident_id, event_type, actor_id, actor_role,
           previous_state, new_state, created_at
         ) VALUES (
           $1, $2, $3, 'LEAVE_REGISTERED', $4, $5, NULL, $6::jsonb, now()
         )`,
        [
          randomUUID(),
          leaveRequestId,
          residentId,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            leaveRequestId: row.leave_request_id,
            residentId: row.resident_id,
            status: row.status,
            leaveType: row.leave_type,
            noticeHours: row.notice_hours,
            isAdvanceNotice48h: row.is_advance_notice_48h,
            firstDayChargeable: row.first_day_chargeable,
            subsequentDaysConfirmed: row.subsequent_days_confirmed,
            mealDeductionEligible: row.meal_deduction_eligible,
          }),
        ],
      );

      return this.mapDto(row);
    });
  }

  async listLeaveRequests(a: Actor, query: any = {}) {
    await this.auth(a);
    const p = this.page(query?.limit, query?.offset);
    const params: any[] = [];
    const wheres: string[] = [];

    if (query?.residentId) {
      params.push(String(query.residentId).trim());
      wheres.push(`r.resident_id = $${params.length}`);
    }
    if (query?.status) {
      params.push(String(query.status).trim().toUpperCase());
      wheres.push(`r.status = $${params.length}`);
    }

    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    params.push(p.limit, p.offset);

    const q = await this.db.query(
      `SELECT r.*, res.display_name AS "residentName", res.resident_code AS "residentCode",
              COUNT(*) OVER()::int AS "totalCount"
       FROM resident_leave_requests r
       JOIN residents res ON res.resident_id = r.resident_id
       ${whereSql}
       ORDER BY r.start_date DESC, r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      items: q.rows.map(x => this.mapDto(x)),
      total: q.rows[0]?.totalCount ?? 0,
      limit: p.limit,
      offset: p.offset,
    };
  }

  async getLeaveRequest(a: Actor, id?: string) {
    await this.auth(a);
    const leaveRequestId = this.req(id, 'leaveRequestId');

    const q = await this.db.query(
      `SELECT r.*, res.display_name AS "residentName", res.resident_code AS "residentCode"
       FROM resident_leave_requests r
       JOIN residents res ON res.resident_id = r.resident_id
       WHERE r.leave_request_id = $1 LIMIT 1`,
      [leaveRequestId],
    );
    if (q.rowCount !== 1) throw new NotFoundException('Leave request not found');

    const auditQ = await this.db.query(
      `SELECT audit_id "auditId", event_type "eventType", actor_id "actorId",
              actor_role "actorRole", previous_state "previousState",
              new_state "newState", created_at "createdAt"
       FROM resident_leave_audit
       WHERE leave_request_id = $1
       ORDER BY created_at ASC`,
      [leaveRequestId],
    );

    const dto = this.mapDto(q.rows[0]);
    return { ...dto, auditHistory: auditQ.rows };
  }

  async confirmSubsequentDays(a: Actor, id?: string, body: any = {}) {
    await this.auth(a, MGMT_ROLES);
    const leaveRequestId = this.req(id, 'leaveRequestId');

    return this.db.withTransaction(async c => {
      const q = await c.query(
        `SELECT * FROM resident_leave_requests WHERE leave_request_id = $1 FOR UPDATE`,
        [leaveRequestId],
      );
      if (q.rowCount !== 1) throw new NotFoundException('Leave request not found');
      const old = q.rows[0];

      if (old.status === 'RETURNED' || old.status === 'CANCELLED') {
        throw new ConflictException(`Cannot confirm subsequent days for leave with status ${old.status}`);
      }

      const note = body?.note ? String(body.note).trim() : old.note;

      const updated = await c.query(
        `UPDATE resident_leave_requests
         SET subsequent_days_confirmed = true,
             meal_deduction_eligible = true,
             note = $2,
             updated_at = now()
         WHERE leave_request_id = $1
         RETURNING *`,
        [leaveRequestId, note],
      );

      const next = updated.rows[0];

      await c.query(
        `INSERT INTO resident_leave_audit (
           audit_id, leave_request_id, resident_id, event_type, actor_id, actor_role,
           previous_state, new_state, created_at
         ) VALUES (
           $1, $2, $3, 'LEAVE_CONFIRMED', $4, $5, $6::jsonb, $7::jsonb, now()
         )`,
        [
          randomUUID(),
          leaveRequestId,
          old.resident_id,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            subsequentDaysConfirmed: old.subsequent_days_confirmed,
            mealDeductionEligible: old.meal_deduction_eligible,
          }),
          JSON.stringify({
            subsequentDaysConfirmed: next.subsequent_days_confirmed,
            mealDeductionEligible: next.meal_deduction_eligible,
          }),
        ],
      );

      return this.mapDto(next);
    });
  }

  async recordReturn(a: Actor, id?: string, body: any = {}) {
    await this.auth(a, MGMT_ROLES);
    const leaveRequestId = this.req(id, 'leaveRequestId');
    const actualEndDate = body?.actualEndDate ? new Date(body.actualEndDate) : new Date();
    if (Number.isNaN(actualEndDate.getTime())) {
      throw new BadRequestException('actualEndDate is invalid');
    }

    return this.db.withTransaction(async c => {
      const q = await c.query(
        `SELECT * FROM resident_leave_requests WHERE leave_request_id = $1 FOR UPDATE`,
        [leaveRequestId],
      );
      if (q.rowCount !== 1) throw new NotFoundException('Leave request not found');
      const old = q.rows[0];

      if (old.status === 'RETURNED' || old.status === 'CANCELLED') {
        throw new ConflictException(`Leave request is already ${old.status}`);
      }

      const note = body?.note ? `${old.note ? old.note + ' | ' : ''}${String(body.note).trim()}` : old.note;

      const updated = await c.query(
        `UPDATE resident_leave_requests
         SET status = 'RETURNED',
             actual_end_date = $2,
             note = $3,
             updated_at = now()
         WHERE leave_request_id = $1
         RETURNING *`,
        [leaveRequestId, actualEndDate, note],
      );

      const next = updated.rows[0];

      await c.query(
        `INSERT INTO resident_leave_audit (
           audit_id, leave_request_id, resident_id, event_type, actor_id, actor_role,
           previous_state, new_state, created_at
         ) VALUES (
           $1, $2, $3, 'LEAVE_RETURNED', $4, $5, $6::jsonb, $7::jsonb, now()
         )`,
        [
          randomUUID(),
          leaveRequestId,
          old.resident_id,
          a.actorId,
          a.actorRole,
          JSON.stringify({ status: old.status, actualEndDate: old.actual_end_date }),
          JSON.stringify({ status: next.status, actualEndDate: next.actual_end_date }),
        ],
      );

      return this.mapDto(next);
    });
  }

  async cancelLeave(a: Actor, id?: string, body: any = {}) {
    await this.auth(a, MGMT_ROLES);
    const leaveRequestId = this.req(id, 'leaveRequestId');
    const reason = this.req(body?.reason, 'reason');

    return this.db.withTransaction(async c => {
      const q = await c.query(
        `SELECT * FROM resident_leave_requests WHERE leave_request_id = $1 FOR UPDATE`,
        [leaveRequestId],
      );
      if (q.rowCount !== 1) throw new NotFoundException('Leave request not found');
      const old = q.rows[0];

      if (old.status === 'RETURNED' || old.status === 'CANCELLED') {
        throw new ConflictException(`Leave request is already ${old.status}`);
      }

      const note = `${old.note ? old.note + ' | ' : ''}CANCELLED: ${reason}`;

      const updated = await c.query(
        `UPDATE resident_leave_requests
         SET status = 'CANCELLED',
             meal_deduction_eligible = false,
             note = $2,
             updated_at = now()
         WHERE leave_request_id = $1
         RETURNING *`,
        [leaveRequestId, note],
      );

      const next = updated.rows[0];

      await c.query(
        `INSERT INTO resident_leave_audit (
           audit_id, leave_request_id, resident_id, event_type, actor_id, actor_role,
           previous_state, new_state, created_at
         ) VALUES (
           $1, $2, $3, 'LEAVE_CANCELLED', $4, $5, $6::jsonb, $7::jsonb, now()
         )`,
        [
          randomUUID(),
          leaveRequestId,
          old.resident_id,
          a.actorId,
          a.actorRole,
          JSON.stringify({ status: old.status }),
          JSON.stringify({ status: next.status, reason }),
        ],
      );

      return this.mapDto(next);
    });
  }

  private mapDto(r: any) {
    return {
      leaveRequestId: r.leave_request_id,
      residentId: r.resident_id,
      residentName: r.residentName,
      residentCode: r.residentCode,
      leaveType: r.leave_type,
      startDate: r.start_date,
      expectedEndDate: r.expected_end_date,
      actualEndDate: r.actual_end_date,
      noticeSubmittedAt: r.notice_submitted_at,
      noticeHours: Number(r.notice_hours),
      isAdvanceNotice48h: Boolean(r.is_advance_notice_48h),
      firstDayChargeable: Boolean(r.first_day_chargeable),
      subsequentDaysConfirmed: Boolean(r.subsequent_days_confirmed),
      mealDeductionEligible: Boolean(r.meal_deduction_eligible),
      status: r.status,
      reportedBy: r.reported_by,
      reporterRelationship: r.reporter_relationship,
      recordedBy: r.recorded_by,
      recordedByRole: r.recorded_by_role,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private tableEnsured = false;
  private async ensureStaffLeaveTable() {
    if (this.tableEnsured) return;
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS staff_leave_requests (
          leave_id TEXT PRIMARY KEY,
          staff_actor_id TEXT NOT NULL REFERENCES staff_actors(actor_id),
          staff_role TEXT NOT NULL,
          leave_type TEXT NOT NULL CHECK (leave_type IN ('ANNUAL', 'PERSONAL', 'SICK', 'UNPAID', 'OTHER')),
          start_date TIMESTAMPTZ NOT NULL,
          end_date TIMESTAMPTZ NOT NULL,
          reason TEXT NOT NULL,
          is_special_case BOOLEAN NOT NULL DEFAULT false,
          special_reason TEXT,
          notice_hours NUMERIC(8,2) NOT NULL,
          is_advance_notice_48h BOOLEAN NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
          reviewed_by TEXT REFERENCES staff_actors(actor_id),
          reviewed_by_role TEXT,
          reviewed_at TIMESTAMPTZ,
          review_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT staff_leave_date_order CHECK (end_date >= start_date)
        );
      `);
      this.tableEnsured = true;
    } catch (e) {
      // ignore table exists or race conditions
    }
  }

  async createStaffLeaveRequest(a: Actor, body: any = {}) {
    await this.ensureStaffLeaveTable();
    await this.auth(a, ALL_STAFF_ROLES);

    const leaveType = this.req(body?.leaveType, 'leaveType').toUpperCase();
    if (!VALID_STAFF_LEAVE_TYPES.has(leaveType)) {
      throw new BadRequestException(`leaveType phải thuộc các loại: ${Array.from(VALID_STAFF_LEAVE_TYPES).join(', ')}`);
    }

    const startDateStr = this.req(body?.startDate, 'startDate');
    const endDateStr = this.req(body?.endDate, 'endDate');
    const reason = this.req(body?.reason, 'reason');
    const isSpecialCase = Boolean(body?.isSpecialCase);
    const specialReason = body?.specialReason ? String(body.specialReason).trim() : null;

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('startDate không hợp lệ');
    if (Number.isNaN(endDate.getTime())) throw new BadRequestException('endDate không hợp lệ');
    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc không được nhỏ hơn ngày bắt đầu');
    }

    const now = new Date();
    const diffMs = startDate.getTime() - now.getTime();
    const noticeHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    const isAdvanceNotice48h = noticeHours >= 48.0;

    if (!isAdvanceNotice48h && !isSpecialCase) {
      throw new BadRequestException(
        'Yêu cầu xin nghỉ phép phải được báo trước ít nhất 2 ngày (48 giờ) trừ trường hợp đặc biệt.',
      );
    }

    if (isSpecialCase && !specialReason) {
      throw new BadRequestException('Vui lòng nhập lý do giải trình cho trường hợp đặc biệt.');
    }

    const leaveId = `slr-${randomUUID()}`;

    const inserted = await this.db.query(
      `INSERT INTO staff_leave_requests (
         leave_id, staff_actor_id, staff_role, leave_type, start_date, end_date,
         reason, is_special_case, special_reason, notice_hours, is_advance_notice_48h,
         status, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING', now(), now()
       ) RETURNING *`,
      [
        leaveId,
        a.actorId,
        a.actorRole,
        leaveType,
        startDate,
        endDate,
        reason,
        isSpecialCase,
        specialReason,
        noticeHours,
        isAdvanceNotice48h,
      ],
    );

    const qStaff = await this.db.query(
      `SELECT display_name AS "staffName", staff_code AS "staffCode" FROM staff_actors WHERE actor_id = $1 LIMIT 1`,
      [a.actorId],
    );

    const row = inserted.rows[0];
    if (qStaff.rows[0]) {
      row.staffName = qStaff.rows[0].staffName;
      row.staffCode = qStaff.rows[0].staffCode;
    }

    return this.mapStaffLeaveDto(row);
  }

  async listStaffLeaveRequests(a: Actor, query: any = {}) {
    await this.ensureStaffLeaveTable();
    await this.auth(a, ALL_STAFF_ROLES);
    const p = this.page(query?.limit, query?.offset);
    const params: any[] = [];
    const wheres: string[] = [];

    const isApprover = STAFF_LEAVE_APPROVER_ROLES.has(a.actorRole);
    if (!isApprover) {
      params.push(a.actorId);
      wheres.push(`s.staff_actor_id = $${params.length}`);
    } else if (query?.staffActorId) {
      params.push(String(query.staffActorId).trim());
      wheres.push(`s.staff_actor_id = $${params.length}`);
    }

    if (query?.status && query.status !== 'ALL') {
      params.push(String(query.status).trim().toUpperCase());
      wheres.push(`s.status = $${params.length}`);
    }

    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    params.push(p.limit, p.offset);

    const q = await this.db.query(
      `SELECT s.*, sa.display_name AS "staffName", sa.staff_code AS "staffCode",
              rev.display_name AS "reviewerName",
              COUNT(*) OVER()::int AS "totalCount"
       FROM staff_leave_requests s
       JOIN staff_actors sa ON sa.actor_id = s.staff_actor_id
       LEFT JOIN staff_actors rev ON rev.actor_id = s.reviewed_by
       ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      items: q.rows.map(x => this.mapStaffLeaveDto(x)),
      total: q.rows[0]?.totalCount ?? 0,
      limit: p.limit,
      offset: p.offset,
    };
  }

  async approveStaffLeaveRequest(a: Actor, id?: string, body: any = {}) {
    await this.ensureStaffLeaveTable();
    await this.auth(a, STAFF_LEAVE_APPROVER_ROLES);
    const leaveId = this.req(id, 'leaveId');

    const q = await this.db.query(`SELECT * FROM staff_leave_requests WHERE leave_id = $1 LIMIT 1`, [leaveId]);
    if (q.rowCount !== 1) throw new NotFoundException('Đơn xin nghỉ phép không tồn tại');
    const old = q.rows[0];

    if (old.status !== 'PENDING') {
      throw new ConflictException(`Đơn xin nghỉ phép đã ở trạng thái ${old.status}, không thể phê duyệt`);
    }

    const reviewNote = body?.reviewNote ? String(body.reviewNote).trim() : null;

    const updated = await this.db.query(
      `UPDATE staff_leave_requests
       SET status = 'APPROVED',
           reviewed_by = $2,
           reviewed_by_role = $3,
           reviewed_at = now(),
           review_note = $4,
           updated_at = now()
       WHERE leave_id = $1
       RETURNING *`,
      [leaveId, a.actorId, a.actorRole, reviewNote],
    );

    const qStaff = await this.db.query(
      `SELECT sa.display_name AS "staffName", sa.staff_code AS "staffCode", rev.display_name AS "reviewerName"
       FROM staff_actors sa
       LEFT JOIN staff_actors rev ON rev.actor_id = $2
       WHERE sa.actor_id = $1 LIMIT 1`,
      [old.staff_actor_id, a.actorId],
    );

    const row = updated.rows[0];
    if (qStaff.rows[0]) {
      row.staffName = qStaff.rows[0].staffName;
      row.staffCode = qStaff.rows[0].staffCode;
      row.reviewerName = qStaff.rows[0].reviewerName;
    }

    return this.mapStaffLeaveDto(row);
  }

  async rejectStaffLeaveRequest(a: Actor, id?: string, body: any = {}) {
    await this.ensureStaffLeaveTable();
    await this.auth(a, STAFF_LEAVE_APPROVER_ROLES);
    const leaveId = this.req(id, 'leaveId');

    const q = await this.db.query(`SELECT * FROM staff_leave_requests WHERE leave_id = $1 LIMIT 1`, [leaveId]);
    if (q.rowCount !== 1) throw new NotFoundException('Đơn xin nghỉ phép không tồn tại');
    const old = q.rows[0];

    if (old.status !== 'PENDING') {
      throw new ConflictException(`Đơn xin nghỉ phép đã ở trạng thái ${old.status}, không thể từ chối`);
    }

    const reviewNote = body?.reviewNote ? String(body.reviewNote).trim() : null;

    const updated = await this.db.query(
      `UPDATE staff_leave_requests
       SET status = 'REJECTED',
           reviewed_by = $2,
           reviewed_by_role = $3,
           reviewed_at = now(),
           review_note = $4,
           updated_at = now()
       WHERE leave_id = $1
       RETURNING *`,
      [leaveId, a.actorId, a.actorRole, reviewNote],
    );

    const qStaff = await this.db.query(
      `SELECT sa.display_name AS "staffName", sa.staff_code AS "staffCode", rev.display_name AS "reviewerName"
       FROM staff_actors sa
       LEFT JOIN staff_actors rev ON rev.actor_id = $2
       WHERE sa.actor_id = $1 LIMIT 1`,
      [old.staff_actor_id, a.actorId],
    );

    const row = updated.rows[0];
    if (qStaff.rows[0]) {
      row.staffName = qStaff.rows[0].staffName;
      row.staffCode = qStaff.rows[0].staffCode;
      row.reviewerName = qStaff.rows[0].reviewerName;
    }

    return this.mapStaffLeaveDto(row);
  }

  async cancelStaffLeaveRequest(a: Actor, id?: string, body: any = {}) {
    await this.ensureStaffLeaveTable();
    await this.auth(a, ALL_STAFF_ROLES);
    const leaveId = this.req(id, 'leaveId');

    const q = await this.db.query(`SELECT * FROM staff_leave_requests WHERE leave_id = $1 LIMIT 1`, [leaveId]);
    if (q.rowCount !== 1) throw new NotFoundException('Đơn xin nghỉ phép không tồn tại');
    const old = q.rows[0];

    const isApprover = STAFF_LEAVE_APPROVER_ROLES.has(a.actorRole);
    if (old.staff_actor_id !== a.actorId && !isApprover) {
      throw new ForbiddenException('Bạn không có quyền hủy đơn của người khác');
    }

    if (old.status === 'CANCELLED') {
      throw new ConflictException('Đơn xin nghỉ phép đã bị hủy trước đó');
    }

    const updated = await this.db.query(
      `UPDATE staff_leave_requests
       SET status = 'CANCELLED',
           updated_at = now()
       WHERE leave_id = $1
       RETURNING *`,
      [leaveId],
    );

    const qStaff = await this.db.query(
      `SELECT sa.display_name AS "staffName", sa.staff_code AS "staffCode" FROM staff_actors sa WHERE sa.actor_id = $1 LIMIT 1`,
      [old.staff_actor_id],
    );

    const row = updated.rows[0];
    if (qStaff.rows[0]) {
      row.staffName = qStaff.rows[0].staffName;
      row.staffCode = qStaff.rows[0].staffCode;
    }

    return this.mapStaffLeaveDto(row);
  }

  private mapStaffLeaveDto(r: any) {
    return {
      leaveId: r.leave_id,
      staffActorId: r.staff_actor_id,
      staffRole: r.staff_role,
      staffName: r.staffName,
      staffCode: r.staffCode,
      leaveType: r.leave_type,
      startDate: r.start_date,
      endDate: r.end_date,
      reason: r.reason,
      isSpecialCase: Boolean(r.is_special_case),
      specialReason: r.special_reason,
      noticeHours: Number(r.notice_hours),
      isAdvanceNotice48h: Boolean(r.is_advance_notice_48h),
      status: r.status,
      reviewedBy: r.reviewed_by,
      reviewedByRole: r.reviewed_by_role,
      reviewerName: r.reviewerName,
      reviewedAt: r.reviewed_at,
      reviewNote: r.review_note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

