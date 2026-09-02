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
export class MedicationSafetyService {
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
      domain: 'MEDICATION_SAFETY_RECONCILIATION_HIGH_RISK_GOVERNANCE',
      existingMedicationDomainPreserved: true,
      autonomousMedicationAction: false,
      autonomousClinicalAction: false,
      aiRole: 'ADVISORY_ONLY',
    };
  }

  private requireHuman(c: Cmd) {
    const role = String(c.actorRole || '').toUpperCase();

    if (!c.actorId || !role) {
      throw new BadRequestException('Human actor identity required.');
    }

    if (role === 'AI' || role === 'SYSTEM') {
      throw new BadRequestException(
        'AI / SYSTEM cannot perform official medication-safety mutation.',
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
        'Authorized medication-safety reviewer required.',
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

  private rejectMedicationMutation(action: string) {
    const denied = [
      'CREATE_MEDICATION_ORDER',
      'UPDATE_MEDICATION_ORDER',
      'PRESCRIBE_MEDICATION',
      'PRESCRIBE_PRN',
      'SELECT_PRN',
      'CHANGE_DOSE',
      'CHANGE_ROUTE',
      'CHANGE_FREQUENCY',
      'HOLD_MEDICATION',
      'RESUME_MEDICATION',
      'DISCONTINUE_MEDICATION',
      'ADMINISTER_MEDICATION',
      'MARK_ADMINISTERED',
    ];

    if (denied.includes(action)) {
      throw new BadRequestException(
        'Step 7X governance cannot perform medication mutation.',
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
      FROM medication_safety_audit
      WHERE entity_type=$1
        AND entity_id=$2
      `,
      [entityType,entityId],
    );

    await db.query(
      `
      INSERT INTO medication_safety_audit (
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
    this.rejectMedicationMutation(action);

    const db = await this.pool.connect();

    try {
      await db.query('BEGIN');

      let result: any;

      switch (action) {

        case 'CREATE_RECONCILIATION': {
          this.requireReviewer(c);

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO medication_reconciliations (
              medication_reconciliation_id,
              resident_id,
              reconciliation_context,
              source_summary,
              state,
              owner_id,
              owner_role
            )
            VALUES (
              $1,$2,$3,$4,'DRAFT',$5,$6
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.reconciliationContext ?? 'MEDICATION_LIST_REVIEW',
              c.sourceSummary ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_RECONCILIATION',id,
            'RECONCILIATION_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ADD_RECONCILIATION_ITEM': {
          this.requireReviewer(c);

          const reconciliationId=c.medicationReconciliationId;

          const parent=await db.query(
            `
            SELECT *
            FROM medication_reconciliations
            WHERE medication_reconciliation_id=$1
            FOR UPDATE
            `,
            [reconciliationId],
          );

          if (!parent.rowCount) {
            throw new NotFoundException('Reconciliation not found.');
          }

          if (parent.rows[0].state !== 'DRAFT') {
            throw new BadRequestException(
              'Items may be added only while reconciliation is DRAFT.',
            );
          }

          if (!c.medicationNameText) {
            throw new BadRequestException('Medication name text required.');
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO medication_reconciliation_items (
              medication_reconciliation_item_id,
              medication_reconciliation_id,
              resident_id,
              medication_name_text,
              dose_text,
              route_text,
              frequency_text,
              source_text,
              discrepancy_type,
              discrepancy_notes,
              state,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              'RECORDED',$11,$12
            )
            RETURNING *
            `,
            [
              id,
              reconciliationId,
              residentId,
              c.medicationNameText,
              c.doseText ?? null,
              c.routeText ?? null,
              c.frequencyText ?? null,
              c.sourceText ?? null,
              c.discrepancyType ?? null,
              c.discrepancyNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_RECONCILIATION_ITEM',id,
            'RECONCILIATION_ITEM_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'VERIFY_RECONCILIATION_ITEM': {
          this.requireReviewer(c);

          const id=c.medicationReconciliationItemId;

          const q=await db.query(
            `
            SELECT *
            FROM medication_reconciliation_items
            WHERE medication_reconciliation_item_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Reconciliation item not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED reconciliation item may verify.',
            );
          }

          const r=await db.query(
            `
            UPDATE medication_reconciliation_items
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE medication_reconciliation_item_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MEDICATION_RECONCILIATION_ITEM',id,
            'RECONCILIATION_ITEM_VERIFIED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'AMEND_RECONCILIATION_ITEM': {
          this.requireReviewer(c);

          const originalId=c.medicationReconciliationItemId;

          if (!c.amendmentReason) {
            throw new BadRequestException('Amendment reason required.');
          }

          const q=await db.query(
            `
            SELECT *
            FROM medication_reconciliation_items
            WHERE medication_reconciliation_item_id=$1
            FOR UPDATE
            `,
            [originalId],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Reconciliation item not found.');
          }

          if (!['VERIFIED','AMENDED'].includes(q.rows[0].state)) {
            throw new BadRequestException(
              'Only verified history may be amended.',
            );
          }

          const o=q.rows[0];
          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO medication_reconciliation_items (
              medication_reconciliation_item_id,
              medication_reconciliation_id,
              resident_id,
              medication_name_text,
              dose_text,
              route_text,
              frequency_text,
              source_text,
              discrepancy_type,
              discrepancy_notes,
              state,
              recorded_by,
              recorded_by_role,
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
              o.medication_reconciliation_id,
              residentId,
              c.medicationNameText ?? o.medication_name_text,
              c.doseText ?? o.dose_text,
              c.routeText ?? o.route_text,
              c.frequencyText ?? o.frequency_text,
              c.sourceText ?? o.source_text,
              c.discrepancyType ?? o.discrepancy_type,
              c.discrepancyNotes ?? o.discrepancy_notes,
              c.actorId,
              c.actorRole,
              originalId,
              c.amendmentReason,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_RECONCILIATION_ITEM',id,
            'RECONCILIATION_ITEM_AMENDMENT_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'REVIEW_RECONCILIATION': {
          this.requireReviewer(c);

          const id=c.medicationReconciliationId;

          const q=await db.query(
            `
            SELECT *
            FROM medication_reconciliations
            WHERE medication_reconciliation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Reconciliation not found.');
          }

          if (q.rows[0].state !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT reconciliation may review.',
            );
          }

          const r=await db.query(
            `
            UPDATE medication_reconciliations
            SET
              state='REVIEWED',
              reviewer_id=$2,
              reviewer_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE medication_reconciliation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MEDICATION_RECONCILIATION',id,
            'RECONCILIATION_REVIEWED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'COMPLETE_RECONCILIATION': {
          this.requireReviewer(c);

          const id=c.medicationReconciliationId;

          const q=await db.query(
            `
            SELECT *
            FROM medication_reconciliations
            WHERE medication_reconciliation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Reconciliation not found.');
          }

          if (q.rows[0].state !== 'REVIEWED') {
            throw new BadRequestException(
              'Only REVIEWED reconciliation may complete.',
            );
          }

          const r=await db.query(
            `
            UPDATE medication_reconciliations
            SET
              state='COMPLETED',
              completed_by=$2,
              completed_by_role=$3,
              completed_at=now(),
              updated_at=now()
            WHERE medication_reconciliation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MEDICATION_RECONCILIATION',id,
            'RECONCILIATION_COMPLETED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_ORDER_REVIEW': {
          this.requireReviewer(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO medication_order_reviews (
              medication_order_review_id,
              resident_id,
              medication_order_ref,
              review_context,
              review_notes,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'PENDING',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.medicationOrderRef ?? null,
              c.reviewContext ?? 'MEDICATION_ORDER_GOVERNANCE_REVIEW',
              c.reviewNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_ORDER_REVIEW',id,
            'ORDER_REVIEW_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'REVIEW_MEDICATION_ORDER': {
          this.requireReviewer(c);

          const id=c.medicationOrderReviewId;

          const q=await db.query(
            `
            SELECT *
            FROM medication_order_reviews
            WHERE medication_order_review_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Order review not found.');
          }

          if (q.rows[0].state !== 'PENDING') {
            throw new BadRequestException(
              'Only PENDING order review may complete.',
            );
          }

          const r=await db.query(
            `
            UPDATE medication_order_reviews
            SET
              state='REVIEWED',
              reviewed_by=$2,
              reviewed_by_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE medication_order_review_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MEDICATION_ORDER_REVIEW',id,
            'ORDER_REVIEW_COMPLETED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_SAFETY_CHECK': {
          this.requireReviewer(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO medication_safety_checks (
              medication_safety_check_id,
              resident_id,
              medication_order_ref,
              medication_schedule_ref,
              administration_context_ref,
              identity_checked,
              order_context_checked,
              allergy_context_checked,
              route_context_checked,
              readiness_checked,
              safety_notes,
              state,
              performed_by,
              performed_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
              'RECORDED',$12,$13
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.medicationOrderRef ?? null,
              c.medicationScheduleRef ?? null,
              c.administrationContextRef ?? null,
              Boolean(c.identityChecked),
              Boolean(c.orderContextChecked),
              Boolean(c.allergyContextChecked),
              Boolean(c.routeContextChecked),
              Boolean(c.readinessChecked),
              c.safetyNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_SAFETY_CHECK',id,
            'SAFETY_CHECK_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'VERIFY_SAFETY_CHECK': {
          this.requireReviewer(c);

          const id=c.medicationSafetyCheckId;

          const q=await db.query(
            `
            SELECT *
            FROM medication_safety_checks
            WHERE medication_safety_check_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Safety check not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED safety check may verify.',
            );
          }

          const r=await db.query(
            `
            UPDATE medication_safety_checks
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE medication_safety_check_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MEDICATION_SAFETY_CHECK',id,
            'SAFETY_CHECK_VERIFIED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_HIGH_RISK_CHECK': {
          this.requireReviewer(c);

          if (!c.policyReference) {
            throw new BadRequestException('Policy reference required.');
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO high_risk_medication_checks (
              high_risk_medication_check_id,
              resident_id,
              medication_order_ref,
              policy_reference,
              check_context,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'PENDING',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.medicationOrderRef ?? null,
              c.policyReference,
              c.checkContext ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'HIGH_RISK_MEDICATION_CHECK',id,
            'HIGH_RISK_CHECK_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'FIRST_HIGH_RISK_CHECK': {
          this.requireReviewer(c);

          const id=c.highRiskMedicationCheckId;

          const q=await db.query(
            `
            SELECT *
            FROM high_risk_medication_checks
            WHERE high_risk_medication_check_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('High-risk check not found.');
          }

          if (q.rows[0].state !== 'PENDING') {
            throw new BadRequestException(
              'Only PENDING high-risk check may receive first check.',
            );
          }

          const r=await db.query(
            `
            UPDATE high_risk_medication_checks
            SET
              state='FIRST_CHECKED',
              first_checker_id=$2,
              first_checker_role=$3,
              first_checked_at=now(),
              updated_at=now()
            WHERE high_risk_medication_check_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'HIGH_RISK_MEDICATION_CHECK',id,
            'HIGH_RISK_FIRST_CHECKED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'SECOND_HIGH_RISK_CHECK': {
          this.requireReviewer(c);

          const id=c.highRiskMedicationCheckId;

          const q=await db.query(
            `
            SELECT *
            FROM high_risk_medication_checks
            WHERE high_risk_medication_check_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('High-risk check not found.');
          }

          if (q.rows[0].state !== 'FIRST_CHECKED') {
            throw new BadRequestException(
              'Only FIRST_CHECKED record may receive second check.',
            );
          }

          if (q.rows[0].first_checker_id === c.actorId) {
            throw new BadRequestException(
              'Second checker must be a different accountable human.',
            );
          }

          const r=await db.query(
            `
            UPDATE high_risk_medication_checks
            SET
              state='SECOND_CHECKED',
              second_checker_id=$2,
              second_checker_role=$3,
              second_checked_at=now(),
              updated_at=now()
            WHERE high_risk_medication_check_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'HIGH_RISK_MEDICATION_CHECK',id,
            'HIGH_RISK_SECOND_CHECKED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'COMPLETE_HIGH_RISK_CHECK': {
          this.requireManager(c);

          const id=c.highRiskMedicationCheckId;

          const q=await db.query(
            `
            SELECT *
            FROM high_risk_medication_checks
            WHERE high_risk_medication_check_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('High-risk check not found.');
          }

          if (q.rows[0].state !== 'SECOND_CHECKED') {
            throw new BadRequestException(
              'Two independent human checks required before completion.',
            );
          }

          if (
            !q.rows[0].first_checker_id ||
            !q.rows[0].second_checker_id ||
            q.rows[0].first_checker_id === q.rows[0].second_checker_id
          ) {
            throw new BadRequestException(
              'Independent checker separation invalid.',
            );
          }

          const r=await db.query(
            `
            UPDATE high_risk_medication_checks
            SET
              state='COMPLETE',
              completed_by=$2,
              completed_by_role=$3,
              completed_at=now(),
              updated_at=now()
            WHERE high_risk_medication_check_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'HIGH_RISK_MEDICATION_CHECK',id,
            'HIGH_RISK_CHECK_COMPLETED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_ADMINISTRATION_EXCEPTION': {
          this.requireHuman(c);

          if (!c.exceptionType) {
            throw new BadRequestException('Exception type required.');
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO medication_administration_exceptions (
              medication_administration_exception_id,
              resident_id,
              medication_order_ref,
              medication_schedule_ref,
              medication_administration_ref,
              exception_type,
              exception_notes,
              state,
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
              c.medicationOrderRef ?? null,
              c.medicationScheduleRef ?? null,
              c.medicationAdministrationRef ?? null,
              c.exceptionType,
              c.exceptionNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_ADMINISTRATION_EXCEPTION',id,
            'ADMINISTRATION_EXCEPTION_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'VERIFY_ADMINISTRATION_EXCEPTION': {
          this.requireReviewer(c);

          const id=c.medicationAdministrationExceptionId;

          const q=await db.query(
            `
            SELECT *
            FROM medication_administration_exceptions
            WHERE medication_administration_exception_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Exception not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED exception may verify.',
            );
          }

          const r=await db.query(
            `
            UPDATE medication_administration_exceptions
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE medication_administration_exception_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MEDICATION_ADMINISTRATION_EXCEPTION',id,
            'ADMINISTRATION_EXCEPTION_VERIFIED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_ADVERSE_REACTION_OBSERVATION': {
          this.requireHuman(c);

          if (!c.observableFacts) {
            throw new BadRequestException('Observable facts required.');
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO medication_adverse_reaction_observations (
              medication_adverse_reaction_observation_id,
              resident_id,
              medication_order_ref,
              observable_facts,
              resident_report,
              state,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'RECORDED',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.medicationOrderRef ?? null,
              c.observableFacts,
              c.residentReport ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_ADVERSE_REACTION_OBSERVATION',id,
            'ADVERSE_REACTION_OBSERVATION_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'VERIFY_ADVERSE_REACTION_OBSERVATION': {
          this.requireReviewer(c);

          const id=c.medicationAdverseReactionObservationId;

          const q=await db.query(
            `
            SELECT *
            FROM medication_adverse_reaction_observations
            WHERE medication_adverse_reaction_observation_id=$1
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

          const r=await db.query(
            `
            UPDATE medication_adverse_reaction_observations
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE medication_adverse_reaction_observation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'MEDICATION_ADVERSE_REACTION_OBSERVATION',id,
            'ADVERSE_REACTION_OBSERVATION_VERIFIED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'AMEND_ADVERSE_REACTION_OBSERVATION': {
          this.requireReviewer(c);

          const originalId=c.medicationAdverseReactionObservationId;

          if (!c.amendmentReason) {
            throw new BadRequestException('Amendment reason required.');
          }

          const q=await db.query(
            `
            SELECT *
            FROM medication_adverse_reaction_observations
            WHERE medication_adverse_reaction_observation_id=$1
            FOR UPDATE
            `,
            [originalId],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Observation not found.');
          }

          if (!['VERIFIED','AMENDED'].includes(q.rows[0].state)) {
            throw new BadRequestException(
              'Only verified observation history may be amended.',
            );
          }

          const o=q.rows[0];
          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO medication_adverse_reaction_observations (
              medication_adverse_reaction_observation_id,
              resident_id,
              medication_order_ref,
              observable_facts,
              resident_report,
              state,
              recorded_by,
              recorded_by_role,
              amendment_of,
              amendment_reason
            )
            VALUES (
              $1,$2,$3,$4,$5,'AMENDED',$6,$7,$8,$9
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.medicationOrderRef ?? o.medication_order_ref,
              c.observableFacts ?? o.observable_facts,
              c.residentReport ?? o.resident_report,
              c.actorId,
              c.actorRole,
              originalId,
              c.amendmentReason,
            ],
          );

          await this.audit(
            db,residentId,'MEDICATION_ADVERSE_REACTION_OBSERVATION',id,
            'ADVERSE_REACTION_AMENDMENT_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7X action.',
          );
      }

      await db.query('COMMIT');

      return {
        status: 'OK',
        data: result,
        existingMedicationDomainPreserved: true,
        autonomousMedicationAction: false,
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
