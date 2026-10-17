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
export class SkinWoundService {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
        ? Number(process.env.DB_PORT)
        : undefined,
      user:
        process.env.DB_USER ??
        process.env.POSTGRES_USER,
      password:
        process.env.DB_PASSWORD ??
        process.env.POSTGRES_PASSWORD,
      database:
        process.env.DB_NAME ??
        process.env.POSTGRES_DB,
    });
  }

  summary() {
    return {
      status: 'OK',
      domain: 'SKIN_INTEGRITY_WOUND_PRESSURE_INJURY',
      autonomousClinicalAction: false,
    };
  }

  private requireHuman(c: Cmd) {
    const role = String(c.actorRole || '').toUpperCase();

    if (!c.actorId || !role) {
      throw new BadRequestException(
        'Human actor identity is required.',
      );
    }

    if (role === 'AI' || role === 'SYSTEM') {
      throw new BadRequestException(
        'AI / SYSTEM cannot perform official wound mutation.',
      );
    }
  }

  private requireClinicalHuman(c: Cmd) {
    this.requireHuman(c);

    const role = String(c.actorRole).toUpperCase();

    if (
      ![
        'NURSE',
        'SUPERVISOR',
        'CARE_MANAGER',
      ].includes(role)
    ) {
      throw new BadRequestException(
        'Authorized human clinical role is required.',
      );
    }
  }

  private async audit(
    client: PoolClient,
    residentId: string,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    command: Cmd,
    previousState: any,
    newState: any,
  ) {
    const seq = await client.query(
      `
      SELECT COALESCE(MAX(event_sequence),0)+1 AS next
      FROM wound_audit
      WHERE aggregate_type=$1
        AND aggregate_id=$2
      `,
      [aggregateType, aggregateId],
    );

    await client.query(
      `
      INSERT INTO wound_audit (
        audit_id,
        event_sequence,
        resident_id,
        aggregate_type,
        aggregate_id,
        event_type,
        actor_id,
        actor_role,
        previous_state,
        new_state
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        randomUUID(),
        Number(seq.rows[0].next),
        residentId,
        aggregateType,
        aggregateId,
        eventType,
        command.actorId,
        command.actorRole,
        previousState
          ? JSON.stringify(previousState)
          : null,
        newState
          ? JSON.stringify(newState)
          : null,
      ],
    );
  }

  async execute(
    residentId: string,
    command: Cmd,
  ) {
    this.requireHuman(command);

    const action = String(
      command.action || '',
    ).toUpperCase();

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      let result: any;

      switch (action) {
        case 'CREATE_SKIN_ASSESSMENT': {
          this.requireClinicalHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO skin_assessments (
              skin_assessment_id,
              resident_id,
              assessment_type,
              assessment_context,
              skin_condition_summary,
              risk_factors,
              pressure_area_observation,
              mobility_related_risk,
              moisture_related_risk,
              nutrition_related_risk,
              status,
              created_by,
              created_by_role
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
              command.assessmentType ??
                'SKIN_INTEGRITY',
              command.assessmentContext ?? null,
              command.skinConditionSummary ?? null,
              command.riskFactors
                ? JSON.stringify(command.riskFactors)
                : null,
              command.pressureAreaObservation ?? null,
              command.mobilityRelatedRisk ?? null,
              command.moistureRelatedRisk ?? null,
              command.nutritionRelatedRisk ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'SKIN_ASSESSMENT',
            id,
            'SKIN_ASSESSMENT_CREATED',
            command,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_SKIN_ASSESSMENT': {
          this.requireClinicalHuman(command);

          const id = command.skinAssessmentId;

          const q = await client.query(
            `
            SELECT *
            FROM skin_assessments
            WHERE skin_assessment_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Skin assessment not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT skin assessment may be verified.',
            );
          }

          const r = await client.query(
            `
            UPDATE skin_assessments
            SET
              status='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE skin_assessment_id=$1
            RETURNING *
            `,
            [
              id,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'SKIN_ASSESSMENT',
            id,
            'SKIN_ASSESSMENT_VERIFIED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'AMEND_SKIN_ASSESSMENT': {
          this.requireClinicalHuman(command);

          const id = command.skinAssessmentId;

          if (!command.amendmentReason) {
            throw new BadRequestException(
              'amendmentReason is required.',
            );
          }

          const q = await client.query(
            `
            SELECT *
            FROM skin_assessments
            WHERE skin_assessment_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Skin assessment not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'VERIFIED') {
            throw new BadRequestException(
              'Only VERIFIED assessment may be amended.',
            );
          }

          await client.query(
            `
            UPDATE skin_assessments
            SET status='AMENDED'
            WHERE skin_assessment_id=$1
            `,
            [id],
          );

          const replacement = randomUUID();

          const r = await client.query(
            `
            INSERT INTO skin_assessments (
              skin_assessment_id,
              resident_id,
              assessment_type,
              assessment_context,
              skin_condition_summary,
              risk_factors,
              pressure_area_observation,
              mobility_related_risk,
              moisture_related_risk,
              nutrition_related_risk,
              status,
              created_by,
              created_by_role,
              amends_assessment_id,
              amendment_reason
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              'DRAFT',$11,$12,$13,$14
            )
            RETURNING *
            `,
            [
              replacement,
              residentId,
              command.assessmentType ??
                before.assessment_type,
              command.assessmentContext ??
                before.assessment_context,
              command.skinConditionSummary ??
                before.skin_condition_summary,
              command.riskFactors
                ? JSON.stringify(command.riskFactors)
                : before.risk_factors,
              command.pressureAreaObservation ??
                before.pressure_area_observation,
              command.mobilityRelatedRisk ??
                before.mobility_related_risk,
              command.moistureRelatedRisk ??
                before.moisture_related_risk,
              command.nutritionRelatedRisk ??
                before.nutrition_related_risk,
              command.actorId,
              command.actorRole,
              id,
              command.amendmentReason,
            ],
          );

          await this.audit(
            client,
            residentId,
            'SKIN_ASSESSMENT',
            id,
            'SKIN_ASSESSMENT_AMENDED',
            command,
            before,
            {
              originalStatus: 'AMENDED',
              replacement: r.rows[0],
            },
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_WOUND': {
          this.requireClinicalHuman(command);

          if (
            !command.woundType ||
            !command.anatomicalLocation
          ) {
            throw new BadRequestException(
              'woundType and anatomicalLocation are required.',
            );
          }

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO wound_records (
              wound_record_id,
              resident_id,
              source_skin_assessment_id,
              wound_type,
              anatomical_location,
              human_classification,
              description,
              onset_or_discovery_at,
              status,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,
              COALESCE($8::timestamptz,now()),
              'OPEN',$9,$10
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              command.skinAssessmentId ?? null,
              command.woundType,
              command.anatomicalLocation,
              command.humanClassification ?? null,
              command.description ?? null,
              command.onsetOrDiscoveryAt ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND',
            id,
            'WOUND_CREATED',
            command,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_WOUND': {
          this.requireClinicalHuman(command);

          const id = command.woundRecordId;

          if (!command.humanClassification) {
            throw new BadRequestException(
              'Human wound classification is required.',
            );
          }

          const q = await client.query(
            `
            SELECT *
            FROM wound_records
            WHERE wound_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Wound record not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN wound may be verified.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_records
            SET
              status='VERIFIED',
              human_classification=$2,
              verified_by=$3,
              verified_by_role=$4,
              verified_at=now(),
              updated_at=now()
            WHERE wound_record_id=$1
            RETURNING *
            `,
            [
              id,
              command.humanClassification,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND',
            id,
            'WOUND_VERIFIED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_WOUND': {
          this.requireClinicalHuman(command);

          const id = command.woundRecordId;

          const q = await client.query(
            `
            SELECT *
            FROM wound_records
            WHERE wound_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Wound not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'VERIFIED') {
            throw new BadRequestException(
              'Only VERIFIED wound may become ACTIVE.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_records
            SET status='ACTIVE',
                updated_at=now()
            WHERE wound_record_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            client,
            residentId,
            'WOUND',
            id,
            'WOUND_ACTIVATED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_CARE_PLAN': {
          this.requireClinicalHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO wound_care_plans (
              wound_care_plan_id,
              wound_record_id,
              resident_id,
              plan_status,
              care_goal,
              approved_treatment_instruction,
              approved_dressing_instruction,
              approved_prevention_instruction,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,'DRAFT',$4,$5,$6,$7,$8,$9
            )
            RETURNING *
            `,
            [
              id,
              command.woundRecordId,
              residentId,
              command.careGoal ?? null,
              command.treatmentInstruction ?? null,
              command.dressingInstruction ?? null,
              command.preventionInstruction ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_CARE_PLAN',
            id,
            'WOUND_CARE_PLAN_CREATED',
            command,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_CARE_PLAN': {
          this.requireClinicalHuman(command);

          const id = command.woundCarePlanId;

          const q = await client.query(
            `
            SELECT *
            FROM wound_care_plans
            WHERE wound_care_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Wound care plan not found.',
            );
          }

          const before = q.rows[0];

          if (before.plan_status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT care plan may activate.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_care_plans
            SET
              plan_status='ACTIVE',
              approved_by=$2,
              approved_by_role=$3,
              approved_at=now(),
              effective_from=now(),
              updated_at=now()
            WHERE wound_care_plan_id=$1
            RETURNING *
            `,
            [
              id,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_CARE_PLAN',
            id,
            'WOUND_CARE_PLAN_ACTIVATED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_TREATMENT': {
          this.requireHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO wound_treatment_records (
              wound_treatment_record_id,
              wound_record_id,
              wound_care_plan_id,
              resident_id,
              treatment_type,
              treatment_note,
              dressing_note,
              performed_by,
              performed_by_role,
              verification_required
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
            )
            RETURNING *
            `,
            [
              id,
              command.woundRecordId,
              command.woundCarePlanId ?? null,
              residentId,
              command.treatmentType ??
                'WOUND_CARE',
              command.treatmentNote ?? null,
              command.dressingNote ?? null,
              command.actorId,
              command.actorRole,
              Boolean(command.verificationRequired),
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_TREATMENT',
            id,
            'WOUND_TREATMENT_RECORDED',
            command,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_TREATMENT': {
          this.requireClinicalHuman(command);

          const id =
            command.woundTreatmentRecordId;

          const q = await client.query(
            `
            SELECT *
            FROM wound_treatment_records
            WHERE wound_treatment_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Treatment record not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED treatment may verify.',
            );
          }

          if (
            before.verification_required &&
            before.performed_by === command.actorId
          ) {
            throw new BadRequestException(
              'Independent human checker required.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_treatment_records
            SET
              status='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE wound_treatment_record_id=$1
            RETURNING *
            `,
            [
              id,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_TREATMENT',
            id,
            'WOUND_TREATMENT_VERIFIED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_REPOSITIONING': {
          this.requireHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO repositioning_records (
              repositioning_record_id,
              resident_id,
              wound_record_id,
              scheduled_or_indicated_at,
              position_or_action,
              support_device,
              status
            )
            VALUES (
              $1,$2,$3,
              COALESCE($4::timestamptz,now()),
              $5,$6,'SCHEDULED'
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              command.woundRecordId ?? null,
              command.scheduledAt ?? null,
              command.positionOrAction ?? null,
              command.supportDevice ?? null,
            ],
          );

          await this.audit(
            client,
            residentId,
            'REPOSITIONING',
            id,
            'REPOSITIONING_CREATED',
            command,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'COMPLETE_REPOSITIONING':
        case 'MISS_REPOSITIONING':
        case 'REFUSE_REPOSITIONING':
        case 'HOLD_REPOSITIONING':
        case 'CANCEL_REPOSITIONING': {
          this.requireHuman(command);

          const id =
            command.repositioningRecordId;

          const q = await client.query(
            `
            SELECT *
            FROM repositioning_records
            WHERE repositioning_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Repositioning record not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'SCHEDULED') {
            throw new BadRequestException(
              'Only SCHEDULED repositioning may transition.',
            );
          }

          const map: Record<string,string> = {
            COMPLETE_REPOSITIONING:'COMPLETED',
            MISS_REPOSITIONING:'MISSED',
            REFUSE_REPOSITIONING:'REFUSED',
            HOLD_REPOSITIONING:'HELD',
            CANCEL_REPOSITIONING:'CANCELLED',
          };

          const next = map[action];

          const r = await client.query(
            `
            UPDATE repositioning_records
            SET
              status=$2,
              performed_at=
                CASE WHEN $2='COMPLETED'
                     THEN now()
                     ELSE performed_at END,
              performed_by=$3,
              performed_by_role=$4,
              exception_reason=$5
            WHERE repositioning_record_id=$1
            RETURNING *
            `,
            [
              id,
              next,
              command.actorId,
              command.actorRole,
              command.exceptionReason ?? null,
            ],
          );

          await this.audit(
            client,
            residentId,
            'REPOSITIONING',
            id,
            `REPOSITIONING_${next}`,
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_PROGRESS': {
          this.requireClinicalHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO wound_progress_records (
              wound_progress_record_id,
              wound_record_id,
              resident_id,
              appearance_observation,
              size_observation,
              exudate_observation,
              surrounding_skin_observation,
              pain_observation,
              other_observation,
              status,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,
              'RECORDED',$10,$11
            )
            RETURNING *
            `,
            [
              id,
              command.woundRecordId,
              residentId,
              command.appearanceObservation ?? null,
              command.sizeObservation ?? null,
              command.exudateObservation ?? null,
              command.surroundingSkinObservation ?? null,
              command.painObservation ?? null,
              command.otherObservation ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_PROGRESS',
            id,
            'WOUND_PROGRESS_RECORDED',
            command,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_PROGRESS': {
          this.requireClinicalHuman(command);

          const id =
            command.woundProgressRecordId;

          const q = await client.query(
            `
            SELECT *
            FROM wound_progress_records
            WHERE wound_progress_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Progress record not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED progress may verify.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_progress_records
            SET
              status='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE wound_progress_record_id=$1
            RETURNING *
            `,
            [
              id,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_PROGRESS',
            id,
            'WOUND_PROGRESS_VERIFIED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_ESCALATION': {
          this.requireClinicalHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO wound_escalations (
              wound_escalation_id,
              wound_record_id,
              resident_id,
              reason,
              severity,
              status,
              escalated_by,
              escalated_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'OPEN',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              command.woundRecordId,
              residentId,
              command.reason,
              command.severity ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_ESCALATION',
            id,
            'WOUND_ESCALATION_CREATED',
            command,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_ESCALATION': {
          this.requireClinicalHuman(command);

          const id =
            command.woundEscalationId;

          if (
            !command.assignedReviewer ||
            !command.assignedReviewerRole
          ) {
            throw new BadRequestException(
              'Human reviewer required.',
            );
          }

          if (
            ['AI','SYSTEM'].includes(
              String(
                command.assignedReviewerRole,
              ).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'AI / SYSTEM reviewer denied.',
            );
          }

          const q = await client.query(
            `
            SELECT *
            FROM wound_escalations
            WHERE wound_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Escalation not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN escalation may assign.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_escalations
            SET
              status='ASSIGNED',
              assigned_reviewer=$2,
              assigned_reviewer_role=$3,
              assigned_at=now(),
              updated_at=now()
            WHERE wound_escalation_id=$1
            RETURNING *
            `,
            [
              id,
              command.assignedReviewer,
              command.assignedReviewerRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_ESCALATION',
            id,
            'WOUND_ESCALATION_ASSIGNED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACCEPT_ESCALATION': {
          this.requireHuman(command);

          const id =
            command.woundEscalationId;

          const q = await client.query(
            `
            SELECT *
            FROM wound_escalations
            WHERE wound_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Escalation not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED escalation may accept.',
            );
          }

          if (
            before.assigned_reviewer !==
            command.actorId
          ) {
            throw new BadRequestException(
              'Only assigned human reviewer may accept.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_escalations
            SET
              status='ACCEPTED',
              accepted_at=now(),
              updated_at=now()
            WHERE wound_escalation_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_ESCALATION',
            id,
            'WOUND_ESCALATION_ACCEPTED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_ESCALATION': {
          this.requireHuman(command);

          const id =
            command.woundEscalationId;

          const q = await client.query(
            `
            SELECT *
            FROM wound_escalations
            WHERE wound_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Escalation not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'ACCEPTED') {
            throw new BadRequestException(
              'Only ACCEPTED escalation may resolve.',
            );
          }

          if (
            before.assigned_reviewer !==
            command.actorId
          ) {
            throw new BadRequestException(
              'Only assigned reviewer may resolve.',
            );
          }

          const r = await client.query(
            `
            UPDATE wound_escalations
            SET
              status='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolved_at=now(),
              resolution_summary=$4,
              updated_at=now()
            WHERE wound_escalation_id=$1
            RETURNING *
            `,
            [
              id,
              command.actorId,
              command.actorRole,
              command.resolutionSummary ?? null,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WOUND_ESCALATION',
            id,
            'WOUND_ESCALATION_RESOLVED',
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_WOUND':
        case 'CLOSE_WOUND': {
          this.requireClinicalHuman(command);

          const id = command.woundRecordId;

          const q = await client.query(
            `
            SELECT *
            FROM wound_records
            WHERE wound_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Wound not found.',
            );
          }

          const before = q.rows[0];

          if (
            action === 'RESOLVE_WOUND' &&
            before.status !== 'ACTIVE'
          ) {
            throw new BadRequestException(
              'Only ACTIVE wound may resolve.',
            );
          }

          if (
            action === 'CLOSE_WOUND' &&
            before.status !== 'RESOLVED'
          ) {
            throw new BadRequestException(
              'Only RESOLVED wound may close.',
            );
          }

          const next =
            action === 'RESOLVE_WOUND'
              ? 'RESOLVED'
              : 'CLOSED';

          const r = await client.query(
            `
            UPDATE wound_records
            SET
              status=$2,
              resolved_at=
                CASE WHEN $2='RESOLVED'
                     THEN now()
                     ELSE resolved_at END,
              closed_at=
                CASE WHEN $2='CLOSED'
                     THEN now()
                     ELSE closed_at END,
              updated_at=now()
            WHERE wound_record_id=$1
            RETURNING *
            `,
            [id, next],
          );

          await this.audit(
            client,
            residentId,
            'WOUND',
            id,
            `WOUND_${next}`,
            command,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7R action.',
          );
      }

      await client.query('COMMIT');

      return {
        status: 'OK',
        data: result,
        autonomousClinicalAction: false,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
