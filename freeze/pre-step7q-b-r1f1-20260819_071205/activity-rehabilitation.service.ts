import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { DatabaseService } from '../database/database.service';

import {
  RehabCommand,
} from './activity-rehabilitation.types';

import {
  ActivityRehabilitationAuthorizationService,
} from './activity-rehabilitation-authorization.service';

@Injectable()
export class ActivityRehabilitationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authorization: ActivityRehabilitationAuthorizationService,
  ) {}

  private async audit(
    client: any,
    residentId: string | null,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    command: RehabCommand,
    previousState: unknown,
    newState: unknown,
  ) {
    const seqResult = await client.query(
      `
      SELECT COALESCE(MAX(event_sequence),0) + 1 AS next_seq
      FROM rehabilitation_audit
      WHERE aggregate_type=$1
        AND aggregate_id=$2
      `,
      [aggregateType, aggregateId],
    );

    const seq = Number(seqResult.rows[0].next_seq);

    await client.query(
      `
      INSERT INTO rehabilitation_audit (
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
      `,
      [
        randomUUID(),
        seq,
        residentId,
        aggregateType,
        aggregateId,
        eventType,
        command.actorId,
        command.actorRole,
        JSON.stringify(previousState ?? null),
        JSON.stringify(newState ?? null),
      ],
    );
  }

  async summary() {
    return {
      status: 'OK',
      domain: 'ACTIVITIES_REHABILITATION_FUNCTIONAL_SUPPORT',
      autonomousClinicalAction: false,
    };
  }

  async execute(
    residentId: string,
    command: RehabCommand,
  ) {
    const action = String(command.action ?? '')
      .trim()
      .toUpperCase();

    if (!action) {
      throw new BadRequestException('action is required.');
    }

    return this.database.withTransaction(async (client: any) => {

      switch (action) {

        case 'CREATE_PROGRAM': {
          this.authorization.assertManager(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO activity_programs (
              activity_program_id,
              program_code,
              title,
              description,
              activity_category,
              default_support_level,
              default_location,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9
            )
            RETURNING *
            `,
            [
              id,
              `AP-${id}`,
              command.title ?? 'Activity Program',
              command.description ?? null,
              command.activityCategory ?? 'GENERAL',
              command.defaultSupportLevel ?? null,
              command.defaultLocation ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            null,
            'ACTIVITY_PROGRAM',
            id,
            'ACTIVITY_PROGRAM_CREATED',
            command,
            null,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'ACTIVATE_PROGRAM': {
          this.authorization.assertManager(command);

          const id = command.activityProgramId;

          if (!id) {
            throw new BadRequestException(
              'activityProgramId is required.',
            );
          }

          const lock = await client.query(
            `
            SELECT *
            FROM activity_programs
            WHERE activity_program_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Activity Program not found.',
            );
          }

          const before = lock.rows[0];

          if (before.status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT Activity Program can be activated.',
            );
          }

          const r = await client.query(
            `
            UPDATE activity_programs
            SET
              status='ACTIVE',
              approved_by=$2,
              approved_by_role=$3,
              approved_at=now(),
              updated_at=now()
            WHERE activity_program_id=$1
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
            null,
            'ACTIVITY_PROGRAM',
            id,
            'ACTIVITY_PROGRAM_ACTIVATED',
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'CREATE_REHAB_PLAN': {
          this.authorization.assertClinicalHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO rehabilitation_plans (
              rehabilitation_plan_id,
              resident_id,
              plan_code,
              title,
              description,
              goal_summary,
              mobility_precautions,
              transfer_precautions,
              weight_bearing_restriction,
              assistive_device_requirement,
              other_safety_restrictions,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              `RP-${id}`,
              command.title ?? 'Functional Support Plan',
              command.description ?? null,
              command.goalSummary ?? null,
              command.mobilityPrecautions ?? null,
              command.transferPrecautions ?? null,
              command.weightBearingRestriction ?? null,
              command.assistiveDeviceRequirement ?? null,
              command.otherSafetyRestrictions ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'REHABILITATION_PLAN',
            id,
            'REHAB_PLAN_CREATED',
            command,
            null,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'ACTIVATE_REHAB_PLAN': {
          this.authorization.assertManager(command);

          const id = command.rehabilitationPlanId;

          if (!id) {
            throw new BadRequestException(
              'rehabilitationPlanId is required.',
            );
          }

          const lock = await client.query(
            `
            SELECT *
            FROM rehabilitation_plans
            WHERE rehabilitation_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Rehabilitation Plan not found.',
            );
          }

          const before = lock.rows[0];

          if (before.status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT Rehabilitation Plan can be activated.',
            );
          }

          const r = await client.query(
            `
            UPDATE rehabilitation_plans
            SET
              status='ACTIVE',
              approved_by=$2,
              approved_by_role=$3,
              approved_at=now(),
              effective_from=COALESCE(effective_from,now()),
              updated_at=now()
            WHERE rehabilitation_plan_id=$1
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
            'REHABILITATION_PLAN',
            id,
            'REHAB_PLAN_ACTIVATED',
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'CREATE_SESSION': {
          this.authorization.assertSessionCreator(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO activity_sessions (
              activity_session_id,
              resident_id,
              activity_program_id,
              rehabilitation_plan_id,
              session_code,
              session_type,
              scheduled_at,
              location,
              planned_duration_minutes,
              support_level
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              command.activityProgramId ?? null,
              command.rehabilitationPlanId ?? null,
              `AS-${id}`,
              command.sessionType ?? 'GENERAL',
              command.scheduledAt ?? new Date().toISOString(),
              command.location ?? null,
              command.plannedDurationMinutes ?? null,
              command.supportLevel ?? null,
            ],
          );

          await this.audit(
            client,
            residentId,
            'ACTIVITY_SESSION',
            id,
            'SESSION_CREATED',
            command,
            null,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'ASSIGN_SESSION': {
          this.authorization.assertClinicalHuman(command);

          if (!command.activitySessionId) {
            throw new BadRequestException(
              'activitySessionId is required.',
            );
          }

          if (
            !command.assignedTo ||
            !command.assignedRole ||
            ['AI','SYSTEM'].includes(
              String(command.assignedRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'Human session owner is required.',
            );
          }

          const id = command.activitySessionId;

          const lock = await client.query(
            `
            SELECT *
            FROM activity_sessions
            WHERE activity_session_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Activity Session not found.',
            );
          }

          const before = lock.rows[0];

          if (before.status !== 'SCHEDULED') {
            throw new BadRequestException(
              'Only SCHEDULED session can be assigned.',
            );
          }

          const r = await client.query(
            `
            UPDATE activity_sessions
            SET
              status='ASSIGNED',
              assigned_to=$2,
              assigned_role=$3,
              assigned_at=now(),
              updated_at=now()
            WHERE activity_session_id=$1
            RETURNING *
            `,
            [
              id,
              command.assignedTo,
              command.assignedRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'ACTIVITY_SESSION',
            id,
            'SESSION_ASSIGNED',
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'ACCEPT_SESSION':
        case 'READY_SESSION':
        case 'START_SESSION':
        case 'COMPLETE_SESSION':
        case 'MISS_SESSION':
        case 'REFUSE_SESSION':
        case 'HOLD_SESSION':
        case 'CANCEL_SESSION': {
          if (!command.activitySessionId) {
            throw new BadRequestException(
              'activitySessionId is required.',
            );
          }

          const id = command.activitySessionId;

          const lock = await client.query(
            `
            SELECT *
            FROM activity_sessions
            WHERE activity_session_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Activity Session not found.',
            );
          }

          const before = lock.rows[0];

          this.authorization.assertAssignedOwner(
            command,
            before.assigned_to,
          );

          let nextStatus = '';
          let eventType = '';
          let extra = '';

          if (action === 'ACCEPT_SESSION') {
            if (before.status !== 'ASSIGNED') {
              throw new BadRequestException(
                'Only ASSIGNED session can be accepted.',
              );
            }

            nextStatus = 'ACCEPTED';
            eventType = 'SESSION_ACCEPTED';
            extra = 'accepted_at=now(),';
          }

          if (action === 'READY_SESSION') {
            if (before.status !== 'ACCEPTED') {
              throw new BadRequestException(
                'Only ACCEPTED session can become READY.',
              );
            }

            if (command.safetyConfirmed !== true) {
              throw new BadRequestException(
                'Explicit human safety confirmation is required.',
              );
            }

            nextStatus = 'READY';
            eventType = 'SESSION_READY';
            extra = 'safety_checked_at=now(), ready_at=now(),';
          }

          if (action === 'START_SESSION') {
            if (before.status !== 'READY') {
              throw new BadRequestException(
                'Only READY session can start.',
              );
            }

            nextStatus = 'IN_PROGRESS';
            eventType = 'SESSION_STARTED';
            extra = 'started_at=now(),';
          }

          if (action === 'COMPLETE_SESSION') {
            if (before.status !== 'IN_PROGRESS') {
              throw new BadRequestException(
                'Only IN_PROGRESS session can complete.',
              );
            }

            nextStatus = 'COMPLETED';
            eventType = 'SESSION_COMPLETED';
            extra = 'completed_at=now(),';
          }

          if (action === 'MISS_SESSION') {
            if (
              !['ASSIGNED','ACCEPTED','READY'].includes(before.status)
            ) {
              throw new BadRequestException(
                'Session cannot be marked MISSED from current state.',
              );
            }

            nextStatus = 'MISSED';
            eventType = 'SESSION_MISSED';
            extra = 'missed_at=now(),';
          }

          if (action === 'REFUSE_SESSION') {
            if (
              !['ASSIGNED','ACCEPTED','READY'].includes(before.status)
            ) {
              throw new BadRequestException(
                'Session cannot be marked REFUSED from current state.',
              );
            }

            nextStatus = 'REFUSED';
            eventType = 'SESSION_REFUSED';
            extra = 'refused_at=now(),';
          }

          if (action === 'HOLD_SESSION') {
            if (
              ![
                'ASSIGNED',
                'ACCEPTED',
                'READY',
                'IN_PROGRESS',
              ].includes(before.status)
            ) {
              throw new BadRequestException(
                'Session cannot be HELD from current state.',
              );
            }

            nextStatus = 'HELD';
            eventType = 'SESSION_HELD';
            extra = 'held_at=now(),';
          }

          if (action === 'CANCEL_SESSION') {
            if (
              ['COMPLETED','MISSED','REFUSED','HELD','CANCELLED']
                .includes(before.status)
            ) {
              throw new BadRequestException(
                'Terminal session cannot be cancelled.',
              );
            }

            nextStatus = 'CANCELLED';
            eventType = 'SESSION_CANCELLED';
            extra = 'cancelled_at=now(),';
          }

          const r = await client.query(
            `
            UPDATE activity_sessions
            SET
              status=$2,
              ${extra}
              completion_note=COALESCE($3,completion_note),
              exception_reason=COALESCE($4,exception_reason),
              updated_at=now()
            WHERE activity_session_id=$1
            RETURNING *
            `,
            [
              id,
              nextStatus,
              command.completionNote ?? null,
              command.exceptionReason ?? null,
            ],
          );

          await this.audit(
            client,
            residentId,
            'ACTIVITY_SESSION',
            id,
            eventType,
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'RECORD_PARTICIPATION': {
          this.authorization.assertHuman(command);

          if (!command.activitySessionId) {
            throw new BadRequestException(
              'activitySessionId is required.',
            );
          }

          const session = await client.query(
            `
            SELECT *
            FROM activity_sessions
            WHERE activity_session_id=$1
            FOR UPDATE
            `,
            [command.activitySessionId],
          );

          if (!session.rowCount) {
            throw new NotFoundException(
              'Activity Session not found.',
            );
          }

          const s = session.rows[0];

          this.authorization.assertAssignedOwner(
            command,
            s.assigned_to,
          );

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO activity_participation (
              participation_id,
              activity_session_id,
              resident_id,
              attendance_status,
              participation_level,
              assistance_level,
              duration_minutes,
              resident_response,
              observation_note,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            )
            RETURNING *
            `,
            [
              id,
              command.activitySessionId,
              residentId,
              command.attendanceStatus ?? 'ATTENDED',
              command.participationLevel ?? null,
              command.assistanceLevel ?? null,
              command.durationMinutes ?? null,
              command.residentResponse ?? null,
              command.observationNote ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'ACTIVITY_PARTICIPATION',
            id,
            'PARTICIPATION_RECORDED',
            command,
            null,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'VERIFY_PARTICIPATION': {
          this.authorization.assertClinicalHuman(command);

          const id = command.participationId;

          if (!id) {
            throw new BadRequestException(
              'participationId is required.',
            );
          }

          const lock = await client.query(
            `
            SELECT *
            FROM activity_participation
            WHERE participation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Participation record not found.',
            );
          }

          const before = lock.rows[0];

          if (before.record_status !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED participation may be verified.',
            );
          }

          const r = await client.query(
            `
            UPDATE activity_participation
            SET
              record_status='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE participation_id=$1
            RETURNING *
            `,
            [id, command.actorId, command.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'ACTIVITY_PARTICIPATION',
            id,
            'PARTICIPATION_VERIFIED',
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'AMEND_PARTICIPATION': {
          this.authorization.assertClinicalHuman(command);

          const id = command.participationId;

          if (!id || !command.amendmentReason) {
            throw new BadRequestException(
              'participationId and amendmentReason are required.',
            );
          }

          const lock = await client.query(
            `
            SELECT *
            FROM activity_participation
            WHERE participation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Participation record not found.',
            );
          }

          const before = lock.rows[0];

          if (before.record_status !== 'VERIFIED') {
            throw new BadRequestException(
              'Only VERIFIED participation may be amended.',
            );
          }

          await client.query(
            `
            UPDATE activity_participation
            SET record_status='AMENDED'
            WHERE participation_id=$1
            `,
            [id],
          );

          const replacementId = randomUUID();

          const r = await client.query(
            `
            INSERT INTO activity_participation (
              participation_id,
              activity_session_id,
              resident_id,
              attendance_status,
              participation_level,
              assistance_level,
              duration_minutes,
              resident_response,
              observation_note,
              record_status,
              recorded_by,
              recorded_by_role,
              recorded_at,
              amends_participation_id,
              amendment_reason
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,
              'RECORDED',$10,$11,now(),$12,$13
            )
            RETURNING *
            `,
            [
              replacementId,
              before.activity_session_id,
              before.resident_id,
              command.attendanceStatus ??
                before.attendance_status,
              command.participationLevel ??
                before.participation_level,
              command.assistanceLevel ??
                before.assistance_level,
              command.durationMinutes ??
                before.duration_minutes,
              command.residentResponse ??
                before.resident_response,
              command.observationNote ??
                before.observation_note,
              command.actorId,
              command.actorRole,
              id,
              command.amendmentReason,
            ],
          );

          await this.audit(
            client,
            residentId,
            'ACTIVITY_PARTICIPATION',
            id,
            'PARTICIPATION_AMENDED',
            command,
            before,
            {
              originalStatus: 'AMENDED',
              replacement: r.rows[0],
            },
          );

          return r.rows[0];
        }


        case 'CREATE_FUNCTIONAL_ASSESSMENT': {
          this.authorization.assertClinicalHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO functional_assessments (
              functional_assessment_id,
              resident_id,
              activity_session_id,
              assessment_type,
              assessment_context,
              mobility_observation,
              transfer_observation,
              balance_observation,
              endurance_observation,
              functional_support_note,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              command.activitySessionId ?? null,
              command.assessmentType ?? 'FUNCTIONAL_OBSERVATION',
              command.assessmentContext ?? null,
              command.mobilityObservation ?? null,
              command.transferObservation ?? null,
              command.balanceObservation ?? null,
              command.enduranceObservation ?? null,
              command.functionalSupportNote ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'FUNCTIONAL_ASSESSMENT',
            id,
            'FUNCTIONAL_ASSESSMENT_CREATED',
            command,
            null,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'VERIFY_FUNCTIONAL_ASSESSMENT': {
          this.authorization.assertClinicalHuman(command);

          const id = command.functionalAssessmentId;

          if (!id) {
            throw new BadRequestException(
              'functionalAssessmentId is required.',
            );
          }

          const lock = await client.query(
            `
            SELECT *
            FROM functional_assessments
            WHERE functional_assessment_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Functional assessment not found.',
            );
          }

          const before = lock.rows[0];

          if (before.status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT functional assessment may be verified.',
            );
          }

          const r = await client.query(
            `
            UPDATE functional_assessments
            SET
              status='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE functional_assessment_id=$1
            RETURNING *
            `,
            [id, command.actorId, command.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'FUNCTIONAL_ASSESSMENT',
            id,
            'FUNCTIONAL_ASSESSMENT_VERIFIED',
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'CREATE_ESCALATION': {
          this.authorization.assertClinicalHuman(command);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO rehabilitation_escalations (
              rehabilitation_escalation_id,
              resident_id,
              activity_session_id,
              functional_assessment_id,
              reason,
              severity,
              escalated_by,
              escalated_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              command.activitySessionId ?? null,
              command.functionalAssessmentId ?? null,
              command.reason ?? 'Human review required',
              command.severity ?? null,
              command.actorId,
              command.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'REHAB_ESCALATION',
            id,
            'REHAB_ESCALATION_CREATED',
            command,
            null,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'ASSIGN_ESCALATION': {
          this.authorization.assertManager(command);

          const id = command.rehabilitationEscalationId;

          if (
            !id ||
            !command.assignedReviewer ||
            !command.assignedReviewerRole
          ) {
            throw new BadRequestException(
              'Escalation and human reviewer are required.',
            );
          }

          if (
            ['AI','SYSTEM'].includes(
              String(command.assignedReviewerRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'Human reviewer is required.',
            );
          }

          const lock = await client.query(
            `
            SELECT *
            FROM rehabilitation_escalations
            WHERE rehabilitation_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Rehabilitation escalation not found.',
            );
          }

          const before = lock.rows[0];

          if (before.status !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN escalation may be assigned.',
            );
          }

          const r = await client.query(
            `
            UPDATE rehabilitation_escalations
            SET
              status='ASSIGNED',
              assigned_reviewer=$2,
              assigned_reviewer_role=$3,
              assigned_at=now(),
              updated_at=now()
            WHERE rehabilitation_escalation_id=$1
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
            'REHAB_ESCALATION',
            id,
            'REHAB_ESCALATION_ASSIGNED',
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        case 'ACCEPT_ESCALATION':
        case 'RESOLVE_ESCALATION': {
          const id = command.rehabilitationEscalationId;

          if (!id) {
            throw new BadRequestException(
              'rehabilitationEscalationId is required.',
            );
          }

          const lock = await client.query(
            `
            SELECT *
            FROM rehabilitation_escalations
            WHERE rehabilitation_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!lock.rowCount) {
            throw new NotFoundException(
              'Rehabilitation escalation not found.',
            );
          }

          const before = lock.rows[0];

          this.authorization.assertReviewer(
            command,
            before.assigned_reviewer,
          );

          if (action === 'ACCEPT_ESCALATION') {
            if (before.status !== 'ASSIGNED') {
              throw new BadRequestException(
                'Only ASSIGNED escalation may be accepted.',
              );
            }

            const r = await client.query(
              `
              UPDATE rehabilitation_escalations
              SET
                status='ACCEPTED',
                accepted_at=now(),
                updated_at=now()
              WHERE rehabilitation_escalation_id=$1
              RETURNING *
              `,
              [id],
            );

            await this.audit(
              client,
              residentId,
              'REHAB_ESCALATION',
              id,
              'REHAB_ESCALATION_ACCEPTED',
              command,
              before,
              r.rows[0],
            );

            return r.rows[0];
          }

          if (before.status !== 'ACCEPTED') {
            throw new BadRequestException(
              'Only ACCEPTED escalation may be resolved.',
            );
          }

          const r = await client.query(
            `
            UPDATE rehabilitation_escalations
            SET
              status='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolved_at=now(),
              resolution_summary=$4,
              updated_at=now()
            WHERE rehabilitation_escalation_id=$1
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
            'REHAB_ESCALATION',
            id,
            'REHAB_ESCALATION_RESOLVED',
            command,
            before,
            r.rows[0],
          );

          return r.rows[0];
        }


        default:
          throw new BadRequestException(
            `Unsupported rehabilitation action: ${action}`,
          );
      }
    });
  }
}
