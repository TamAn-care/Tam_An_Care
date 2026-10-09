import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { StaffActorService } from '../staff-actors/staff-actor.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';
import { authorizeResidentMealRegistration, ResidentMealAction } from './resident-meal-registration.policy';

const MEALS = new Set(['BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK','DINNER','EVENING_SNACK']);
type Identity = { id?: string; role?: string };
type MealInput = { residentId?: string; mealDate?: string; mealType?: string; portions?: number; note?: string; revision?: number };

@Injectable()
export class ResidentMealRegistrationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly staff: StaffActorService,
    private readonly scope: ResidentAccessScopeService,
  ) {}

  private async permit(identity: Identity, action: ResidentMealAction, residentId?: string): Promise<{id: string; role: string}> {
    const id = String(identity.id ?? '').trim();
    const role = String(identity.role ?? '').trim().toUpperCase();
    if (!id || !role) throw new UnauthorizedException('Authenticated session required');
    const actor = await this.staff.resolveActiveActorWithRole(id, role as any);
    if (!actor) throw new UnauthorizedException('Active staff actor required');
    const assigned = role === 'CAREGIVER' && Boolean(residentId)
      ? await this.scope.canAccessResident(id, 'CAREGIVER', residentId!)
      : false;
    const result = authorizeResidentMealRegistration({
      role, action, assignedResident: assigned, activeAuthenticatedActor: true,
    });
    if (!result.allowed) throw new ForbiddenException('Meal registration access denied');
    return {id, role};
  }

  private parse(input: MealInput) {
    const residentId = String(input.residentId ?? '').trim();
    const mealDate = String(input.mealDate ?? '');
    const mealType = String(input.mealType ?? '').toUpperCase();
    if (!residentId || !/^\d{4}-\d{2}-\d{2}$/.test(mealDate) ||
        !Number.isFinite(Date.parse(mealDate + 'T00:00:00Z')) ||
        new Date(mealDate + 'T00:00:00Z').toISOString().slice(0,10) !== mealDate ||
        !MEALS.has(mealType)) throw new BadRequestException('Invalid resident/date/meal');
    if (!Number.isSafeInteger(input.portions) || Number(input.portions) < 1 || Number(input.portions) > 10)
      throw new BadRequestException('Portions must be an integer from 1 to 10');
    const note = String(input.note ?? '').trim();
    if (note.length > 1000) throw new BadRequestException('Note too long');
    return {residentId, mealDate, mealType, portions: input.portions!, note};
  }

  async list(identity: Identity, mealDate: string, mealType?: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mealDate) || !Number.isFinite(Date.parse(mealDate + 'T00:00:00Z')) ||
        new Date(mealDate + 'T00:00:00Z').toISOString().slice(0,10) !== mealDate)
      throw new BadRequestException('Invalid date');
    if (mealType && !MEALS.has(mealType)) throw new BadRequestException('Invalid meal');
    const id = String(identity.id ?? '').trim();
    const role = String(identity.role ?? '').trim().toUpperCase();
    if (!id || !['CAREGIVER','CARE_MANAGER','NUTRITIONIST','SUPERVISOR'].includes(role) ||
        !(await this.staff.resolveActiveActorWithRole(id,role as any)))
      throw new ForbiddenException('Meal registration list access denied');
    const actor = { id, role };
    const q = await this.db.query(
      `SELECT m.* FROM resident_meal_registrations m
       JOIN residents r ON r.resident_id=m.resident_id AND r.active_status=true
       WHERE m.meal_date=$1::date AND ($2::text IS NULL OR m.meal_type=$2)
       AND ($3::text <> 'CAREGIVER' OR EXISTS (
         SELECT 1 FROM resident_access_assignments a
         WHERE a.resident_id=m.resident_id AND a.actor_id=$4 AND a.actor_role='CAREGIVER'
           AND a.access_scope='DIRECT_CARE' AND a.status='ACTIVE'
           AND a.effective_from<=now() AND (a.effective_to IS NULL OR a.effective_to>now())
       ))
       ORDER BY m.meal_type,m.resident_id LIMIT 1000`,
      [mealDate,mealType ?? null,actor.role,actor.id],
    );
    return {items:q.rows};
  }

  async totals(identity: Identity, mealDate: string) {
    const actor = await this.permit(identity,'VIEW');
    if (actor.role === 'CAREGIVER') throw new ForbiddenException('Kitchen totals require management or viewer role');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mealDate) || !Number.isFinite(Date.parse(mealDate + 'T00:00:00Z')) ||
        new Date(mealDate + 'T00:00:00Z').toISOString().slice(0,10) !== mealDate)
      throw new BadRequestException('Invalid date');
    const q = await this.db.query(
      `SELECT meal_type,COUNT(*)::int AS residents,SUM(portions)::int AS portions
       FROM resident_meal_registrations WHERE meal_date=$1::date AND status='REGISTERED'
       GROUP BY meal_type ORDER BY meal_type`,[mealDate]);
    return {items:q.rows};
  }

  async register(identity: Identity, body: MealInput) {
    const v = this.parse(body);
    const actor = await this.permit(identity,'REGISTER',v.residentId);
    return this.db.withTransaction(async client => {
      const resident = await client.query('SELECT resident_id FROM residents WHERE resident_id=$1 AND active_status=true FOR SHARE',[v.residentId]);
      if (!resident.rowCount) throw new NotFoundException('Active resident not found');
      // Revalidate caregiver scope within the transaction just before the write.
      if (actor.role === 'CAREGIVER') {
        const assignment=await client.query(
          `SELECT 1 FROM resident_access_assignments WHERE resident_id=$1 AND actor_id=$2
           AND actor_role='CAREGIVER' AND access_scope='DIRECT_CARE' AND status='ACTIVE'
           AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) LIMIT 1`,
           [v.residentId,actor.id]);
        if(!assignment.rowCount) throw new ForbiddenException('Assignment no longer active');
      }
      const id=randomUUID();
      const q=await client.query(
        `INSERT INTO resident_meal_registrations
         (registration_id,resident_id,meal_date,meal_type,portions,note,registered_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(resident_id,meal_date,meal_type) DO NOTHING RETURNING *`,
        [id,v.residentId,v.mealDate,v.mealType,v.portions,v.note,actor.id]);
      if (!q.rowCount) throw new ConflictException('Registration exists; update with revision');
      await client.query(
        `INSERT INTO resident_meal_registration_audit(event_id,registration_id,actor_id,actor_role,action,new_record)
         VALUES($1,$2,$3,$4,'REGISTER',$5::jsonb)`,
        [randomUUID(),id,actor.id,actor.role,JSON.stringify(q.rows[0])]);
      return q.rows[0];
    });
  }

  async change(identity: Identity, id: string, body: MealInput, cancel=false) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException('Invalid registration id');
    const revision=body.revision;
    if (!Number.isSafeInteger(revision) || Number(revision)<1) throw new BadRequestException('revision required');
    return this.db.withTransaction(async client => {
      const existing=await client.query('SELECT *, meal_date::text AS meal_date_iso FROM resident_meal_registrations WHERE registration_id=$1 FOR UPDATE',[id]);
      if (!existing.rowCount) throw new NotFoundException('Registration not found');
      const prior=existing.rows[0];
      const actor=await this.permit(identity,cancel?'CANCEL':'UPDATE',prior.resident_id);
      if (prior.revision !== revision) throw new ConflictException('Stale registration revision');
      if (prior.status==='CANCELLED') throw new ConflictException('Cancelled registration is immutable');
      const v = cancel ? null : this.parse({...body,residentId:prior.resident_id,mealDate: prior.meal_date_iso,mealType:prior.meal_type});
      if(actor.role==='CAREGIVER') {
        const a=await client.query(
          `SELECT 1 FROM resident_access_assignments WHERE resident_id=$1 AND actor_id=$2
           AND actor_role='CAREGIVER' AND access_scope='DIRECT_CARE' AND status='ACTIVE'
           AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) LIMIT 1`,
          [prior.resident_id,actor.id]);
        if(!a.rowCount) throw new ForbiddenException('Assignment no longer active');
      }
      const updated=await client.query(
        `UPDATE resident_meal_registrations
         SET portions=COALESCE($2,portions),note=COALESCE($3,note),status=$4,
             revision=revision+1,updated_by=$5,updated_at=now()
         WHERE registration_id=$1 RETURNING *`,
        [id,v?.portions ?? null,v?.note ?? null,cancel?'CANCELLED':'REGISTERED',actor.id]);
      await client.query(
        `INSERT INTO resident_meal_registration_audit
         (event_id,registration_id,actor_id,actor_role,action,previous_record,new_record)
         VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
         [randomUUID(),id,actor.id,actor.role,cancel?'CANCEL':'UPDATE',JSON.stringify(prior),JSON.stringify(updated.rows[0])]);
      return updated.rows[0];
    });
  }
}
