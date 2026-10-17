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
export class FallMobilityService {
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
      domain: 'FALLS_MOBILITY_TRANSFER_SAFETY',
      aiRole: 'ADVISORY_ONLY',
      fallIsInjuryDiagnosis: false,
      autonomousRestraint: false,
      autonomousMedicationAction: false,
      autonomousHospitalTransfer: false,
      autonomousClinicalAction: false,
    };
  }

  private human(c: Cmd) {
    const role = String(c.actorRole || '').toUpperCase();

    if (!c.actorId || !role) {
      throw new BadRequestException('Human actor identity required.');
    }

    if (role === 'AI' || role === 'SYSTEM') {
      throw new BadRequestException(
        'AI / SYSTEM cannot perform official Step 7Z mutation.',
      );
    }
  }

  private nurse(c: Cmd) {
    this.human(c);

    if (
      ![
        'NURSE',
        'SUPERVISOR',
        'CARE_MANAGER',
      ].includes(String(c.actorRole).toUpperCase())
    ) {
      throw new BadRequestException(
        'Authorized nurse / supervisor required.',
      );
    }
  }

  private manager(c: Cmd) {
    this.human(c);

    if (
      ![
        'SUPERVISOR',
        'CARE_MANAGER',
      ].includes(String(c.actorRole).toUpperCase())
    ) {
      throw new BadRequestException(
        'Supervisor or Care Manager required.',
      );
    }
  }

  private denyUnsafe(action: string) {
    const denied = [
      'DIAGNOSE_FRACTURE',
      'DIAGNOSE_HEAD_INJURY',
      'DIAGNOSE_CONCUSSION',
      'DIAGNOSE_NEUROLOGICAL_INJURY',
      'PRESCRIBE_IMAGING',

      'PRESCRIBE_RESTRAINT',
      'INITIATE_RESTRAINT',
      'RESTRICT_MOBILITY',

      'CREATE_MEDICATION_ORDER',
      'CHANGE_DOSE',
      'SELECT_PRN',
      'HOLD_MEDICATION',
      'ADMINISTER_MEDICATION',

      'ACTIVATE_AMBULANCE',
      'TRANSFER_TO_ED',
      'TRANSFER_TO_HOSPITAL',
      'ADMIT_TO_HOSPITAL',

      'CREATE_CARE_ACTION',
      'CREATE_CARE_TASK',
      'CREATE_INCIDENT',
    ];

    if (denied.includes(action)) {
      throw new BadRequestException(
        'Step 7Z cannot perform autonomous clinical, restraint, medication, transfer, or cross-domain action.',
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
    const next = await db.query(
      `
      SELECT COALESCE(MAX(sequence_no),0)+1 AS n
      FROM fall_audit
      WHERE entity_type=$1
        AND entity_id=$2
      `,
      [entityType,entityId],
    );

    await db.query(
      `
      INSERT INTO fall_audit (
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
        Number(next.rows[0].n),
        JSON.stringify(payload ?? {}),
      ],
    );
  }

  async execute(residentId: string, c: Cmd) {
    this.human(c);

    const action = String(c.action || '').toUpperCase();

    this.denyUnsafe(action);

    const db = await this.pool.connect();

    try {
      await db.query('BEGIN');

      let result: any;

      switch (action) {

        case 'CREATE_FALL_RISK_ASSESSMENT': {
          this.nurse(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO fall_risk_assessments (
              fall_risk_assessment_id,
              resident_id,
              assessment_context,
              observable_risk_factors,
              mobility_observations,
              prior_fall_context,
              environmental_context,
              assessor_id,
              assessor_role
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
              id,
              residentId,
              c.assessmentContext ?? 'Human fall-risk assessment',
              c.observableRiskFactors ?? null,
              c.mobilityObservations ?? null,
              c.priorFallContext ?? null,
              c.environmentalContext ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'FALL_RISK_ASSESSMENT',id,
            'FALL_RISK_ASSESSMENT_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'VERIFY_FALL_RISK_ASSESSMENT': {
          this.nurse(c);

          const id=c.fallRiskAssessmentId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_risk_assessments
            WHERE fall_risk_assessment_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Assessment not found.');
          }

          if (q.rows[0].state !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT assessment may verify.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_risk_assessments
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE fall_risk_assessment_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'FALL_RISK_ASSESSMENT',id,
            'FALL_RISK_ASSESSMENT_VERIFIED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_MOBILITY_PLAN': {
          this.nurse(c);

          if (!c.transferAssistanceLevel) {
            throw new BadRequestException(
              'Human-defined transfer assistance level required.',
            );
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO mobility_support_plans (
              mobility_support_plan_id,
              resident_id,
              mobility_support_needs,
              transfer_assistance_level,
              assistive_device_context,
              environmental_support,
              safety_notes,
              owner_id,
              owner_role
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
              id,
              residentId,
              c.mobilitySupportNeeds ?? 'Human-defined mobility support',
              c.transferAssistanceLevel,
              c.assistiveDeviceContext ?? null,
              c.environmentalSupport ?? null,
              c.safetyNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'MOBILITY_SUPPORT_PLAN',id,
            'MOBILITY_SUPPORT_PLAN_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'REVIEW_MOBILITY_PLAN': {
          this.manager(c);

          const id=c.mobilitySupportPlanId;

          const q=await db.query(
            `
            SELECT *
            FROM mobility_support_plans
            WHERE mobility_support_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT mobility plan may review.',
            );
          }

          const r=await db.query(
            `
            UPDATE mobility_support_plans
            SET
              state='REVIEWED',
              reviewer_id=$2,
              reviewer_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE mobility_support_plan_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MOBILITY_SUPPORT_PLAN',id,
            'MOBILITY_SUPPORT_PLAN_REVIEWED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ACTIVATE_MOBILITY_PLAN': {
          this.manager(c);

          const id=c.mobilitySupportPlanId;

          const q=await db.query(
            `
            SELECT *
            FROM mobility_support_plans
            WHERE mobility_support_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'REVIEWED') {
            throw new BadRequestException(
              'Only REVIEWED mobility plan may activate.',
            );
          }

          const r=await db.query(
            `
            UPDATE mobility_support_plans
            SET
              state='ACTIVE',
              activated_by=$2,
              activated_by_role=$3,
              activated_at=now(),
              updated_at=now()
            WHERE mobility_support_plan_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MOBILITY_SUPPORT_PLAN',id,
            'MOBILITY_SUPPORT_PLAN_ACTIVATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_TRANSFER_SAFETY_CHECK': {
          this.human(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO transfer_safety_checks (
              transfer_safety_check_id,
              resident_id,
              mobility_support_plan_id,
              transfer_context,
              assistance_available,
              assistive_device_context,
              environmental_readiness,
              observable_facts,
              recorded_by,
              recorded_by_role
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *
            `,
            [
              id,
              residentId,
              c.mobilitySupportPlanId ?? null,
              c.transferContext ?? 'Routine transfer',
              c.assistanceAvailable ?? null,
              c.assistiveDeviceContext ?? null,
              c.environmentalReadiness ?? null,
              c.observableFacts ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'TRANSFER_SAFETY_CHECK',id,
            'TRANSFER_SAFETY_CHECK_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'VERIFY_TRANSFER_SAFETY_CHECK': {
          this.nurse(c);

          const id=c.transferSafetyCheckId;

          const q=await db.query(
            `
            SELECT *
            FROM transfer_safety_checks
            WHERE transfer_safety_check_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED transfer check may verify.',
            );
          }

          const r=await db.query(
            `
            UPDATE transfer_safety_checks
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE transfer_safety_check_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'TRANSFER_SAFETY_CHECK',id,
            'TRANSFER_SAFETY_CHECK_VERIFIED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_FALL_EVENT': {
          this.human(c);

          const type=String(c.eventType || '').toUpperCase();

          if (!['FALL','NEAR_FALL'].includes(type)) {
            throw new BadRequestException(
              'eventType must be FALL or NEAR_FALL.',
            );
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO fall_events (
              fall_event_id,
              resident_id,
              event_type,
              occurred_at,
              location_text,
              factual_description,
              witness_context,
              immediate_observable_condition,
              reporter_id,
              reporter_role
            )
            VALUES ($1,$2,$3,now(),$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
              id,
              residentId,
              type,
              c.locationText ?? null,
              c.factualDescription ?? 'Human factual fall-event record',
              c.witnessContext ?? null,
              c.immediateObservableCondition ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'FALL_EVENT',id,
            'FALL_EVENT_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ASSIGN_FALL_EVENT': {
          this.manager(c);

          if (!c.ownerId || !c.ownerRole) {
            throw new BadRequestException('Human owner required.');
          }

          const id=c.fallEventId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_events
            WHERE fall_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN fall event may assign.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_events
            SET
              state='ASSIGNED',
              owner_id=$2,
              owner_role=$3,
              assigned_by=$4,
              assigned_by_role=$5,
              assigned_at=now(),
              updated_at=now()
            WHERE fall_event_id=$1
            RETURNING *
            `,
            [
              id,
              c.ownerId,
              c.ownerRole,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'FALL_EVENT',id,
            'FALL_EVENT_ASSIGNED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ACKNOWLEDGE_FALL_EVENT': {
          const id=c.fallEventId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_events
            WHERE fall_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED event may acknowledge.',
            );
          }

          if (q.rows[0].owner_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human owner may acknowledge event.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_events
            SET
              state='ACKNOWLEDGED',
              acknowledged_by=$2,
              acknowledged_at=now(),
              updated_at=now()
            WHERE fall_event_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'FALL_EVENT',id,
            'FALL_EVENT_ACKNOWLEDGED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_POST_FALL_OBSERVATION': {
          this.human(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO post_fall_observations (
              post_fall_observation_id,
              fall_event_id,
              resident_id,
              observable_facts,
              resident_report,
              mobility_observation,
              pain_report,
              neurological_observation_text,
              recorded_by,
              recorded_by_role
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *
            `,
            [
              id,
              c.fallEventId,
              residentId,
              c.observableFacts ?? 'Human factual observation',
              c.residentReport ?? null,
              c.mobilityObservation ?? null,
              c.painReport ?? null,
              c.neurologicalObservationText ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'POST_FALL_OBSERVATION',id,
            'POST_FALL_OBSERVATION_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'VERIFY_POST_FALL_OBSERVATION': {
          this.nurse(c);

          const id=c.postFallObservationId;

          const q=await db.query(
            `
            SELECT *
            FROM post_fall_observations
            WHERE post_fall_observation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED observation may verify.',
            );
          }

          const r=await db.query(
            `
            UPDATE post_fall_observations
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE post_fall_observation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'POST_FALL_OBSERVATION',id,
            'POST_FALL_OBSERVATION_VERIFIED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }


        case 'AMEND_POST_FALL_OBSERVATION': {
          this.nurse(c);

          const originalId=c.postFallObservationId;

          if (!originalId) {
            throw new BadRequestException(
              'Original post-fall observation required.',
            );
          }

          if (!c.amendmentReason) {
            throw new BadRequestException(
              'Human amendment reason required.',
            );
          }

          /*
           * Lock the verified original only long enough to establish
           * an immutable canonical parent.
           *
           * The original row is NEVER updated.
           * Multiple valid amendments may therefore serialize safely
           * and all remain append-only historical records.
           */
          const q=await db.query(
            `
            SELECT *
            FROM post_fall_observations
            WHERE post_fall_observation_id=$1
            FOR UPDATE
            `,
            [originalId],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Original post-fall observation not found.',
            );
          }

          const original=q.rows[0];

          if (original.state !== 'VERIFIED') {
            throw new BadRequestException(
              'Only VERIFIED post-fall observation may be amended.',
            );
          }

          if (original.resident_id !== residentId) {
            throw new BadRequestException(
              'Resident / observation mismatch.',
            );
          }

          const amendmentId=randomUUID();

          const r=await db.query(
            `
            INSERT INTO post_fall_observations (
              post_fall_observation_id,
              fall_event_id,
              resident_id,
              observable_facts,
              resident_report,
              mobility_observation,
              pain_report,
              neurological_observation_text,
              state,
              recorded_by,
              recorded_by_role,
              amendment_of,
              amendment_reason
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,
              'AMENDED',$9,$10,$11,$12
            )
            RETURNING *
            `,
            [
              amendmentId,
              original.fall_event_id,
              original.resident_id,
              c.observableFacts ?? original.observable_facts,
              c.residentReport ?? original.resident_report,
              c.mobilityObservation ?? original.mobility_observation,
              c.painReport ?? original.pain_report,
              c.neurologicalObservationText
                ?? original.neurological_observation_text,
              c.actorId,
              c.actorRole,
              originalId,
              c.amendmentReason,
            ],
          );

          await this.audit(
            db,
            residentId,
            'POST_FALL_OBSERVATION',
            amendmentId,
            'POST_FALL_OBSERVATION_AMENDED',
            c,
            {
              amendment: r.rows[0],
              originalPostFallObservationId: originalId,
              originalPreserved: true,
            },
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_PREVENTION_ACTION': {
          this.nurse(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO fall_prevention_actions (
              fall_prevention_action_id,
              resident_id,
              fall_event_id,
              action_type,
              action_description,
              necessity_rationale,
              dignity_mobility_impact,
              proposed_by,
              proposed_by_role
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
              id,
              residentId,
              c.fallEventId ?? null,
              c.actionType ?? 'NON_PHARMACOLOGICAL_SUPPORT',
              c.actionDescription ?? 'Human fall-prevention support',
              c.necessityRationale ?? 'Human safety rationale',
              c.dignityMobilityImpact ?? 'Mobility rights preserved',
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'FALL_PREVENTION_ACTION',id,
            'FALL_PREVENTION_ACTION_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'AUTHORIZE_PREVENTION_ACTION': {
          this.manager(c);

          const id=c.fallPreventionActionId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_prevention_actions
            WHERE fall_prevention_action_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'PROPOSED') {
            throw new BadRequestException(
              'Only PROPOSED action may authorize.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_prevention_actions
            SET
              state='AUTHORIZED',
              authorized_by=$2,
              authorized_by_role=$3,
              authorized_at=now(),
              updated_at=now()
            WHERE fall_prevention_action_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'FALL_PREVENTION_ACTION',id,
            'FALL_PREVENTION_ACTION_AUTHORIZED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ACTIVATE_PREVENTION_ACTION': {
          this.manager(c);

          const id=c.fallPreventionActionId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_prevention_actions
            WHERE fall_prevention_action_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'AUTHORIZED') {
            throw new BadRequestException(
              'Only AUTHORIZED action may activate.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_prevention_actions
            SET
              state='ACTIVE',
              activated_by=$2,
              activated_by_role=$3,
              activated_at=now(),
              updated_at=now()
            WHERE fall_prevention_action_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'FALL_PREVENTION_ACTION',id,
            'FALL_PREVENTION_ACTION_ACTIVATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_FALL_ESCALATION': {
          this.nurse(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO fall_escalations (
              fall_escalation_id,
              fall_event_id,
              resident_id,
              reason,
              created_by,
              created_by_role
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING *
            `,
            [
              id,
              c.fallEventId,
              residentId,
              c.reason ?? 'Human escalation',
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'FALL_ESCALATION',id,
            'FALL_ESCALATION_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ASSIGN_FALL_ESCALATION': {
          this.manager(c);

          const id=c.fallEscalationId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_escalations
            WHERE fall_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN escalation may assign.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_escalations
            SET
              state='ASSIGNED',
              reviewer_id=$2,
              reviewer_role=$3,
              assigned_by=$4,
              assigned_by_role=$5,
              assigned_at=now(),
              updated_at=now()
            WHERE fall_escalation_id=$1
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
            db,residentId,'FALL_ESCALATION',id,
            'FALL_ESCALATION_ASSIGNED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ACCEPT_FALL_ESCALATION': {
          const id=c.fallEscalationId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_escalations
            WHERE fall_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED escalation may accept.',
            );
          }

          if (q.rows[0].reviewer_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human reviewer may accept escalation.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_escalations
            SET
              state='ACCEPTED',
              accepted_by=$2,
              accepted_at=now(),
              updated_at=now()
            WHERE fall_escalation_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'FALL_ESCALATION',id,
            'FALL_ESCALATION_ACCEPTED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'RESOLVE_FALL_ESCALATION': {
          const id=c.fallEscalationId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_escalations
            WHERE fall_escalation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'ACCEPTED') {
            throw new BadRequestException(
              'Only ACCEPTED escalation may resolve.',
            );
          }

          if (q.rows[0].reviewer_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned reviewer may resolve escalation.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_escalations
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_notes=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE fall_escalation_id=$1
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
            db,residentId,'FALL_ESCALATION',id,
            'FALL_ESCALATION_RESOLVED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'RESOLVE_FALL_EVENT': {
          this.manager(c);

          const id=c.fallEventId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_events
            WHERE fall_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'ACKNOWLEDGED') {
            throw new BadRequestException(
              'Only ACKNOWLEDGED fall event may resolve.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_events
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_notes=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE fall_event_id=$1
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
            db,residentId,'FALL_EVENT',id,
            'FALL_EVENT_RESOLVED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CLOSE_FALL_EVENT': {
          this.manager(c);

          const id=c.fallEventId;

          const q=await db.query(
            `
            SELECT *
            FROM fall_events
            WHERE fall_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount || q.rows[0].state !== 'RESOLVED') {
            throw new BadRequestException(
              'Only RESOLVED fall event may close.',
            );
          }

          const r=await db.query(
            `
            UPDATE fall_events
            SET
              state='CLOSED',
              closed_by=$2,
              closed_by_role=$3,
              closed_at=now(),
              updated_at=now()
            WHERE fall_event_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'FALL_EVENT',id,
            'FALL_EVENT_CLOSED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7Z action.',
          );
      }

      await db.query('COMMIT');

      return {
        status: 'OK',
        data: result,
        fallIsInjuryDiagnosis: false,
        autonomousRestraint: false,
        autonomousMedicationAction: false,
        autonomousHospitalTransfer: false,
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
