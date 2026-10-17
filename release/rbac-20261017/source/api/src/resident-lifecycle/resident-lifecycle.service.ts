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
const HUMAN = new Set(['CAREGIVER', 'NURSE', 'CARE_MANAGER', 'SUPERVISOR']);
const UPDATE = new Set(['NURSE', 'CARE_MANAGER', 'SUPERVISOR']);
const MGMT = new Set(['CARE_MANAGER', 'SUPERVISOR']);

@Injectable()
export class ResidentLifecycleService {
  constructor(private readonly db: DatabaseService) {}

  private req(v: any, n: string) {
    const x = String(v ?? '').trim();
    if (!x) throw new BadRequestException(`${n} is required`);
    return x;
  }

  private page(l?: string, o?: string) {
    const limit = l ? Number(l) : 50;
    const offset = o ? Number(o) : 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('limit must be between 1 and 100');
    if (!Number.isInteger(offset) || offset < 0)
      throw new BadRequestException('offset must be non-negative');
    return { limit, offset };
  }

  private async auth(a: Actor, roles: Set<string> = HUMAN) {
    if (!a.actorId || !a.actorRole)
      throw new UnauthorizedException('Authenticated human actor context is required');
    if (!roles.has(a.actorRole))
      throw new ForbiddenException('Actor role is not authorized');
    const q = await this.db.query(
      `SELECT primary_operational_role,status
       FROM staff_actors WHERE actor_id=$1 LIMIT 1`,
      [a.actorId],
    );
    const x = q.rows[0];
    if (!x || x.status !== 'ACTIVE' || x.primary_operational_role !== a.actorRole)
      throw new ForbiddenException('Canonical active staff actor is required');
  }

  async carePlans(a: Actor, rid?: string, l?: string, o?: string) {
    await this.auth(a);
    const residentId = this.req(rid, 'residentId');
    const p = this.page(l, o);
    const q = await this.db.query(
      `SELECT care_plan_id "carePlanId", resident_id "residentId",
              plan_code "planCode", title, description, status,
              effective_from "effectiveFrom", effective_to "effectiveTo",
              approved_by "approvedBy", approved_by_role "approvedByRole",
              approved_at "approvedAt", created_at "createdAt",
              updated_at "updatedAt", COUNT(*) OVER()::int "totalCount"
       FROM care_plans
       WHERE resident_id=$1
       ORDER BY updated_at DESC, care_plan_id
       LIMIT $2 OFFSET $3`,
      [residentId, p.limit, p.offset],
    );
    return {
      items: q.rows,
      total: q.rows[0]?.totalCount ?? 0,
      limit: p.limit,
      offset: p.offset,
    };
  }

