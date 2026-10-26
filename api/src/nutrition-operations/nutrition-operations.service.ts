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
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';
import { StaffActorService } from '../staff-actors/staff-actor.service';

type Identity = { actorId?: string; actorRole?: string };
type Client = { query: (sql: string, params?: any[]) => Promise<any> };

const MEALS = new Set(['BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK','DINNER','EVENING_SNACK']);
const DISPATCHERS = new Set(['NUTRITIONIST', 'SUPERVISOR', 'CARE_MANAGER']);
const HYGIENE_WRITERS = new Set(['NUTRITIONIST']);
const SAMPLE_WRITERS = new Set(['NUTRITIONIST', 'SUPERVISOR', 'CARE_MANAGER']);
const MANAGERS = new Set(['SUPERVISOR', 'CARE_MANAGER']);

@Injectable()
export class NutritionOperationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly staff: StaffActorService,
    private readonly scope: ResidentAccessScopeService,
  ) {}

  private async actor(identity: Identity, allowed: Set<string>) {
    const actorId = String(identity.actorId ?? '').trim();
    const actorRole = String(identity.actorRole ?? '').trim().toUpperCase();
    if (!actorId || !actorRole) throw new UnauthorizedException('Authenticated session required');
    if (!allowed.has(actorRole)) throw new ForbiddenException('Nutrition operation denied');
    const resolved = await this.staff.resolveActiveActorWithRole(actorId, actorRole as any);
    if (!resolved) throw new UnauthorizedException('Active staff actor required');
    return { actorId, actorRole };
  }

  private async residentAccess(client: Client, identity: { actorId: string; actorRole: string }, residentId: string) {
    const resident = await client.query(
      'SELECT resident_id FROM residents WHERE resident_id=$1 AND active_status=true FOR SHARE',
      [residentId],
    );
    if (!resident.rowCount) throw new NotFoundException('Active resident not found');
    if (identity.actorRole === 'CAREGIVER' || identity.actorRole === 'NURSE') {
      const permitted = await this.scope.canAccessResident(identity.actorId, identity.actorRole as any, residentId);
      if (!permitted) throw new ForbiddenException('Resident scope denied');
    }
  }

  private parseDate(value: unknown) {
    const date = String(value ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new BadRequestException('Valid meal date required');
    }
    return date;
  }

  private parseMealType(value: unknown) {
    const mealType = String(value ?? '').trim().toUpperCase();
    if (!MEALS.has(mealType)) throw new BadRequestException('Valid meal type required');
    return mealType;
  }

  private async audit(client: Client, type: string, aggregateId: string, residentId: string, action: string, actor: { actorId: string; actorRole: string }, state: any) {
    await client.query(
      `INSERT INTO nutrition_operational_audit
       (event_id,aggregate_type,aggregate_id,resident_id,action,actor_id,actor_role,new_state)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [randomUUID(), type, aggregateId, residentId, action, actor.actorId, actor.actorRole, JSON.stringify(state)],
    );
  }

  async dispatch(identity: Identity, body: any) {
    const actor = await this.actor(identity, DISPATCHERS);
    const registrationId = String(body?.registrationId ?? '').trim();
    const destinationFloor = String(body?.destinationFloor ?? '').trim();
    const portions = Number(body?.portions);
    if (!registrationId || !destinationFloor || !Number.isSafeInteger(portions) || portions < 1 || portions > 10) {
      throw new BadRequestException('Registration, destination floor and portions are required');
    }
    return this.db.withTransaction(async client => {
      const registration = await client.query(
        `SELECT registration_id,resident_id,meal_date::text AS meal_date,meal_type,portions,status
         FROM resident_meal_registrations WHERE registration_id=$1 FOR SHARE`, [registrationId],
      );
      if (!registration.rowCount || registration.rows[0].status !== 'REGISTERED') throw new NotFoundException('Active meal registration not found');
      const meal = registration.rows[0];
      await this.residentAccess(client, actor, meal.resident_id);
      if (portions !== Number(meal.portions)) throw new ConflictException('Dispatch portions must match registration');
      const dispatchId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO nutrition_tray_dispatches
         (dispatch_id,registration_id,resident_id,meal_date,meal_type,portions,destination_floor,dispatched_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [dispatchId, registrationId, meal.resident_id, meal.meal_date, meal.meal_type, portions, destinationFloor, actor.actorId],
      );
      await client.query(
        `INSERT INTO nutrition_tray_handover_events
         (event_id,dispatch_id,event_type,actor_id,actor_role,destination_floor,portions)
         VALUES($1,$2,'DISPATCHED',$3,$4,$5,$6)`,
        [randomUUID(), dispatchId, actor.actorId, actor.actorRole, destinationFloor, portions],
      );
      await this.audit(client, 'TRAY_DISPATCH', dispatchId, meal.resident_id, 'DISPATCHED', actor, inserted.rows[0]);
      return inserted.rows[0];
    });
  }

  async acknowledge(identity: Identity, dispatchId: string, body: any) {
    const actor = await this.actor(identity, new Set(['CAREGIVER']));
    const receivedPortions = Number(body?.receivedPortions);
    const floor = String(body?.floor ?? '').trim();
    const notes = String(body?.notes ?? '').trim();
    if (!dispatchId || !floor || !Number.isSafeInteger(receivedPortions) || receivedPortions < 0 || notes.length > 2000) {
      throw new BadRequestException('Dispatch, floor, received portions and notes are required');
    }
    return this.db.withTransaction(async client => {
      const current = await client.query('SELECT * FROM nutrition_tray_dispatches WHERE dispatch_id=$1 FOR UPDATE', [dispatchId]);
      if (!current.rowCount) throw new NotFoundException('Tray dispatch not found');
      const dispatch = current.rows[0];
      const assignment = await client.query(
        `SELECT 1 FROM nutrition_caregiver_floor_assignments
         WHERE actor_id=$1 AND resident_id=$2 AND floor=$3 AND active=true`,
        [actor.actorId, dispatch.resident_id, floor],
      );
      if (!assignment.rowCount) throw new ForbiddenException('Caregiver is not assigned to this resident floor');
      if (dispatch.status === 'RECEIVED') throw new ConflictException('Tray receipt already recorded');
      if (receivedPortions > Number(dispatch.portions)) throw new ConflictException('Received quantity cannot exceed dispatch quantity');
      const discrepancy = Number(dispatch.portions) - receivedPortions;
      const updated = await client.query(
        `UPDATE nutrition_tray_dispatches SET status='RECEIVED' WHERE dispatch_id=$1 RETURNING *`, [dispatchId],
      );
      await client.query(
        `INSERT INTO nutrition_tray_handover_events
         (event_id,dispatch_id,event_type,actor_id,actor_role,destination_floor,portions,discrepancy_portions,notes)
         VALUES($1,$2,'HANDOVER_ACKNOWLEDGED',$3,$4,$5,$6,$7,$8)`,
        [randomUUID(), dispatchId, actor.actorId, actor.actorRole, floor, receivedPortions, discrepancy, notes],
      );
      await this.audit(client, 'TRAY_DISPATCH', dispatchId, dispatch.resident_id, 'HANDOVER_ACKNOWLEDGED', actor, { ...updated.rows[0], discrepancy, notes });
      return updated.rows[0];
    });
  }

  async listDispatches(identity: Identity, date: string) {
    const actor = await this.actor(identity, DISPATCHERS);
    const mealDate = this.parseDate(date);
    const q = await this.db.query(
      `SELECT * FROM nutrition_tray_dispatches WHERE meal_date=$1::date ORDER BY dispatched_at,dispatch_id`, [mealDate],
    );
    return { items: q.rows };
  }

  async recordHygiene(identity: Identity, body: any) {
    const actor = await this.actor(identity, HYGIENE_WRITERS);
    const residentId = String(body?.residentId ?? '').trim();
    const taskReference = String(body?.taskReference ?? '').trim();
    const status = String(body?.status ?? 'RECORDED').trim().toUpperCase();
    const notes = String(body?.notes ?? '').trim();
    if (!residentId || !taskReference || !['RECORDED','COMPLETED'].includes(status) || notes.length > 2000) {
      throw new BadRequestException('Valid resident, task, status and notes are required');
    }
    return this.db.withTransaction(async client => {
      await this.residentAccess(client, actor, residentId);
      const q = await client.query(
        `INSERT INTO nutrition_hygiene_records
         (record_id,resident_id,task_reference,status,actor_id,actor_role,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [randomUUID(), residentId, taskReference, status, actor.actorId, actor.actorRole, notes],
      );
      await this.audit(client, 'HYGIENE_RECORD', q.rows[0].record_id, residentId, status, actor, q.rows[0]);
      return q.rows[0];
    });
  }

  async listHygiene(identity: Identity, residentId?: string) {
    const actor = await this.actor(identity, HYGIENE_WRITERS);
    if (residentId) {
      await this.residentAccess(this.db, actor, residentId);
    }
    const q = await this.db.query(
      `SELECT * FROM nutrition_hygiene_records WHERE ($1::text IS NULL OR resident_id=$1) ORDER BY recorded_at DESC`, [residentId ?? null],
    );
    return { items: q.rows };
  }

  async inspectHygiene(identity: Identity, body: any) {
    const actor = await this.actor(identity, MANAGERS);
    const recordId = String(body?.recordId ?? '').trim();
    const finding = String(body?.finding ?? '').trim();
    const decision = String(body?.decision ?? '').trim().toUpperCase();
    if (!recordId || !finding || !['CONFIRMED','NONCONFORMITY'].includes(decision)) {
      throw new BadRequestException('Record, finding and inspection decision are required');
    }
    return this.db.withTransaction(async client => {
      const record = await client.query('SELECT * FROM nutrition_hygiene_records WHERE record_id=$1 FOR SHARE', [recordId]);
      if (!record.rowCount) throw new NotFoundException('Hygiene record not found');
      const q = await client.query(
        `INSERT INTO nutrition_hygiene_inspections
         (inspection_id,record_id,resident_id,inspector_id,inspector_role,finding,decision)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [randomUUID(), recordId, record.rows[0].resident_id, actor.actorId, actor.actorRole, finding, decision],
      );
      await this.audit(client, 'HYGIENE_RECORD', recordId, record.rows[0].resident_id, 'MANAGER_INSPECTION', actor, q.rows[0]);
      return q.rows[0];
    });
  }

  async collectSample(identity: Identity, body: any) {
    const actor = await this.actor(identity, SAMPLE_WRITERS);
    const residentId = String(body?.residentId ?? '').trim();
    const mealDate = this.parseDate(body?.mealDate);
    const mealType = this.parseMealType(body?.mealType);
    const notes = String(body?.notes ?? '').trim();
    if (!residentId || notes.length > 2000) throw new BadRequestException('Valid resident and notes are required');
    const registrationId = body?.registrationId ? String(body.registrationId).trim() : null;
    return this.db.withTransaction(async client => {
      await this.residentAccess(client, actor, residentId);
      if (registrationId) {
        const r = await client.query(
          `SELECT 1 FROM resident_meal_registrations WHERE registration_id=$1 AND resident_id=$2 AND meal_date=$3::date AND meal_type=$4 AND status='REGISTERED'`,
          [registrationId, residentId, mealDate, mealType],
        );
        if (!r.rowCount) throw new ConflictException('Sample registration linkage does not match');
      }
      const q = await client.query(
        `INSERT INTO nutrition_food_samples
         (sample_id,registration_id,resident_id,meal_date,meal_type,collected_at,retained_until,collected_by,collected_by_role,notes)
         VALUES($1,$2,$3,$4,$5,now(),now()+interval '24 hours',$6,$7,$8) RETURNING *`,
        [randomUUID(), registrationId, residentId, mealDate, mealType, actor.actorId, actor.actorRole, notes],
      );
      await this.audit(client, 'FOOD_SAMPLE', q.rows[0].sample_id, residentId, 'COLLECTED', actor, q.rows[0]);
      return q.rows[0];
    });
  }

  async disposeSample(identity: Identity, sampleId: string) {
    const actor = await this.actor(identity, SAMPLE_WRITERS);
    return this.db.withTransaction(async client => {
      const existing = await client.query('SELECT * FROM nutrition_food_samples WHERE sample_id=$1 FOR UPDATE', [sampleId]);
      if (!existing.rowCount) throw new NotFoundException('Food sample not found');
      const sample = existing.rows[0];
      await this.residentAccess(client, actor, sample.resident_id);
      if (sample.status !== 'IN_STORAGE') throw new ConflictException('Food sample is already finalized');
      if (new Date() < new Date(sample.retained_until)) throw new ConflictException('24-hour retention period has not elapsed');
      const q = await client.query(
        `UPDATE nutrition_food_samples SET status='DISPOSAL_RECORDED',disposed_at=now(),disposed_by=$2
         WHERE sample_id=$1 RETURNING *`, [sampleId, actor.actorId],
      );
      await this.audit(client, 'FOOD_SAMPLE', sampleId, sample.resident_id, 'DISPOSAL_RECORDED', actor, q.rows[0]);
      return q.rows[0];
    });
  }

  async listSamples(identity: Identity, residentId?: string) {
    const actor = await this.actor(identity, SAMPLE_WRITERS);
    if (residentId) await this.residentAccess(this.db, actor, residentId);
    const q = await this.db.query(
      `SELECT * FROM nutrition_food_samples WHERE ($1::text IS NULL OR resident_id=$1) ORDER BY collected_at DESC`, [residentId ?? null],
    );
    return { items: q.rows };
  }

  async inspectSample(identity: Identity, body: any) {
    const actor = await this.actor(identity, MANAGERS);
    const sampleId = String(body?.sampleId ?? '').trim();
    const finding = String(body?.finding ?? '').trim();
    if (!sampleId || !finding) throw new BadRequestException('Sample and finding are required');
    return this.db.withTransaction(async client => {
      const sample = await client.query('SELECT * FROM nutrition_food_samples WHERE sample_id=$1 FOR SHARE', [sampleId]);
      if (!sample.rowCount) throw new NotFoundException('Food sample not found');
      const q = await client.query(
        `INSERT INTO nutrition_sample_inspections
         (inspection_id,sample_id,resident_id,inspector_id,inspector_role,finding)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [randomUUID(), sampleId, sample.rows[0].resident_id, actor.actorId, actor.actorRole, finding],
      );
      await this.audit(client, 'FOOD_SAMPLE', sampleId, sample.rows[0].resident_id, 'MANAGER_INSPECTION', actor, q.rows[0]);
      return q.rows[0];
    });
  }
}
