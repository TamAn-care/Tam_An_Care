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
export class PainComfortService {
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
      domain: 'PAIN_COMFORT_SYMPTOM_MANAGEMENT',
      aiRole: 'ADVISORY_ONLY',
      painScoreAutoTreatment: false,
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
        'AI / SYSTEM cannot perform official pain/comfort mutation.',
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
      FROM pain_audit
      WHERE entity_type=$1
        AND entity_id=$2
      `,
      [entityType, entityId],
    );

    await db.query(
      `
      INSERT INTO pain_audit (
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

        case 'CREATE_PAIN_PLAN': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO pain_care_plans (
              pain_care_plan_id,
              resident_id,
              comfort_goals,
              communication_considerations,
              non_pharmacological_preferences,
              known_triggers,
              positioning_preferences,
              status,
              owner_id,
              owner_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.comfortGoals ?? null,
              c.communicationConsiderations ?? null,
              c.nonPharmacologicalPreferences ?? null,
              c.knownTriggers ?? null,
              c.positioningPreferences ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'PAIN_CARE_PLAN',id,
            'PAIN_CARE_PLAN_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'REVIEW_PAIN_PLAN': {
          this.requireManager(c);

          const id = c.painCarePlanId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_care_plans
            WHERE pain_care_plan_id=$1
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
            UPDATE pain_care_plans
            SET
              status='REVIEWED',
              reviewer_id=$2,
              reviewer_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE pain_care_plan_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PAIN_CARE_PLAN',id,
            'PAIN_CARE_PLAN_REVIEWED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_PAIN_PLAN': {
          this.requireManager(c);

          const id = c.painCarePlanId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_care_plans
            WHERE pain_care_plan_id=$1
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
            UPDATE pain_care_plans
            SET
              status='ACTIVE',
              activated_at=now(),
              updated_at=now()
            WHERE pain_care_plan_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            db,residentId,'PAIN_CARE_PLAN',id,
            'PAIN_CARE_PLAN_ACTIVATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_PAIN_ASSESSMENT': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO pain_assessments (
              pain_assessment_id,
              resident_id,
              assessment_method,
              self_report_available,
              pain_location,
              pain_character,
              pain_score,
              observed_pain_behaviors,
              functional_impact,
              additional_context,
              state,
              assessed_by,
              assessed_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              'RECORDED',$11,$12
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.assessmentMethod ?? 'HUMAN_ASSESSMENT',
              c.selfReportAvailable !== false,
              c.painLocation ?? null,
              c.painCharacter ?? null,
              c.painScore ?? null,
              c.observedPainBehaviors ?? null,
              c.functionalImpact ?? null,
              c.additionalContext ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'PAIN_ASSESSMENT',id,
            'PAIN_ASSESSMENT_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_PAIN_ASSESSMENT': {
          this.requireReviewer(c);

          const id = c.painAssessmentId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_assessments
            WHERE pain_assessment_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Assessment not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED assessment may verify.',
            );
          }

          const r = await db.query(
            `
            UPDATE pain_assessments
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE pain_assessment_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PAIN_ASSESSMENT',id,
            'PAIN_ASSESSMENT_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'AMEND_PAIN_ASSESSMENT': {
          this.requireReviewer(c);

          const originalId = c.painAssessmentId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_assessments
            WHERE pain_assessment_id=$1
            FOR UPDATE
            `,
            [originalId],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Assessment not found.');
          }

          if (!['VERIFIED','AMENDED'].includes(q.rows[0].state)) {
            throw new BadRequestException(
              'Only verified assessment history may be amended.',
            );
          }

          if (!c.amendmentReason) {
            throw new BadRequestException(
              'Amendment reason required.',
            );
          }

          const id = randomUUID();
          const o = q.rows[0];

          const r = await db.query(
            `
            INSERT INTO pain_assessments (
              pain_assessment_id,
              resident_id,
              assessment_method,
              self_report_available,
              pain_location,
              pain_character,
              pain_score,
              observed_pain_behaviors,
              functional_impact,
              additional_context,
              state,
              assessed_by,
              assessed_by_role,
              amendment_of,
              amendment_reason
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              'AMENDED',$11,$12,$13,$14
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.assessmentMethod ?? o.assessment_method,
              c.selfReportAvailable ?? o.self_report_available,
              c.painLocation ?? o.pain_location,
              c.painCharacter ?? o.pain_character,
              c.painScore ?? o.pain_score,
              c.observedPainBehaviors ?? o.observed_pain_behaviors,
              c.functionalImpact ?? o.functional_impact,
              c.additionalContext ?? o.additional_context,
              c.actorId,
              c.actorRole,
              originalId,
              c.amendmentReason,
            ],
          );

          await this.audit(
            db,residentId,'PAIN_ASSESSMENT',id,
            'PAIN_ASSESSMENT_AMENDMENT_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_SYMPTOM_OBSERVATION': {
          const id = randomUUID();

          if (!c.observableFacts) {
            throw new BadRequestException(
              'Observable facts required.',
            );
          }

          const r = await db.query(
            `
            INSERT INTO symptom_observations (
              symptom_observation_id,
              resident_id,
              symptom_type,
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
              c.symptomType ?? 'DISCOMFORT',
              c.observableFacts,
              c.residentReport ?? null,
              Boolean(c.baselineChange),
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SYMPTOM_OBSERVATION',id,
            'SYMPTOM_OBSERVATION_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_SYMPTOM_OBSERVATION': {
          this.requireReviewer(c);

          const id = c.symptomObservationId;

          const q = await db.query(
            `
            SELECT *
            FROM symptom_observations
            WHERE symptom_observation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Symptom observation not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED observation may verify.',
            );
          }

          const r = await db.query(
            `
            UPDATE symptom_observations
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE symptom_observation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SYMPTOM_OBSERVATION',id,
            'SYMPTOM_OBSERVATION_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_COMFORT_INTERVENTION': {
          const id = randomUUID();

          const type = String(
            c.interventionType ?? 'REASSURANCE',
          ).toUpperCase();

          if (
            type.includes('MEDICATION') ||
            type.includes('OPIOID') ||
            type.includes('PRN') ||
            type.includes('SEDATION')
          ) {
            throw new BadRequestException(
              'Medication intervention is outside Step 7V.',
            );
          }

          const r = await db.query(
            `
            INSERT INTO comfort_interventions (
              comfort_intervention_id,
              resident_id,
              pain_assessment_id,
              symptom_observation_id,
              intervention_type,
              intervention_notes,
              performed_by,
              performed_by_role,
              state
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,'RECORDED'
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.painAssessmentId ?? null,
              c.symptomObservationId ?? null,
              type,
              c.interventionNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'COMFORT_INTERVENTION',id,
            'COMFORT_INTERVENTION_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_COMFORT_INTERVENTION': {
          this.requireReviewer(c);

          const id = c.comfortInterventionId;

          const q = await db.query(
            `
            SELECT *
            FROM comfort_interventions
            WHERE comfort_intervention_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Comfort intervention not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED intervention may verify.',
            );
          }

          const r = await db.query(
            `
            UPDATE comfort_interventions
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE comfort_intervention_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'COMFORT_INTERVENTION',id,
            'COMFORT_INTERVENTION_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_PAIN_REASSESSMENT': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO pain_reassessments (
              pain_reassessment_id,
              resident_id,
              pain_assessment_id,
              comfort_intervention_id,
              resident_report,
              observable_change,
              pain_score,
              functional_change,
              state,
              reassessed_by,
              reassessed_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,
              'RECORDED',$9,$10
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.painAssessmentId ?? null,
              c.comfortInterventionId ?? null,
              c.residentReport ?? null,
              c.observableChange ?? null,
              c.painScore ?? null,
              c.functionalChange ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'PAIN_REASSESSMENT',id,
            'PAIN_REASSESSMENT_RECORDED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_PAIN_REASSESSMENT': {
          this.requireReviewer(c);

          const id = c.painReassessmentId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_reassessments
            WHERE pain_reassessment_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Reassessment not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED reassessment may verify.',
            );
          }

          const r = await db.query(
            `
            UPDATE pain_reassessments
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE pain_reassessment_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PAIN_REASSESSMENT',id,
            'PAIN_REASSESSMENT_VERIFIED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_PAIN_ALERT': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO pain_safety_alerts (
              pain_safety_alert_id,
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
              c.sourceType ?? 'PAIN_ASSESSMENT',
              c.sourceId ?? null,
              c.alertType ?? 'HUMAN_REVIEW_REQUIRED',
              c.alertNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'PAIN_SAFETY_ALERT',id,
            'PAIN_SAFETY_ALERT_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACKNOWLEDGE_PAIN_ALERT': {
          const id = c.painSafetyAlertId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_safety_alerts
            WHERE pain_safety_alert_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Alert not found.');
          }

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN alert may be acknowledged.',
            );
          }

          const r = await db.query(
            `
            UPDATE pain_safety_alerts
            SET
              state='ACKNOWLEDGED',
              acknowledged_by=$2,
              acknowledged_by_role=$3,
              acknowledged_at=now(),
              updated_at=now()
            WHERE pain_safety_alert_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PAIN_SAFETY_ALERT',id,
            'PAIN_SAFETY_ALERT_ACKNOWLEDGED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_PAIN_ESCALATION': {
          this.requireReviewer(c);

          if (!c.reason) {
            throw new BadRequestException('Escalation reason required.');
          }

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO pain_escalations (
              pain_escalation_id,
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
              c.sourceType ?? 'PAIN_ASSESSMENT',
              c.sourceId ?? null,
              c.reason,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'PAIN_ESCALATION',id,
            'PAIN_ESCALATION_CREATED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_PAIN_ESCALATION': {
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

          const id = c.painEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_escalations
            WHERE pain_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN escalation may be assigned.',
            );
          }

          const r = await db.query(
            `
            UPDATE pain_escalations
            SET
              state='ASSIGNED',
              reviewer_id=$2,
              reviewer_role=$3,
              assigned_by=$4,
              assigned_by_role=$5,
              assigned_at=now(),
              updated_at=now()
            WHERE pain_escalation_id=$1
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
            db,residentId,'PAIN_ESCALATION',id,
            'PAIN_ESCALATION_ASSIGNED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACCEPT_PAIN_ESCALATION': {
          const id = c.painEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_escalations
            WHERE pain_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

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
            UPDATE pain_escalations
            SET
              state='ACCEPTED',
              accepted_by=$2,
              accepted_at=now(),
              updated_at=now()
            WHERE pain_escalation_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'PAIN_ESCALATION',id,
            'PAIN_ESCALATION_ACCEPTED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_PAIN_ESCALATION': {
          const id = c.painEscalationId;

          const q = await db.query(
            `
            SELECT *
            FROM pain_escalations
            WHERE pain_escalation_id=$1
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
            UPDATE pain_escalations
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_notes=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE pain_escalation_id=$1
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
            db,residentId,'PAIN_ESCALATION',id,
            'PAIN_ESCALATION_RESOLVED',c,r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7V action.',
          );
      }

      await db.query('COMMIT');

      return {
        status: 'OK',
        data: result,
        painScoreAutoTreatment: false,
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