  async updateCarePlan(a: Actor, pid?: string, body: any = {}) {
    await this.auth(a, UPDATE);
    const carePlanId = this.req(pid, 'carePlanId');
    const expectedUpdatedAt = this.req(body?.expectedUpdatedAt, 'expectedUpdatedAt');

    return this.db.withTransaction(async c => {
      const found = await c.query(
        `SELECT * FROM care_plans WHERE care_plan_id=$1 FOR UPDATE`,
        [carePlanId],
      );
      if (found.rowCount !== 1) throw new NotFoundException('Care Plan not found');
      const old = found.rows[0];

      if (!['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(old.status))
        throw new ConflictException('Completed or cancelled Care Plan cannot be updated');

      if (new Date(old.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString())
        throw new ConflictException('Care Plan changed since it was loaded');

      const title =
        body?.title === undefined ? old.title : this.req(body.title, 'title');
      const description =
        body?.description === undefined
          ? old.description
          : String(body.description ?? '').trim() || null;
      const effectiveFrom =
        body?.effectiveFrom === undefined ? old.effective_from : body.effectiveFrom || null;
      const effectiveTo =
        body?.effectiveTo === undefined ? old.effective_to : body.effectiveTo || null;

      const updated = await c.query(
        `UPDATE care_plans
         SET title=$2, description=$3, effective_from=$4,
             effective_to=$5, updated_at=now()
         WHERE care_plan_id=$1
         RETURNING *`,
        [carePlanId, title, description, effectiveFrom, effectiveTo],
      );
      const next = updated.rows[0];

      const seq = await c.query(
        `SELECT COALESCE(MAX(event_sequence),0)+1 AS next_sequence
         FROM care_plan_audit WHERE care_plan_id=$1`,
        [carePlanId],
      );

      await c.query(
        `INSERT INTO care_plan_audit(
           audit_id,event_sequence,care_plan_id,resident_id,event_type,
           actor_id,actor_role,previous_state,new_state,created_at
         ) VALUES($1,$2,$3,$4,'PLAN_UPDATED',$5,$6,$7::jsonb,$8::jsonb,now())`,
        [
          randomUUID(),
          Number(seq.rows[0].next_sequence),
          carePlanId,
          old.resident_id,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            title: old.title,
            description: old.description,
            effectiveFrom: old.effective_from,
            effectiveTo: old.effective_to,
            updatedAt: old.updated_at,
          }),
          JSON.stringify({
            title: next.title,
            description: next.description,
            effectiveFrom: next.effective_from,
            effectiveTo: next.effective_to,
            updatedAt: next.updated_at,
          }),
        ],
      );

      return {
        carePlanId: next.care_plan_id,
        residentId: next.resident_id,
        status: next.status,
        title: next.title,
        description: next.description,
        effectiveFrom: next.effective_from,
        effectiveTo: next.effective_to,
        updatedAt: next.updated_at,
      };
    });
  }

  async discharge(a: Actor, rid?: string, body: any = {}) {
    await this.auth(a, MGMT);
    const residentId = this.req(rid, 'residentId');
    const reason = this.req(body?.reason, 'reason').slice(0, 120);
    const note = String(body?.note ?? '').trim().slice(0, 1000) || null;
    const destination = String(body?.destination ?? '').trim().slice(0, 250) || null;
    const effectiveAt = body?.effectiveAt ? new Date(body.effectiveAt) : new Date();
    if (Number.isNaN(effectiveAt.getTime()))
      throw new BadRequestException('effectiveAt is invalid');

    return this.db.withTransaction(async c => {
      const rq = await c.query(
        `SELECT resident_id,resident_code,display_name,active_status,room,bed,care_level
         FROM residents WHERE resident_id=$1 FOR UPDATE`,
        [residentId],
      );
      if (rq.rowCount !== 1) throw new NotFoundException('Resident not found');
      const resident = rq.rows[0];

      if (!resident.active_status) {
        const prior = await c.query(
          `SELECT lifecycle_event_id FROM resident_lifecycle_events
           WHERE resident_id=$1 AND event_type='DISCHARGED' LIMIT 1`,
          [residentId],
        );
        if (prior.rowCount)
          throw new ConflictException('Resident already discharged');
        throw new ConflictException('Resident is already inactive');
      }

      const aq = await c.query(
        `SELECT x.assignment_id,x.bed_id,b.status bed_status,
                r.status room_status,f.status floor_status,bu.status building_status
         FROM bed_assignments x
         JOIN accommodation_beds b ON b.bed_id=x.bed_id
         JOIN accommodation_rooms r ON r.room_id=b.room_id
         JOIN accommodation_floors f ON f.floor_id=r.floor_id
         JOIN accommodation_buildings bu ON bu.building_id=f.building_id
         WHERE x.resident_id=$1 AND x.ended_at IS NULL
         FOR UPDATE OF x,b,r,f,bu`,
        [residentId],
      );

      let releasedBedId: string | null = null;
      if (aq.rowCount === 1) {
        const x = aq.rows[0];
        releasedBedId = x.bed_id;
        await c.query(
          `UPDATE bed_assignments
           SET ended_at=$2,ended_by=$3,ended_by_role=$4,end_reason=$5
           WHERE assignment_id=$1`,
          [x.assignment_id, effectiveAt, a.actorId, a.actorRole, `DISCHARGE:${reason}`],
        );
        const nextBedStatus =
          x.building_status === 'ACTIVE' &&
          x.floor_status === 'ACTIVE' &&
          x.room_status === 'AVAILABLE'
            ? 'AVAILABLE'
            : 'TEMPORARILY_UNAVAILABLE';
        await c.query(
          `UPDATE accommodation_beds SET status=$2,updated_at=now() WHERE bed_id=$1`,
          [x.bed_id, nextBedStatus],
        );
      } else if ((aq.rowCount ?? 0) > 1) {
        throw new ConflictException('Resident has multiple active bed assignments');
      }

      const updated = await c.query(
        `UPDATE residents
         SET active_status=false,room=NULL,bed=NULL,updated_at=now()
         WHERE resident_id=$1
         RETURNING resident_id,resident_code,display_name,active_status,room,bed,care_level`,
        [residentId],
      );
      const next = updated.rows[0];
      const eventId = `lifecycle-${randomUUID()}`;

      await c.query(
        `INSERT INTO resident_lifecycle_events(
           lifecycle_event_id,resident_id,event_type,effective_at,reason,
           note,destination,actor_id,actor_role,previous_state,new_state
         ) VALUES($1,$2,'DISCHARGED',$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
        [
          eventId,
          residentId,
          effectiveAt,
          reason,
          note,
          destination,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            activeStatus: resident.active_status,
            room: resident.room,
            bed: resident.bed,
            careLevel: resident.care_level,
          }),
          JSON.stringify({
            activeStatus: next.active_status,
            room: next.room,
            bed: next.bed,
            releasedBedId,
            reason,
          }),
        ],
      );

      await c.query(
        `INSERT INTO resident_audit(
           event_type,target_resident_id,performed_by,performed_by_role,
           previous_value,new_value
         ) VALUES('RESIDENT_DISCHARGED',$1,$2,$3,$4::jsonb,$5::jsonb)`,
        [
          residentId,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            activeStatus: resident.active_status,
            room: resident.room,
            bed: resident.bed,
          }),
          JSON.stringify({
            activeStatus: false,
            room: null,
            bed: null,
            reason,
            lifecycleEventId: eventId,
          }),
        ],
      );

      return {
        lifecycleEventId: eventId,
        residentId,
        status: 'DISCHARGED',
        effectiveAt,
        reason,
        note,
        destination,
        releasedBedId,
      };
    });
  }

  async history(a: Actor, rid?: string, l?: string, o?: string) {
    await this.auth(a);
    const residentId = this.req(rid, 'residentId');
    const p = this.page(l, o);
    const q = await this.db.query(
      `SELECT lifecycle_event_id "lifecycleEventId",resident_id "residentId",
              event_type "eventType",effective_at "effectiveAt",reason,note,
              destination,actor_id "actorId",actor_role "actorRole",
              previous_state "previousState",new_state "newState",
              created_at "createdAt",COUNT(*) OVER()::int "totalCount"
       FROM resident_lifecycle_events
       WHERE resident_id=$1
       ORDER BY effective_at DESC,created_at DESC
       LIMIT $2 OFFSET $3`,
      [residentId, p.limit, p.offset],
    );
    return {
      items: q.rows,
      total: q.rows[0]?.totalCount ?? 0,
      limit: p.limit,
      offset: p.offset,
    };
  }
}
