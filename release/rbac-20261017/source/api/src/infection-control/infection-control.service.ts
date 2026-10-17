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
export class InfectionControlService {
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
      domain: 'INFECTION_PREVENTION_SURVEILLANCE_COMMUNICABLE_DISEASE_SAFETY',
      aiRole: 'ADVISORY_ONLY',
      autonomousDiagnosis: false,
      autonomousPrecaution: false,
      autonomousMedication: false,
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
        'AI / SYSTEM cannot perform official infection-domain mutation.',
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
      throw new BadRequestException('Authorized human reviewer required.');
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
      FROM infection_audit
      WHERE entity_type=$1
        AND entity_id=$2
      `,
      [entityType, entityId],
    );

    await db.query(
      `
      INSERT INTO infection_audit (
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

        case 'CREATE_INFECTION_PLAN': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO infection_control_plans (
              infection_control_plan_id,
              resident_id,
              prevention_considerations,
              communication_considerations,
              approved_precaution_guidance,
              monitoring_guidance,
              status,
              owner_id,
              owner_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,'DRAFT',$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.preventionConsiderations ?? null,
              c.communicationConsiderations ?? null,
              c.approvedPrecautionGuidance ?? null,
              c.monitoringGuidance ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'INFECTION_CONTROL_PLAN',id,
            'INFECTION_CONTROL_PLAN_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'REVIEW_INFECTION_PLAN': {
          this.requireManager(c);

          const id = c.infectionControlPlanId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_control_plans
            WHERE infection_control_plan_id=$1
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
            UPDATE infection_control_plans
            SET
              status='REVIEWED',
              reviewer_id=$2,
              reviewer_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE infection_control_plan_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'INFECTION_CONTROL_PLAN',id,
            'INFECTION_CONTROL_PLAN_REVIEWED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_INFECTION_PLAN': {
          this.requireManager(c);

          const id = c.infectionControlPlanId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_control_plans
            WHERE infection_control_plan_id=$1
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
            UPDATE infection_control_plans
            SET
              status='ACTIVE',
              activated_at=now(),
              updated_at=now()
            WHERE infection_control_plan_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            db,residentId,'INFECTION_CONTROL_PLAN',id,
            'INFECTION_CONTROL_PLAN_ACTIVATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_INFECTION_OBSERVATION': {
          const id = randomUUID();

          if (!c.observableFacts) {
            throw new BadRequestException('Observable facts required.');
          }

          const r = await db.query(
            `
            INSERT INTO infection_observations (
              infection_observation_id,
              resident_id,
              observation_type,
              observable_facts,
              resident_report,
              baseline_change,
              state,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,'RECORDED',$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.observationType ?? 'GENERAL_SYMPTOM_OBSERVATION',
              c.observableFacts,
              c.residentReport ?? null,
              Boolean(c.baselineChange),
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'INFECTION_OBSERVATION',id,
            'INFECTION_OBSERVATION_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_INFECTION_OBSERVATION': {
          this.requireReviewer(c);

          const id = c.infectionObservationId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_observations
            WHERE infection_observation_id=$1
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
            UPDATE infection_observations
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE infection_observation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'INFECTION_OBSERVATION',id,
            'INFECTION_OBSERVATION_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_EXPOSURE_EVENT': {
          const id = randomUUID();

          if (!c.exposureContext) {
            throw new BadRequestException('Exposure context required.');
          }

          const r = await db.query(
            `
            INSERT INTO exposure_events (
              exposure_event_id,
              resident_id,
              exposure_type,
              exposure_context,
              exposure_at,
              state,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'OPEN',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.exposureType ?? 'POSSIBLE_CONTACT',
              c.exposureContext,
              c.exposureAt ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'EXPOSURE_EVENT',id,
            'EXPOSURE_EVENT_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'REVIEW_EXPOSURE_EVENT': {
          this.requireReviewer(c);

          const id = c.exposureEventId;

          const q = await db.query(
            `
            SELECT *
            FROM exposure_events
            WHERE exposure_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Exposure not found.');

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN exposure may review.',
            );
          }

          const r = await db.query(
            `
            UPDATE exposure_events
            SET
              state='REVIEWED',
              reviewed_by=$2,
              reviewed_by_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE exposure_event_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'EXPOSURE_EVENT',id,
            'EXPOSURE_EVENT_REVIEWED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_PRECAUTION': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO infection_precautions (
              infection_precaution_id,
              resident_id,
              source_type,
              source_id,
              precaution_type,
              precaution_notes,
              state,
              proposed_by,
              proposed_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,'PROPOSED',$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.sourceType ?? 'INFECTION_OBSERVATION',
              c.sourceId ?? null,
              c.precautionType ?? 'ENHANCED_HAND_HYGIENE',
              c.precautionNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'INFECTION_PRECAUTION',id,
            'INFECTION_PRECAUTION_PROPOSED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'AUTHORIZE_PRECAUTION': {
          this.requireManager(c);

          const id = c.infectionPrecautionId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_precautions
            WHERE infection_precaution_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Precaution not found.');

          if (q.rows[0].state !== 'PROPOSED') {
            throw new BadRequestException(
              'Only PROPOSED precaution may authorize.',
            );
          }

          const r = await db.query(
            `
            UPDATE infection_precautions
            SET
              state='AUTHORIZED',
              authorized_by=$2,
              authorized_by_role=$3,
              authorized_at=now(),
              updated_at=now()
            WHERE infection_precaution_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'INFECTION_PRECAUTION',id,
            'INFECTION_PRECAUTION_AUTHORIZED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_PRECAUTION': {
          this.requireManager(c);

          const id = c.infectionPrecautionId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_precautions
            WHERE infection_precaution_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Precaution not found.');

          if (q.rows[0].state !== 'AUTHORIZED') {
            throw new BadRequestException(
              'Only AUTHORIZED precaution may activate.',
            );
          }

          const r = await db.query(
            `
            UPDATE infection_precautions
            SET
              state='ACTIVE',
              activated_by=$2,
              activated_by_role=$3,
              activated_at=now(),
              updated_at=now()
            WHERE infection_precaution_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'INFECTION_PRECAUTION',id,
            'INFECTION_PRECAUTION_ACTIVATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'DISCONTINUE_PRECAUTION': {
          this.requireManager(c);

          const id = c.infectionPrecautionId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_precautions
            WHERE infection_precaution_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Precaution not found.');

          if (q.rows[0].state !== 'ACTIVE') {
            throw new BadRequestException(
              'Only ACTIVE precaution may discontinue.',
            );
          }

          const r = await db.query(
            `
            UPDATE infection_precautions
            SET
              state='DISCONTINUED',
              discontinued_by=$2,
              discontinued_by_role=$3,
              discontinued_at=now(),
              updated_at=now()
            WHERE infection_precaution_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'INFECTION_PRECAUTION',id,
            'INFECTION_PRECAUTION_DISCONTINUED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_MONITORING_RECORD': {
          const id = randomUUID();

          if (!c.observedFacts) {
            throw new BadRequestException('Observed facts required.');
          }

          const r = await db.query(
            `
            INSERT INTO infection_monitoring_records (
              infection_monitoring_record_id,
              resident_id,
              source_type,
              source_id,
              monitoring_type,
              observed_facts,
              state,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,'RECORDED',$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.sourceType ?? null,
              c.sourceId ?? null,
              c.monitoringType ?? 'INFECTION_SURVEILLANCE',
              c.observedFacts,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'INFECTION_MONITORING',id,
            'INFECTION_MONITORING_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_MONITORING_RECORD': {
          this.requireReviewer(c);

          const id = c.infectionMonitoringRecordId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_monitoring_records
            WHERE infection_monitoring_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Monitoring record not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED monitoring may verify.',
            );
          }

          const r = await db.query(
            `
            UPDATE infection_monitoring_records
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE infection_monitoring_record_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'INFECTION_MONITORING',id,
            'INFECTION_MONITORING_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_INFECTION_ALERT': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO infection_alerts (
              infection_alert_id,
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
              c.sourceType ?? 'INFECTION_OBSERVATION',
              c.sourceId ?? null,
              c.alertType ?? 'HUMAN_REVIEW_REQUIRED',
              c.alertNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'INFECTION_ALERT',id,
            'INFECTION_ALERT_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACKNOWLEDGE_INFECTION_ALERT': {
          const id = c.infectionAlertId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_alerts
            WHERE infection_alert_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) throw new NotFoundException('Alert not found.');

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN alert may acknowledge.',
            );
          }

          const r = await db.query(
            `
            UPDATE infection_alerts
            SET
              state='ACKNOWLEDGED',
              acknowledged_by=$2,
              acknowledged_by_role=$3,
              acknowledged_at=now(),
              updated_at=now()
            WHERE infection_alert_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'INFECTION_ALERT',id,
            'INFECTION_ALERT_ACKNOWLEDGED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_INFECTION_ESCALATION': {
          this.requireReviewer(c);

          if (!c.reason) {
            throw new BadRequestException('Escalation reason required.');
          }

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO infection_escalations (
              infection_escalation_id,
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
              c.sourceType ?? 'INFECTION_ALERT',
              c.sourceId ?? null,
              c.reason,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'INFECTION_ESCALATION',id,
            'INFECTION_ESCALATION_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_INFECTION_ESCALATION': {
          this.requireManager(c);

          if (
            !c.reviewerId ||
            !c.reviewerRole ||
            ['AI','SYSTEM'].includes(String(c.reviewerRole).toUpperCase())
          ) {
            throw new BadRequestException('Human reviewer required.');
          }

          const id = c.infectionEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_escalations
            WHERE infection_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN escalation may assign.',
            );
          }

          const r = await db.query(
            `
            UPDATE infection_escalations
            SET
              state='ASSIGNED',
              reviewer_id=$2,
              reviewer_role=$3,
              assigned_by=$4,
              assigned_by_role=$5,
              assigned_at=now(),
              updated_at=now()
            WHERE infection_escalation_id=$1
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
            db,residentId,'INFECTION_ESCALATION',id,
            'INFECTION_ESCALATION_ASSIGNED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACCEPT_INFECTION_ESCALATION': {
          const id = c.infectionEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_escalations
            WHERE infection_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

          if (q.rows[0].state !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED escalation may accept.',
            );
          }

          if (q.rows[0].reviewer_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human reviewer may accept.',
            );
          }

          const r = await db.query(
            `
            UPDATE infection_escalations
            SET
              state='ACCEPTED',
              accepted_by=$2,
              accepted_at=now(),
              updated_at=now()
            WHERE infection_escalation_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'INFECTION_ESCALATION',id,
            'INFECTION_ESCALATION_ACCEPTED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_INFECTION_ESCALATION': {
          const id = c.infectionEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM infection_escalations
            WHERE infection_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

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
            UPDATE infection_escalations
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_notes=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE infection_escalation_id=$1
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
            db,residentId,'INFECTION_ESCALATION',id,
            'INFECTION_ESCALATION_RESOLVED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7W action.',
          );
      }

      await db.query('COMMIT');

      return {
        status: 'OK',
        data: result,
        autonomousDiagnosis: false,
        autonomousPrecaution: false,
        autonomousMedication: false,
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
