import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';

type Cmd = {
  action: string;
  actorId: string;
  actorRole: string;
  [key: string]: any;
};

@Injectable()
export class SleepRestService {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      user: process.env.DB_USER ?? process.env.POSTGRES_USER,
      password: process.env.DB_PASSWORD ?? process.env.POSTGRES_PASSWORD,
      database: process.env.DB_NAME ?? process.env.POSTGRES_DB,
    });
  }

  summary() {
    return {
      status: 'OK',
      domain: 'SLEEP_REST_NIGHT_TIME_SAFETY',
      aiRole: 'ADVISORY_ONLY',
      autonomousClinicalAction: false,
    };
  }

  private requireHuman(c: Cmd) {
    const role = String(c.actorRole || '').toUpperCase();

    if (!c.actorId || !role) {
      throw new BadRequestException('Human actor identity required.');
    }

    if (role === 'AI' || role === 'SYSTEM') {
      throw new BadRequestException(
        'AI / SYSTEM cannot perform official sleep/rest mutation.',
      );
    }
  }

  private requireReviewer(c: Cmd) {
    this.requireHuman(c);

    if (
      !['NURSE','SUPERVISOR','CARE_MANAGER'].includes(
        String(c.actorRole).toUpperCase(),
      )
    ) {
      throw new BadRequestException(
        'Authorized human reviewer required.',
      );
    }
  }

  private requireManager(c: Cmd) {
    this.requireHuman(c);

    if (
      !['SUPERVISOR','CARE_MANAGER'].includes(
        String(c.actorRole).toUpperCase(),
      )
    ) {
      throw new BadRequestException(
        'Supervisor or Care Manager required.',
      );
    }
  }

  private async audit(
    db: PoolClient,
    residentId: string,
    entityType: string,
    entityId: string,
    eventType: string,
    c: Cmd,
    payload: any,
  ) {
    const q = await db.query(
      `
      SELECT COALESCE(MAX(sequence_no),0)+1 AS next
      FROM sleep_audit
      WHERE entity_type=$1
        AND entity_id=$2
      `,
      [entityType, entityId],
    );

    await db.query(
      `
      INSERT INTO sleep_audit (
        audit_id,
        resident_id,
        entity_type,
        entity_id,
        event_type,
        actor_id,
        actor_role,
        sequence_no,
        event_payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        randomUUID(),
        residentId,
        entityType,
        entityId,
        eventType,
        c.actorId,
        c.actorRole,
        Number(q.rows[0].next),
        payload ? JSON.stringify(payload) : null,
      ],
    );
  }

  async execute(residentId: string, c: Cmd) {
    this.requireHuman(c);

    const action = String(c.action || '').toUpperCase();
    const db = await this.pool.connect();

    try {
      await db.query('BEGIN');

      let result: any;

      switch (action) {
        case 'CREATE_SLEEP_PLAN': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO sleep_care_plans (
              sleep_care_plan_id,
              resident_id,
              preferred_bedtime,
              preferred_wake_time,
              usual_sleep_pattern,
              night_light_preference,
              room_environment_preference,
              toileting_support_preference,
              mobility_support_requirement,
              night_check_requirement,
              status,
              owner_id,
              owner_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              'DRAFT',$11,$12
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.preferredBedtime ?? null,
              c.preferredWakeTime ?? null,
              c.usualSleepPattern ?? null,
              c.nightLightPreference ?? null,
              c.roomEnvironmentPreference ?? null,
              c.toiletingSupportPreference ?? null,
              c.mobilitySupportRequirement ?? null,
              c.nightCheckRequirement ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,
            residentId,
            'SLEEP_CARE_PLAN',
            id,
            'SLEEP_CARE_PLAN_CREATED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'REVIEW_SLEEP_PLAN': {
          this.requireManager(c);

          const id = c.sleepCarePlanId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_care_plans
            WHERE sleep_care_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Plan not found.');

          if (q.rows[0].status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT plan may be reviewed.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_care_plans
            SET
              status='REVIEWED',
              reviewer_id=$2,
              reviewer_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE sleep_care_plan_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SLEEP_CARE_PLAN',id,
            'SLEEP_CARE_PLAN_REVIEWED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_SLEEP_PLAN': {
          this.requireManager(c);

          const id = c.sleepCarePlanId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_care_plans
            WHERE sleep_care_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Plan not found.');

          if (q.rows[0].status !== 'REVIEWED') {
            throw new BadRequestException(
              'Only REVIEWED plan may activate.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_care_plans
            SET
              status='ACTIVE',
              activated_at=now(),
              updated_at=now()
            WHERE sleep_care_plan_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            db,residentId,'SLEEP_CARE_PLAN',id,
            'SLEEP_CARE_PLAN_ACTIVATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_SLEEP_OBSERVATION': {
          const id = randomUUID();

          if (!c.observableFacts) {
            throw new BadRequestException(
              'Observable facts are required.',
            );
          }

          const r = await db.query(
            `
            INSERT INTO sleep_observations (
              sleep_observation_id,
              resident_id,
              observation_type,
              observable_facts,
              baseline_change,
              state,
              recorded_by,
              recorded_by_role
            )
            VALUES ($1,$2,$3,$4,$5,'RECORDED',$6,$7)
            RETURNING *
            `,
            [
              id,
              residentId,
              c.observationType ?? 'SLEEP_OBSERVATION',
              c.observableFacts,
              Boolean(c.baselineChange),
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SLEEP_OBSERVATION',id,
            'SLEEP_OBSERVATION_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_SLEEP_OBSERVATION': {
          this.requireReviewer(c);

          const id = c.sleepObservationId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_observations
            WHERE sleep_observation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Observation not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED observation may verify.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_observations
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE sleep_observation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SLEEP_OBSERVATION',id,
            'SLEEP_OBSERVATION_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_NIGHT_CHECK': {
          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO night_monitoring_checks (
              night_check_id,
              resident_id,
              sleep_care_plan_id,
              scheduled_at,
              state,
              assigned_to,
              assigned_role,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,
              COALESCE($4::timestamptz,now()),
              'SCHEDULED',$5,$6,$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.sleepCarePlanId ?? null,
              c.scheduledAt ?? null,
              c.assignedTo ?? c.actorId,
              c.assignedRole ?? c.actorRole,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'NIGHT_MONITORING_CHECK',id,
            'NIGHT_CHECK_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'COMPLETE_NIGHT_CHECK':
        case 'MISS_NIGHT_CHECK':
        case 'HOLD_NIGHT_CHECK': {
          const id = c.nightCheckId;

          const q = await db.query(
            `
            SELECT *
            FROM night_monitoring_checks
            WHERE night_check_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Night check not found.');

          if (q.rows[0].state !== 'SCHEDULED') {
            throw new BadRequestException(
              'Night check already terminal.',
            );
          }

          if (
            q.rows[0].assigned_to &&
            q.rows[0].assigned_to !== c.actorId
          ) {
            throw new BadRequestException(
              'Only assigned human may complete night check.',
            );
          }

          const target =
            action === 'COMPLETE_NIGHT_CHECK'
              ? 'COMPLETED'
              : action === 'MISS_NIGHT_CHECK'
                ? 'MISSED'
                : 'HELD';

          const event =
            action === 'COMPLETE_NIGHT_CHECK'
              ? 'NIGHT_CHECK_COMPLETED'
              : action === 'MISS_NIGHT_CHECK'
                ? 'NIGHT_CHECK_MISSED'
                : 'NIGHT_CHECK_HELD';

          const r = await db.query(
            `
            UPDATE night_monitoring_checks
            SET
              state=$2,
              performed_at=CASE
                WHEN $2='COMPLETED' THEN now()
                ELSE performed_at
              END,
              observation=$3,
              resident_state=$4,
              mobility_observation=$5,
              environmental_observation=$6,
              performed_by=$7,
              performed_by_role=$8,
              exception_reason=$9,
              updated_at=now()
            WHERE night_check_id=$1
            RETURNING *
            `,
            [
              id,
              target,
              c.observation ?? null,
              c.residentState ?? null,
              c.mobilityObservation ?? null,
              c.environmentalObservation ?? null,
              c.actorId,
              c.actorRole,
              c.exceptionReason ?? null,
            ],
          );

          await this.audit(
            db,residentId,'NIGHT_MONITORING_CHECK',id,
            event,c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_SLEEP_EVENT': {
          const id = randomUUID();

          if (!c.observableFacts) {
            throw new BadRequestException(
              'Observable facts are required.',
            );
          }

          const r = await db.query(
            `
            INSERT INTO sleep_rest_events (
              sleep_rest_event_id,
              resident_id,
              event_type,
              observable_facts,
              location,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'OPEN',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.eventType ?? 'NIGHT_WAKEFULNESS',
              c.observableFacts,
              c.location ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SLEEP_REST_EVENT',id,
            'SLEEP_REST_EVENT_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_SLEEP_EVENT': {
          this.requireManager(c);

          if (
            !c.ownerId ||
            !c.ownerRole ||
            ['AI','SYSTEM'].includes(
              String(c.ownerRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException('Human owner required.');
          }

          const id = c.sleepRestEventId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_rest_events
            WHERE sleep_rest_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Event not found.');

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN event may be assigned.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_rest_events
            SET
              state='ASSIGNED',
              owner_id=$2,
              owner_role=$3,
              assigned_at=now(),
              updated_at=now()
            WHERE sleep_rest_event_id=$1
            RETURNING *
            `,
            [id,c.ownerId,c.ownerRole],
          );

          await this.audit(
            db,residentId,'SLEEP_REST_EVENT',id,
            'SLEEP_REST_EVENT_ASSIGNED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACKNOWLEDGE_SLEEP_EVENT': {
          const id = c.sleepRestEventId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_rest_events
            WHERE sleep_rest_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Event not found.');

          if (q.rows[0].state !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED event may be acknowledged.',
            );
          }

          if (q.rows[0].owner_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human owner may acknowledge.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_rest_events
            SET
              state='ACKNOWLEDGED',
              acknowledged_at=now(),
              updated_at=now()
            WHERE sleep_rest_event_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            db,residentId,'SLEEP_REST_EVENT',id,
            'SLEEP_REST_EVENT_ACKNOWLEDGED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_NIGHT_RESPONSE': {
          const eventId = c.sleepRestEventId;

          const ev = await db.query(
            `
            SELECT *
            FROM sleep_rest_events
            WHERE sleep_rest_event_id=$1
            FOR UPDATE
            `,
            [eventId],
          );

          if (!ev.rowCount) throw new NotFoundException('Event not found.');

          if (
            !['ACKNOWLEDGED','RESPONDING'].includes(
              ev.rows[0].state,
            )
          ) {
            throw new BadRequestException(
              'Event must be ACKNOWLEDGED or RESPONDING.',
            );
          }

          if (
            ev.rows[0].owner_id &&
            ev.rows[0].owner_id !== c.actorId
          ) {
            throw new BadRequestException(
              'Only assigned human owner may record response.',
            );
          }

          await db.query(
            `
            UPDATE sleep_rest_events
            SET state='RESPONDING',updated_at=now()
            WHERE sleep_rest_event_id=$1
            `,
            [eventId],
          );

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO night_support_responses (
              response_id,
              resident_id,
              sleep_rest_event_id,
              response_type,
              response_notes,
              performed_by,
              performed_by_role,
              state
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,'RECORDED'
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              eventId,
              c.responseType ?? 'COMFORT_SUPPORT',
              c.responseNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'NIGHT_SUPPORT_RESPONSE',id,
            'NIGHT_SUPPORT_RESPONSE_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_NIGHT_RESPONSE': {
          this.requireReviewer(c);

          const id = c.responseId;

          const q = await db.query(
            `
            SELECT *
            FROM night_support_responses
            WHERE response_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Response not found.');

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED response may verify.',
            );
          }

          const r = await db.query(
            `
            UPDATE night_support_responses
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE response_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'NIGHT_SUPPORT_RESPONSE',id,
            'NIGHT_SUPPORT_RESPONSE_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_SAFETY_ALERT': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO sleep_safety_alerts (
              alert_id,
              resident_id,
              source_type,
              source_id,
              alert_type,
              alert_notes,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,'OPEN',$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.sourceType ?? 'SLEEP_OBSERVATION',
              c.sourceId ?? null,
              c.alertType ?? 'HUMAN_REVIEW_REQUIRED',
              c.alertNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SLEEP_SAFETY_ALERT',id,
            'SLEEP_SAFETY_ALERT_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACKNOWLEDGE_SAFETY_ALERT': {
          const id = c.alertId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_safety_alerts
            WHERE alert_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Alert not found.');

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN alert may be acknowledged.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_safety_alerts
            SET
              state='ACKNOWLEDGED',
              acknowledged_by=$2,
              acknowledged_at=now(),
              updated_at=now()
            WHERE alert_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'SLEEP_SAFETY_ALERT',id,
            'SLEEP_SAFETY_ALERT_ACKNOWLEDGED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_SLEEP_ESCALATION': {
          this.requireReviewer(c);

          const id = randomUUID();

          if (!c.reason) {
            throw new BadRequestException('Escalation reason required.');
          }

          const r = await db.query(
            `
            INSERT INTO sleep_escalations (
              sleep_escalation_id,
              resident_id,
              source_type,
              source_id,
              reason,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'OPEN',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.sourceType ?? 'SLEEP_REST_EVENT',
              c.sourceId ?? null,
              c.reason,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SLEEP_ESCALATION',id,
            'SLEEP_ESCALATION_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_SLEEP_ESCALATION': {
          this.requireManager(c);

          if (
            !c.reviewerId ||
            !c.reviewerRole ||
            ['AI','SYSTEM'].includes(
              String(c.reviewerRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException('Human reviewer required.');
          }

          const id = c.sleepEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_escalations
            WHERE sleep_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Escalation not found.');

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN escalation may be assigned.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_escalations
            SET
              state='ASSIGNED',
              reviewer_id=$2,
              reviewer_role=$3,
              assigned_by=$4,
              assigned_by_role=$5,
              assigned_at=now(),
              updated_at=now()
            WHERE sleep_escalation_id=$1
            RETURNING *
            `,
            [
              id,
              c.reviewerId,
              c.reviewerRole,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SLEEP_ESCALATION',id,
            'SLEEP_ESCALATION_ASSIGNED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACCEPT_SLEEP_ESCALATION': {
          const id = c.sleepEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_escalations
            WHERE sleep_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Escalation not found.');

          if (q.rows[0].state !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED escalation may be accepted.',
            );
          }

          if (q.rows[0].reviewer_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human reviewer may accept.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_escalations
            SET
              state='ACCEPTED',
              accepted_by=$2,
              accepted_at=now(),
              updated_at=now()
            WHERE sleep_escalation_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'SLEEP_ESCALATION',id,
            'SLEEP_ESCALATION_ACCEPTED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_SLEEP_ESCALATION': {
          const id = c.sleepEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_escalations
            WHERE sleep_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Escalation not found.');

          if (q.rows[0].state !== 'ACCEPTED') {
            throw new BadRequestException(
              'Only ACCEPTED escalation may resolve.',
            );
          }

          if (q.rows[0].reviewer_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned reviewer may resolve.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_escalations
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_notes=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE sleep_escalation_id=$1
            RETURNING *
            `,
            [
              id,
              c.actorId,
              c.actorRole,
              c.resolutionNotes ?? null,
            ],
          );

          await this.audit(
            db,residentId,'SLEEP_ESCALATION',id,
            'SLEEP_ESCALATION_RESOLVED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_SLEEP_EVENT': {
          const id = c.sleepRestEventId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_rest_events
            WHERE sleep_rest_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Event not found.');

          if (
            !['ACKNOWLEDGED','RESPONDING'].includes(
              q.rows[0].state,
            )
          ) {
            throw new BadRequestException(
              'Event cannot resolve from current state.',
            );
          }

          if (
            q.rows[0].owner_id &&
            q.rows[0].owner_id !== c.actorId
          ) {
            throw new BadRequestException(
              'Only assigned human owner may resolve.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_rest_events
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolved_at=now(),
              updated_at=now()
            WHERE sleep_rest_event_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SLEEP_REST_EVENT',id,
            'SLEEP_REST_EVENT_RESOLVED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CLOSE_SLEEP_EVENT': {
          this.requireManager(c);

          const id = c.sleepRestEventId;

          const q = await db.query(
            `
            SELECT *
            FROM sleep_rest_events
            WHERE sleep_rest_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Event not found.');

          if (q.rows[0].state !== 'RESOLVED') {
            throw new BadRequestException(
              'Only RESOLVED event may close.',
            );
          }

          const r = await db.query(
            `
            UPDATE sleep_rest_events
            SET
              state='CLOSED',
              closed_by=$2,
              closed_by_role=$3,
              closed_at=now(),
              updated_at=now()
            WHERE sleep_rest_event_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SLEEP_REST_EVENT',id,
            'SLEEP_REST_EVENT_CLOSED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7U action.',
          );
      }

      await db.query('COMMIT');

      return {
        status: 'OK',
        data: result,
        autonomousClinicalAction: false,
      };
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }
}
