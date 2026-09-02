import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';
import { OperationalWorkProjectionService } from '../operational-work/operational-work-projection.service';

type Cmd = {
  action: string;
  actorId: string;
  actorRole: string;
  [key: string]: any;
};

@Injectable()
export class PersonalCareService {
  private readonly pool: Pool;

  constructor(
    private readonly operationalWorkProjection: OperationalWorkProjectionService,
) {
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
      domain: 'PERSONAL_HYGIENE_BATHING_TOILETING_CONTINENCE',
      autonomousClinicalAction: false,
    };
  }

  private requireHuman(c: Cmd) {
    const role = String(c.actorRole || '').toUpperCase();

    if (!c.actorId || !role) {
      throw new BadRequestException('Human actor identity is required.');
    }

    if (role === 'AI' || role === 'SYSTEM') {
      throw new BadRequestException(
        'AI / SYSTEM cannot perform official personal-care mutation.',
      );
    }
  }

  private requireManager(c: Cmd) {
    this.requireHuman(c);
    const role = String(c.actorRole).toUpperCase();

    if (!['SUPERVISOR','CARE_MANAGER'].includes(role)) {
      throw new BadRequestException('Supervisor or Care Manager required.');
    }
  }

  private requireClinicalHuman(c: Cmd) {
    this.requireHuman(c);
    const role = String(c.actorRole).toUpperCase();

    if (!['NURSE','SUPERVISOR','CARE_MANAGER'].includes(role)) {
      throw new BadRequestException(
        'Authorized human clinical reviewer required.',
      );
    }
  }

  private async audit(
    client: PoolClient,
    residentId: string,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    c: Cmd,
    previousState: any,
    newState: any,
  ) {
    const seq = await client.query(
      `
      SELECT COALESCE(MAX(event_sequence),0)+1 AS next
      FROM personal_care_audit
      WHERE aggregate_type=$1
        AND aggregate_id=$2
      `,
      [aggregateType, aggregateId],
    );

    await client.query(
      `
      INSERT INTO personal_care_audit (
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        randomUUID(),
        Number(seq.rows[0].next),
        residentId,
        aggregateType,
        aggregateId,
        eventType,
        c.actorId,
        c.actorRole,
        previousState ? JSON.stringify(previousState) : null,
        newState ? JSON.stringify(newState) : null,
      ],
    );
  }

  async execute(residentId: string, c: Cmd) {
    this.requireHuman(c);

    const action = String(c.action || '').toUpperCase();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      let result: any;

      switch (action) {
        case 'CREATE_CARE_PLAN': {
          this.requireClinicalHuman(c);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO hygiene_care_plans (
              hygiene_care_plan_id,
              resident_id,
              care_plan_type,
              bathing_support,
              oral_hygiene_support,
              grooming_support,
              toileting_support,
              continence_support,
              privacy_preferences,
              mobility_support_required,
              transfer_support_required,
              fall_precautions,
              skin_precautions,
              status,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
              'DRAFT',$14,$15
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.carePlanType ?? 'PERSONAL_CARE',
              c.bathingSupport ?? null,
              c.oralHygieneSupport ?? null,
              c.groomingSupport ?? null,
              c.toiletingSupport ?? null,
              c.continenceSupport ?? null,
              c.privacyPreferences ?? null,
              Boolean(c.mobilitySupportRequired),
              Boolean(c.transferSupportRequired),
              c.fallPrecautions ?? null,
              c.skinPrecautions ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_CARE_PLAN',
            id,
            'HYGIENE_CARE_PLAN_CREATED',
            c,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_CARE_PLAN': {
          this.requireManager(c);

          const id = c.hygieneCarePlanId;

          const q = await client.query(
            `
            SELECT *
            FROM hygiene_care_plans
            WHERE hygiene_care_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Hygiene care plan not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT hygiene care plan may activate.',
            );
          }

          const r = await client.query(
            `
            UPDATE hygiene_care_plans
            SET
              status='ACTIVE',
              approved_by=$2,
              approved_by_role=$3,
              approved_at=now(),
              updated_at=now()
            WHERE hygiene_care_plan_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_CARE_PLAN',
            id,
            'HYGIENE_CARE_PLAN_ACTIVATED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_SCHEDULE': {
          this.requireHuman(c);

          if (!c.hygieneCarePlanId || !c.careType) {
            throw new BadRequestException(
              'hygieneCarePlanId and careType are required.',
            );
          }

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO hygiene_schedules (
              hygiene_schedule_id,
              resident_id,
              hygiene_care_plan_id,
              care_type,
              scheduled_at,
              status,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,
              COALESCE($5::timestamptz,now()),
              'SCHEDULED',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.hygieneCarePlanId,
              c.careType,
              c.scheduledAt ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_SCHEDULE',
            id,
            'HYGIENE_SCHEDULE_CREATED',
            c,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_SCHEDULE': {
          this.requireManager(c);

          if (
            !c.assignedTo ||
            !c.assignedRole ||
            ['AI','SYSTEM'].includes(
              String(c.assignedRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'Authorized human assignee is required.',
            );
          }

          const id = c.hygieneScheduleId;

          const q = await client.query(
            `
            SELECT *
            FROM hygiene_schedules
            WHERE hygiene_schedule_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Hygiene schedule not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'SCHEDULED') {
            throw new BadRequestException(
              'Only SCHEDULED care may be assigned.',
            );
          }

          const r = await client.query(
            `
            UPDATE hygiene_schedules
            SET
              status='ASSIGNED',
              assigned_to=$2,
              assigned_role=$3,
              assigned_at=now(),
              updated_at=now()
            WHERE hygiene_schedule_id=$1
            RETURNING *
            `,
            [id,c.assignedTo,c.assignedRole],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_SCHEDULE',
            id,
            'HYGIENE_SCHEDULE_ASSIGNED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACCEPT_SCHEDULE': {
          this.requireHuman(c);

          const id = c.hygieneScheduleId;

          const q = await client.query(
            `
            SELECT *
            FROM hygiene_schedules
            WHERE hygiene_schedule_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Hygiene schedule not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED care may be accepted.',
            );
          }

          if (before.assigned_to !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human owner may accept.',
            );
          }

          const r = await client.query(
            `
            UPDATE hygiene_schedules
            SET
              status='ACCEPTED',
              accepted_at=now(),
              updated_at=now()
            WHERE hygiene_schedule_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_SCHEDULE',
            id,
            'HYGIENE_SCHEDULE_ACCEPTED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'READY_SCHEDULE': {
          this.requireHuman(c);

          const id = c.hygieneScheduleId;

          const q = await client.query(
            `
            SELECT s.*, p.mobility_support_required,
                     p.transfer_support_required
            FROM hygiene_schedules s
            JOIN hygiene_care_plans p
              ON p.hygiene_care_plan_id=s.hygiene_care_plan_id
            WHERE s.hygiene_schedule_id=$1
            FOR UPDATE OF s
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Hygiene schedule not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'ACCEPTED') {
            throw new BadRequestException(
              'Only ACCEPTED care may become READY.',
            );
          }

          if (before.assigned_to !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human owner may confirm READY.',
            );
          }

          if (!c.privacyConfirmed) {
            throw new BadRequestException('Privacy confirmation required.');
          }

          if (!c.consentConfirmed) {
            throw new BadRequestException(
              'Human consent / cooperation confirmation required.',
            );
          }

          if (
            before.mobility_support_required &&
            !c.mobilitySupportConfirmed
          ) {
            throw new BadRequestException(
              'Required mobility support is not confirmed.',
            );
          }

          if (
            before.transfer_support_required &&
            !c.transferSupportConfirmed
          ) {
            throw new BadRequestException(
              'Required transfer support is not confirmed.',
            );
          }

          if (!c.fallPrecautionsConfirmed) {
            throw new BadRequestException(
              'Fall precaution confirmation required.',
            );
          }

          const r = await client.query(
            `
            UPDATE hygiene_schedules
            SET
              status='READY',
              ready_at=now(),
              privacy_confirmed=TRUE,
              consent_confirmed=TRUE,
              mobility_support_confirmed=$2,
              transfer_support_confirmed=$3,
              fall_precautions_confirmed=TRUE,
              updated_at=now()
            WHERE hygiene_schedule_id=$1
            RETURNING *
            `,
            [
              id,
              Boolean(c.mobilitySupportConfirmed),
              Boolean(c.transferSupportConfirmed),
            ],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_SCHEDULE',
            id,
            'HYGIENE_SCHEDULE_READY',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'COMPLETE_SCHEDULE':
        case 'MISS_SCHEDULE':
        case 'REFUSE_SCHEDULE':
        case 'HOLD_SCHEDULE':
        case 'CANCEL_SCHEDULE': {
          this.requireHuman(c);

          const id = c.hygieneScheduleId;

          const q = await client.query(
            `
            SELECT *
            FROM hygiene_schedules
            WHERE hygiene_schedule_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Hygiene schedule not found.');
          }

          const before = q.rows[0];

          if (
            action === 'COMPLETE_SCHEDULE' &&
            before.status !== 'READY'
          ) {
            throw new BadRequestException(
              'Only READY care may be completed.',
            );
          }

          if (
            action !== 'COMPLETE_SCHEDULE' &&
            !['ASSIGNED','ACCEPTED','READY'].includes(before.status)
          ) {
            throw new BadRequestException(
              'Current state cannot enter requested terminal outcome.',
            );
          }

          if (
            before.assigned_to &&
            before.assigned_to !== c.actorId &&
            !['SUPERVISOR','CARE_MANAGER'].includes(
              String(c.actorRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'Only assigned human owner or authorized manager may terminate care.',
            );
          }

          const map: Record<string,string> = {
            COMPLETE_SCHEDULE:'COMPLETED',
            MISS_SCHEDULE:'MISSED',
            REFUSE_SCHEDULE:'REFUSED',
            HOLD_SCHEDULE:'HELD',
            CANCEL_SCHEDULE:'CANCELLED',
          };

          const next = map[action];

          const r = await client.query(
            `
            UPDATE hygiene_schedules
            SET
              status=$2,
              completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE completed_at END,
              missed_at=CASE WHEN $2='MISSED' THEN now() ELSE missed_at END,
              refused_at=CASE WHEN $2='REFUSED' THEN now() ELSE refused_at END,
              held_at=CASE WHEN $2='HELD' THEN now() ELSE held_at END,
              cancelled_at=CASE WHEN $2='CANCELLED' THEN now() ELSE cancelled_at END,
              exception_reason=$3,
              updated_at=now()
            WHERE hygiene_schedule_id=$1
            RETURNING *
            `,
            [id,next,c.exceptionReason ?? null],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_SCHEDULE',
            id,
            `HYGIENE_SCHEDULE_${next}`,
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_CARE_RECORD': {
          this.requireHuman(c);

          const id = randomUUID();

          const q = await client.query(
            `
            SELECT *
            FROM hygiene_schedules
            WHERE hygiene_schedule_id=$1
            FOR UPDATE
            `,
            [c.hygieneScheduleId],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Hygiene schedule not found.');
          }

          const schedule = q.rows[0];

          if (schedule.status !== 'COMPLETED') {
            throw new BadRequestException(
              'Official care record requires COMPLETED schedule.',
            );
          }

          if (
            schedule.assigned_to &&
            schedule.assigned_to !== c.actorId
          ) {
            throw new BadRequestException(
              'Only human performer may create official completion record.',
            );
          }

          const r = await client.query(
            `
            INSERT INTO hygiene_care_records (
              hygiene_care_record_id,
              hygiene_schedule_id,
              resident_id,
              care_type,
              outcome,
              care_note,
              resident_response,
              privacy_confirmed,
              consent_confirmed,
              performed_by,
              performed_by_role,
              status
            )
            VALUES (
              $1,$2,$3,$4,'COMPLETED',$5,$6,TRUE,TRUE,$7,$8,'RECORDED'
            )
            RETURNING *
            `,
            [
              id,
              c.hygieneScheduleId,
              residentId,
              schedule.care_type,
              c.careNote ?? null,
              c.residentResponse ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_CARE_RECORD',
            id,
            'HYGIENE_CARE_RECORDED',
            c,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_CARE_RECORD': {
          this.requireClinicalHuman(c);

          const id = c.hygieneCareRecordId;

          const q = await client.query(
            `
            SELECT *
            FROM hygiene_care_records
            WHERE hygiene_care_record_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Hygiene care record not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED care record may verify.',
            );
          }

          const r = await client.query(
            `
            UPDATE hygiene_care_records
            SET
              status='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE hygiene_care_record_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'HYGIENE_CARE_RECORD',
            id,
            'HYGIENE_CARE_VERIFIED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_TOILETING_RECORD': {
          this.requireHuman(c);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO toileting_records (
              toileting_record_id,
              resident_id,
              hygiene_schedule_id,
              assistance_type,
              toileting_outcome,
              transfer_assistance,
              mobility_assistance,
              resident_response,
              performed_by,
              performed_by_role,
              status
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RECORDED'
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.hygieneScheduleId ?? null,
              c.assistanceType ?? null,
              c.toiletingOutcome ?? null,
              c.transferAssistance ?? null,
              c.mobilityAssistance ?? null,
              c.residentResponse ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'TOILETING_RECORD',
            id,
            'TOILETING_RECORDED',
            c,
            null,
            r.rows[0],
          );
          await this.operationalWorkProjection.project(
            client,
            {
              residentId,
              workEventTypeCode: 'TOILETING_ASSISTANCE',
              sourceDomain: 'PERSONAL_CARE',
              sourceEntityType: 'TOILETING_RECORD',
              sourceEntityId: id,
              plannedClassification:
                r.rows[0].hygiene_schedule_id
                  ? 'PLANNED'
                  : 'ADDITIONAL',
              occurredAt: r.rows[0].performed_at,
              completedAt: r.rows[0].performed_at,
              performedBy: r.rows[0].performed_by,
              performedByRole:
                r.rows[0].performed_by_role,
              quantity: 1,
            },
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_CONTINENCE_OBSERVATION': {
          this.requireHuman(c);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO continence_observations (
              continence_observation_id,
              resident_id,
              observation_type,
              observation_note,
              continence_product_used,
              skin_observation,
              change_observed,
              status,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,'RECORDED',$8,$9
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.observationType ?? 'FACTUAL_OBSERVATION',
              c.observationNote ?? null,
              c.continenceProductUsed ?? null,
              c.skinObservation ?? null,
              Boolean(c.changeObserved),
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'CONTINENCE_OBSERVATION',
            id,
            'CONTINENCE_OBSERVATION_RECORDED',
            c,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_CONTINENCE_OBSERVATION': {
          this.requireClinicalHuman(c);

          const id = c.continenceObservationId;

          const q = await client.query(
            `
            SELECT *
            FROM continence_observations
            WHERE continence_observation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Continence observation not found.',
            );
          }

          const before = q.rows[0];

          if (before.status !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED continence observation may verify.',
            );
          }

          const r = await client.query(
            `
            UPDATE continence_observations
            SET
              status='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE continence_observation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'CONTINENCE_OBSERVATION',
            id,
            'CONTINENCE_OBSERVATION_VERIFIED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_ASSISTANCE': {
          this.requireHuman(c);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO personal_care_assistance (
              personal_care_assistance_id,
              resident_id,
              hygiene_schedule_id,
              assistance_type,
              assistance_level,
              mobility_support,
              transfer_support,
              equipment_used,
              performed_by,
              performed_by_role,
              status
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RECORDED'
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.hygieneScheduleId ?? null,
              c.assistanceType ?? 'PERSONAL_CARE',
              c.assistanceLevel ?? null,
              c.mobilitySupport ?? null,
              c.transferSupport ?? null,
              c.equipmentUsed ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'PERSONAL_CARE_ASSISTANCE',
            id,
            'PERSONAL_CARE_ASSISTANCE_RECORDED',
            c,
            null,
            r.rows[0],
          );
          await this.operationalWorkProjection.project(
            client,
            {
              residentId,
              workEventTypeCode:
                'PERSONAL_CARE_ASSISTANCE',
              sourceDomain: 'PERSONAL_CARE',
              sourceEntityType:
                'PERSONAL_CARE_ASSISTANCE',
              sourceEntityId: id,
              plannedClassification:
                r.rows[0].hygiene_schedule_id
                  ? 'PLANNED'
                  : 'ADDITIONAL',
              occurredAt: r.rows[0].performed_at,
              completedAt: r.rows[0].performed_at,
              performedBy: r.rows[0].performed_by,
              performedByRole:
                r.rows[0].performed_by_role,
              quantity: 1,
            },
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_ESCALATION': {
          this.requireHuman(c);

          if (!c.sourceType || !c.sourceId || !c.reason) {
            throw new BadRequestException(
              'sourceType, sourceId and reason are required.',
            );
          }

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO personal_care_escalations (
              personal_care_escalation_id,
              resident_id,
              source_type,
              source_id,
              reason,
              severity,
              status,
              escalated_by,
              escalated_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,'OPEN',$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.sourceType,
              c.sourceId,
              c.reason,
              c.severity ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'PERSONAL_CARE_ESCALATION',
            id,
            'PERSONAL_CARE_ESCALATION_CREATED',
            c,
            null,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_ESCALATION': {
          this.requireManager(c);

          if (
            !c.assignedReviewer ||
            !c.assignedReviewerRole ||
            ['AI','SYSTEM'].includes(
              String(c.assignedReviewerRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'Authorized human reviewer required.',
            );
          }

          const id = c.personalCareEscalationId;

          const q = await client.query(
            `
            SELECT *
            FROM personal_care_escalations
            WHERE personal_care_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN escalation may be assigned.',
            );
          }

          const r = await client.query(
            `
            UPDATE personal_care_escalations
            SET
              status='ASSIGNED',
              assigned_reviewer=$2,
              assigned_reviewer_role=$3,
              assigned_at=now(),
              updated_at=now()
            WHERE personal_care_escalation_id=$1
            RETURNING *
            `,
            [id,c.assignedReviewer,c.assignedReviewerRole],
          );

          await this.audit(
            client,
            residentId,
            'PERSONAL_CARE_ESCALATION',
            id,
            'PERSONAL_CARE_ESCALATION_ASSIGNED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACCEPT_ESCALATION': {
          this.requireHuman(c);

          const id = c.personalCareEscalationId;

          const q = await client.query(
            `
            SELECT *
            FROM personal_care_escalations
            WHERE personal_care_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED escalation may be accepted.',
            );
          }

          if (before.assigned_reviewer !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human reviewer may accept.',
            );
          }

          const r = await client.query(
            `
            UPDATE personal_care_escalations
            SET
              status='ACCEPTED',
              accepted_at=now(),
              updated_at=now()
            WHERE personal_care_escalation_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            client,
            residentId,
            'PERSONAL_CARE_ESCALATION',
            id,
            'PERSONAL_CARE_ESCALATION_ACCEPTED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_ESCALATION': {
          this.requireHuman(c);

          const id = c.personalCareEscalationId;

          const q = await client.query(
            `
            SELECT *
            FROM personal_care_escalations
            WHERE personal_care_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Escalation not found.');
          }

          const before = q.rows[0];

          if (before.status !== 'ACCEPTED') {
            throw new BadRequestException(
              'Only ACCEPTED escalation may be resolved.',
            );
          }

          if (before.assigned_reviewer !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human reviewer may resolve.',
            );
          }

          const r = await client.query(
            `
            UPDATE personal_care_escalations
            SET
              status='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolved_at=now(),
              resolution_summary=$4,
              updated_at=now()
            WHERE personal_care_escalation_id=$1
            RETURNING *
            `,
            [
              id,
              c.actorId,
              c.actorRole,
              c.resolutionSummary ?? null,
            ],
          );

          await this.audit(
            client,
            residentId,
            'PERSONAL_CARE_ESCALATION',
            id,
            'PERSONAL_CARE_ESCALATION_RESOLVED',
            c,
            before,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7S action.',
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
