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
export class SafeguardingService {
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
      domain:
        'SAFEGUARDING_ABUSE_NEGLECT_EXPLOITATION_RESIDENT_RIGHTS_PROTECTION',
      aiRole: 'ADVISORY_ONLY',
      reportIsProvenFinding: false,
      autonomousRightsRestriction: false,
      autonomousDisciplinaryAction: false,
      autonomousExternalReporting: false,
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
        'AI / SYSTEM cannot perform official safeguarding mutation.',
      );
    }
  }

  private requireReviewer(c: Cmd) {
    this.requireHuman(c);

    if (
      !['NURSE','SUPERVISOR','CARE_MANAGER','SAFEGUARDING_REVIEWER']
        .includes(String(c.actorRole).toUpperCase())
    ) {
      throw new BadRequestException(
        'Authorized human safeguarding reviewer required.',
      );
    }
  }

  private requireManager(c: Cmd) {
    this.requireHuman(c);

    if (
      !['SUPERVISOR','CARE_MANAGER']
        .includes(String(c.actorRole).toUpperCase())
    ) {
      throw new BadRequestException(
        'Supervisor or Care Manager required.',
      );
    }
  }

  private rejectAutonomousDecision(action: string) {
    const denied = [
      'DETERMINE_ABUSE',
      'DETERMINE_NEGLECT',
      'DETERMINE_EXPLOITATION',
      'IDENTIFY_PERPETRATOR',
      'SUSPEND_STAFF',
      'TERMINATE_STAFF',
      'DISCIPLINE_STAFF',
      'RESTRICT_RESIDENT_MOVEMENT',
      'RESTRICT_RESIDENT_COMMUNICATION',
      'RESTRICT_FAMILY_CONTACT',
      'REPORT_TO_POLICE',
      'REPORT_TO_REGULATOR',
      'REPORT_TO_AUTHORITY',
      'CREATE_MEDICATION_ORDER',
      'ADMINISTER_MEDICATION',
      'CREATE_CARE_ACTION',
      'CREATE_CARE_TASK',
      'CREATE_INCIDENT',
    ];

    if (denied.includes(action)) {
      throw new BadRequestException(
        'Step 7Y cannot perform autonomous rights-restricting, disciplinary, external-reporting, or cross-domain action.',
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
      FROM safeguarding_audit
      WHERE entity_type=$1
        AND entity_id=$2
      `,
      [entityType,entityId],
    );

    await db.query(
      `
      INSERT INTO safeguarding_audit (
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

    this.rejectAutonomousDecision(action);

    const db = await this.pool.connect();

    try {
      await db.query('BEGIN');

      let result: any;

      switch (action) {

        case 'CREATE_SAFEGUARDING_REPORT': {
          if (!c.concernCategory || !c.factualDescription) {
            throw new BadRequestException(
              'Concern category and factual description required.',
            );
          }

          const id = randomUUID();

          const r = await db.query(
            `
            INSERT INTO safeguarding_reports (
              safeguarding_report_id,
              resident_id,
              concern_category,
              factual_description,
              resident_statement,
              immediate_safety_concern,
              confidentiality_note,
              state,
              reporter_id,
              reporter_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,'REPORTED',$8,$9
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.concernCategory,
              c.factualDescription,
              c.residentStatement ?? null,
              Boolean(c.immediateSafetyConcern),
              c.confidentialityNote ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_REPORT',id,
            'SAFEGUARDING_REPORT_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'TRIAGE_SAFEGUARDING_REPORT': {
          this.requireManager(c);

          const reportId=c.safeguardingReportId;

          const report=await db.query(
            `
            SELECT *
            FROM safeguarding_reports
            WHERE safeguarding_report_id=$1
            FOR UPDATE
            `,
            [reportId],
          );

          if (!report.rowCount) {
            throw new NotFoundException('Safeguarding report not found.');
          }

          if (report.rows[0].state !== 'REPORTED') {
            throw new BadRequestException(
              'Only REPORTED case may be triaged.',
            );
          }

          if (!c.humanRationale || !c.urgencyClassification) {
            throw new BadRequestException(
              'Human triage rationale and urgency required.',
            );
          }

          const triageId=randomUUID();

          const t=await db.query(
            `
            INSERT INTO safeguarding_triage (
              safeguarding_triage_id,
              safeguarding_report_id,
              resident_id,
              urgency_classification,
              immediate_safety_concern,
              protection_need,
              human_rationale,
              state,
              triaged_by,
              triaged_by_role,
              triaged_at,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,'COMPLETED',
              $8,$9,now(),$8,$9
            )
            RETURNING *
            `,
            [
              triageId,
              reportId,
              residentId,
              c.urgencyClassification,
              Boolean(c.immediateSafetyConcern),
              c.protectionNeed ?? null,
              c.humanRationale,
              c.actorId,
              c.actorRole,
            ],
          );

          await db.query(
            `
            UPDATE safeguarding_reports
            SET state='TRIAGED', updated_at=now()
            WHERE safeguarding_report_id=$1
            `,
            [reportId],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_TRIAGE',triageId,
            'SAFEGUARDING_TRIAGE_COMPLETED',c,t.rows[0],
          );

          result=t.rows[0];
          break;
        }

        case 'PROPOSE_PROTECTIVE_ACTION': {
          this.requireReviewer(c);

          if (
            !c.actionType ||
            !c.actionDescription ||
            !c.necessityRationale ||
            !c.proportionalityRationale
          ) {
            throw new BadRequestException(
              'Protective action requires type, description, necessity and proportionality rationale.',
            );
          }

          const reportId=c.safeguardingReportId;

          const report=await db.query(
            `
            SELECT *
            FROM safeguarding_reports
            WHERE safeguarding_report_id=$1
            FOR UPDATE
            `,
            [reportId],
          );

          if (!report.rowCount) {
            throw new NotFoundException('Safeguarding report not found.');
          }

          if (!['TRIAGED','UNDER_REVIEW'].includes(report.rows[0].state)) {
            throw new BadRequestException(
              'Protective action requires triaged or active-review case.',
            );
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO protective_actions (
              protective_action_id,
              safeguarding_report_id,
              resident_id,
              action_type,
              action_description,
              necessity_rationale,
              proportionality_rationale,
              rights_impact,
              review_requirements,
              state,
              proposed_by,
              proposed_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,
              'PROPOSED',$10,$11
            )
            RETURNING *
            `,
            [
              id,
              reportId,
              residentId,
              c.actionType,
              c.actionDescription,
              c.necessityRationale,
              c.proportionalityRationale,
              c.rightsImpact ?? null,
              c.reviewRequirements ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'PROTECTIVE_ACTION',id,
            'PROTECTIVE_ACTION_PROPOSED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'AUTHORIZE_PROTECTIVE_ACTION': {
          this.requireManager(c);

          const id=c.protectiveActionId;

          const q=await db.query(
            `
            SELECT *
            FROM protective_actions
            WHERE protective_action_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Protective action not found.');
          }

          if (q.rows[0].state !== 'PROPOSED') {
            throw new BadRequestException(
              'Only PROPOSED protective action may authorize.',
            );
          }

          const r=await db.query(
            `
            UPDATE protective_actions
            SET
              state='AUTHORIZED',
              authorized_by=$2,
              authorized_by_role=$3,
              authorized_at=now(),
              updated_at=now()
            WHERE protective_action_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PROTECTIVE_ACTION',id,
            'PROTECTIVE_ACTION_AUTHORIZED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ACTIVATE_PROTECTIVE_ACTION': {
          this.requireManager(c);

          const id=c.protectiveActionId;

          const q=await db.query(
            `
            SELECT *
            FROM protective_actions
            WHERE protective_action_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Protective action not found.');
          }

          if (q.rows[0].state !== 'AUTHORIZED') {
            throw new BadRequestException(
              'Only AUTHORIZED protective action may activate.',
            );
          }

          const r=await db.query(
            `
            UPDATE protective_actions
            SET
              state='ACTIVE',
              activated_by=$2,
              activated_by_role=$3,
              activated_at=now(),
              updated_at=now()
            WHERE protective_action_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PROTECTIVE_ACTION',id,
            'PROTECTIVE_ACTION_ACTIVATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'REVIEW_PROTECTIVE_ACTION': {
          this.requireManager(c);

          const id=c.protectiveActionId;

          const q=await db.query(
            `
            SELECT *
            FROM protective_actions
            WHERE protective_action_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Protective action not found.');
          }

          if (q.rows[0].state !== 'ACTIVE') {
            throw new BadRequestException(
              'Only ACTIVE protective action may be reviewed.',
            );
          }

          const r=await db.query(
            `
            UPDATE protective_actions
            SET
              state='REVIEWED',
              reviewed_by=$2,
              reviewed_by_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE protective_action_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PROTECTIVE_ACTION',id,
            'PROTECTIVE_ACTION_REVIEWED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'END_PROTECTIVE_ACTION': {
          this.requireManager(c);

          const id=c.protectiveActionId;

          const q=await db.query(
            `
            SELECT *
            FROM protective_actions
            WHERE protective_action_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Protective action not found.');
          }

          if (!['ACTIVE','REVIEWED'].includes(q.rows[0].state)) {
            throw new BadRequestException(
              'Only ACTIVE or REVIEWED protective action may end.',
            );
          }

          const r=await db.query(
            `
            UPDATE protective_actions
            SET
              state='ENDED',
              ended_by=$2,
              ended_by_role=$3,
              ended_at=now(),
              updated_at=now()
            WHERE protective_action_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'PROTECTIVE_ACTION',id,
            'PROTECTIVE_ACTION_ENDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ASSIGN_SAFEGUARDING_CASE': {
          this.requireManager(c);

          if (!c.ownerId || !c.ownerRole) {
            throw new BadRequestException('Human owner required.');
          }

          if (
            ['AI','SYSTEM'].includes(
              String(c.ownerRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException('AI / SYSTEM cannot own case.');
          }

          const reportId=c.safeguardingReportId;

          const report=await db.query(
            `
            SELECT *
            FROM safeguarding_reports
            WHERE safeguarding_report_id=$1
            FOR UPDATE
            `,
            [reportId],
          );

          if (!report.rowCount) {
            throw new NotFoundException('Safeguarding report not found.');
          }

          if (!['TRIAGED','UNDER_REVIEW'].includes(report.rows[0].state)) {
            throw new BadRequestException(
              'Safeguarding report must be triaged before assignment.',
            );
          }

          const existing=await db.query(
            `
            SELECT *
            FROM safeguarding_assignments
            WHERE safeguarding_report_id=$1
              AND state IN ('ASSIGNED','ACCEPTED')
            FOR UPDATE
            `,
            [reportId],
          );

          if (existing.rowCount) {
            throw new BadRequestException(
              'Active safeguarding assignment already exists.',
            );
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO safeguarding_assignments (
              safeguarding_assignment_id,
              safeguarding_report_id,
              resident_id,
              owner_id,
              owner_role,
              state,
              assigned_by,
              assigned_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,'ASSIGNED',$6,$7
            )
            RETURNING *
            `,
            [
              id,
              reportId,
              residentId,
              c.ownerId,
              c.ownerRole,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_ASSIGNMENT',id,
            'SAFEGUARDING_CASE_ASSIGNED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ACCEPT_SAFEGUARDING_ASSIGNMENT': {
          const id=c.safeguardingAssignmentId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_assignments
            WHERE safeguarding_assignment_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Assignment not found.');
          }

          if (q.rows[0].state !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED case may be accepted.',
            );
          }

          if (q.rows[0].owner_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human owner may accept case.',
            );
          }

          const r=await db.query(
            `
            UPDATE safeguarding_assignments
            SET
              state='ACCEPTED',
              accepted_by=$2,
              accepted_at=now(),
              updated_at=now()
            WHERE safeguarding_assignment_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_ASSIGNMENT',id,
            'SAFEGUARDING_ASSIGNMENT_ACCEPTED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_SAFEGUARDING_REVIEW': {
          this.requireReviewer(c);

          if (!c.factualNotes) {
            throw new BadRequestException('Factual review notes required.');
          }

          const assignmentId=c.safeguardingAssignmentId;

          const assignment=await db.query(
            `
            SELECT *
            FROM safeguarding_assignments
            WHERE safeguarding_assignment_id=$1
            FOR UPDATE
            `,
            [assignmentId],
          );

          if (!assignment.rowCount) {
            throw new NotFoundException('Assignment not found.');
          }

          if (assignment.rows[0].state !== 'ACCEPTED') {
            throw new BadRequestException(
              'Accepted safeguarding assignment required.',
            );
          }

          if (assignment.rows[0].owner_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human owner may create official review.',
            );
          }

          const reportId=assignment.rows[0].safeguarding_report_id;

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO safeguarding_reviews (
              safeguarding_review_id,
              safeguarding_report_id,
              resident_id,
              safeguarding_assignment_id,
              review_type,
              factual_notes,
              resident_statement,
              evidence_references,
              uncertainty_notes,
              finding_summary,
              state,
              reviewer_id,
              reviewer_role,
              started_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              'IN_PROGRESS',$11,$12,now()
            )
            RETURNING *
            `,
            [
              id,
              reportId,
              residentId,
              assignmentId,
              c.reviewType ?? 'SAFEGUARDING_REVIEW',
              c.factualNotes,
              c.residentStatement ?? null,
              c.evidenceReferences ?? null,
              c.uncertaintyNotes ?? null,
              c.findingSummary ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await db.query(
            `
            UPDATE safeguarding_reports
            SET state='UNDER_REVIEW', updated_at=now()
            WHERE safeguarding_report_id=$1
              AND state='TRIAGED'
            `,
            [reportId],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_REVIEW',id,
            'SAFEGUARDING_REVIEW_STARTED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'COMPLETE_SAFEGUARDING_REVIEW': {
          this.requireReviewer(c);

          const id=c.safeguardingReviewId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_reviews
            WHERE safeguarding_review_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Safeguarding review not found.');
          }

          if (q.rows[0].state !== 'IN_PROGRESS') {
            throw new BadRequestException(
              'Only IN_PROGRESS review may complete.',
            );
          }

          if (q.rows[0].reviewer_id !== c.actorId) {
            throw new BadRequestException(
              'Only original human reviewer may complete review.',
            );
          }

          const r=await db.query(
            `
            UPDATE safeguarding_reviews
            SET
              state='COMPLETED',
              completed_at=now(),
              updated_at=now()
            WHERE safeguarding_review_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_REVIEW',id,
            'SAFEGUARDING_REVIEW_COMPLETED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'AMEND_SAFEGUARDING_REVIEW': {
          this.requireReviewer(c);

          const originalId=c.safeguardingReviewId;

          if (!c.amendmentReason) {
            throw new BadRequestException('Amendment reason required.');
          }

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_reviews
            WHERE safeguarding_review_id=$1
            FOR UPDATE
            `,
            [originalId],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Safeguarding review not found.');
          }

          if (!['COMPLETED','AMENDED'].includes(q.rows[0].state)) {
            throw new BadRequestException(
              'Only completed review history may be amended.',
            );
          }

          const o=q.rows[0];
          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO safeguarding_reviews (
              safeguarding_review_id,
              safeguarding_report_id,
              resident_id,
              safeguarding_assignment_id,
              review_type,
              factual_notes,
              resident_statement,
              evidence_references,
              uncertainty_notes,
              finding_summary,
              state,
              reviewer_id,
              reviewer_role,
              started_at,
              completed_at,
              amendment_of,
              amendment_reason
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              'AMENDED',$11,$12,now(),now(),$13,$14
            )
            RETURNING *
            `,
            [
              id,
              o.safeguarding_report_id,
              residentId,
              o.safeguarding_assignment_id,
              o.review_type,
              c.factualNotes ?? o.factual_notes,
              c.residentStatement ?? o.resident_statement,
              c.evidenceReferences ?? o.evidence_references,
              c.uncertaintyNotes ?? o.uncertainty_notes,
              c.findingSummary ?? o.finding_summary,
              c.actorId,
              c.actorRole,
              originalId,
              c.amendmentReason,
            ],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_REVIEW',id,
            'SAFEGUARDING_REVIEW_AMENDMENT_RECORDED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_SAFEGUARDING_ESCALATION': {
          this.requireReviewer(c);

          if (!c.reason) {
            throw new BadRequestException('Escalation reason required.');
          }

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO safeguarding_escalations (
              safeguarding_escalation_id,
              safeguarding_report_id,
              resident_id,
              reason,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,'OPEN',$5,$6
            )
            RETURNING *
            `,
            [
              id,
              c.safeguardingReportId,
              residentId,
              c.reason,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_ESCALATION',id,
            'SAFEGUARDING_ESCALATION_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ASSIGN_SAFEGUARDING_ESCALATION': {
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

          const id=c.safeguardingEscalationId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_escalations
            WHERE safeguarding_escalation_id=$1
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

          const r=await db.query(
            `
            UPDATE safeguarding_escalations
            SET
              state='ASSIGNED',
              reviewer_id=$2,
              reviewer_role=$3,
              assigned_by=$4,
              assigned_by_role=$5,
              assigned_at=now(),
              updated_at=now()
            WHERE safeguarding_escalation_id=$1
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
            db,residentId,'SAFEGUARDING_ESCALATION',id,
            'SAFEGUARDING_ESCALATION_ASSIGNED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'ACCEPT_SAFEGUARDING_ESCALATION': {
          const id=c.safeguardingEscalationId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_escalations
            WHERE safeguarding_escalation_id=$1
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

          const r=await db.query(
            `
            UPDATE safeguarding_escalations
            SET
              state='ACCEPTED',
              accepted_by=$2,
              accepted_at=now(),
              updated_at=now()
            WHERE safeguarding_escalation_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_ESCALATION',id,
            'SAFEGUARDING_ESCALATION_ACCEPTED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'RESOLVE_SAFEGUARDING_ESCALATION': {
          const id=c.safeguardingEscalationId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_escalations
            WHERE safeguarding_escalation_id=$1
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

          const r=await db.query(
            `
            UPDATE safeguarding_escalations
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_notes=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE safeguarding_escalation_id=$1
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
            db,residentId,'SAFEGUARDING_ESCALATION',id,
            'SAFEGUARDING_ESCALATION_RESOLVED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CREATE_POST_REVIEW': {
          this.requireReviewer(c);

          const id=randomUUID();

          const r=await db.query(
            `
            INSERT INTO safeguarding_post_reviews (
              safeguarding_post_review_id,
              safeguarding_report_id,
              resident_id,
              protection_followup,
              recurrence_prevention,
              policy_review_notes,
              training_need,
              process_issue,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,
              'OPEN',$9,$10
            )
            RETURNING *
            `,
            [
              id,
              c.safeguardingReportId,
              residentId,
              c.protectionFollowup ?? null,
              c.recurrencePrevention ?? null,
              c.policyReviewNotes ?? null,
              c.trainingNeed ?? null,
              c.processIssue ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_POST_REVIEW',id,
            'SAFEGUARDING_POST_REVIEW_CREATED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'REVIEW_POST_REVIEW': {
          this.requireManager(c);

          const id=c.safeguardingPostReviewId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_post_reviews
            WHERE safeguarding_post_review_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Post review not found.');
          }

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN post review may be reviewed.',
            );
          }

          const r=await db.query(
            `
            UPDATE safeguarding_post_reviews
            SET
              state='REVIEWED',
              reviewed_by=$2,
              reviewed_by_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE safeguarding_post_review_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_POST_REVIEW',id,
            'SAFEGUARDING_POST_REVIEW_REVIEWED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CLOSE_POST_REVIEW': {
          this.requireManager(c);

          const id=c.safeguardingPostReviewId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_post_reviews
            WHERE safeguarding_post_review_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Post review not found.');
          }

          if (q.rows[0].state !== 'REVIEWED') {
            throw new BadRequestException(
              'Only REVIEWED post review may close.',
            );
          }

          const r=await db.query(
            `
            UPDATE safeguarding_post_reviews
            SET
              state='CLOSED',
              closed_by=$2,
              closed_by_role=$3,
              closed_at=now(),
              updated_at=now()
            WHERE safeguarding_post_review_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_POST_REVIEW',id,
            'SAFEGUARDING_POST_REVIEW_CLOSED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'RESOLVE_SAFEGUARDING_REPORT': {
          this.requireManager(c);

          const id=c.safeguardingReportId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_reports
            WHERE safeguarding_report_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Report not found.');
          }

          if (q.rows[0].state !== 'UNDER_REVIEW') {
            throw new BadRequestException(
              'Only UNDER_REVIEW report may resolve.',
            );
          }

          const r=await db.query(
            `
            UPDATE safeguarding_reports
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_summary=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE safeguarding_report_id=$1
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
            db,residentId,'SAFEGUARDING_REPORT',id,
            'SAFEGUARDING_REPORT_RESOLVED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        case 'CLOSE_SAFEGUARDING_REPORT': {
          this.requireManager(c);

          const id=c.safeguardingReportId;

          const q=await db.query(
            `
            SELECT *
            FROM safeguarding_reports
            WHERE safeguarding_report_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Report not found.');
          }

          if (q.rows[0].state !== 'RESOLVED') {
            throw new BadRequestException(
              'Only RESOLVED report may close.',
            );
          }

          const r=await db.query(
            `
            UPDATE safeguarding_reports
            SET
              state='CLOSED',
              closed_by=$2,
              closed_by_role=$3,
              closed_at=now(),
              updated_at=now()
            WHERE safeguarding_report_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            db,residentId,'SAFEGUARDING_REPORT',id,
            'SAFEGUARDING_REPORT_CLOSED',c,r.rows[0],
          );

          result=r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7Y action.',
          );
      }

      await db.query('COMMIT');

      return {
        status: 'OK',
        data: result,
        reportIsProvenFinding: false,
        autonomousRightsRestriction: false,
        autonomousDisciplinaryAction: false,
        autonomousExternalReporting: false,
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
