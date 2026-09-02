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
export class BehavioralCognitiveService {
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
      domain: 'BEHAVIORAL_COGNITIVE_DEMENTIA_SAFETY',
      aiRole: 'ADVISORY_ONLY',
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
        'AI / SYSTEM cannot perform official behavioral mutation.',
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

  private requireClinicalReviewer(c: Cmd) {
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

  private async audit(
    client: PoolClient,
    residentId: string,
    entityType: string,
    entityId: string,
    eventType: string,
    c: Cmd,
    payload: any,
  ) {
    const q = await client.query(
      `
      SELECT COALESCE(MAX(sequence_no),0)+1 AS next
      FROM behavioral_audit
      WHERE entity_type=$1
        AND entity_id=$2
      `,
      [entityType,entityId],
    );

    await client.query(
      `
      INSERT INTO behavioral_audit (
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
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      let result: any;

      switch (action) {
        case 'CREATE_COGNITIVE_OBSERVATION': {
          const id = randomUUID();

          if (!c.observableFacts) {
            throw new BadRequestException(
              'Observable facts are required.',
            );
          }

          const r = await client.query(
            `
            INSERT INTO cognitive_observations (
              observation_id,
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
              c.observationType ?? 'COGNITIVE_OBSERVATION',
              c.observableFacts,
              Boolean(c.baselineChange),
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'COGNITIVE_OBSERVATION',
            id,
            'COGNITIVE_OBSERVATION_RECORDED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_COGNITIVE_OBSERVATION': {
          this.requireClinicalReviewer(c);

          const id = c.observationId;

          const q = await client.query(
            `
            SELECT *
            FROM cognitive_observations
            WHERE observation_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Observation not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED observation may be verified.',
            );
          }

          const r = await client.query(
            `
            UPDATE cognitive_observations
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now(),
              updated_at=now()
            WHERE observation_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'COGNITIVE_OBSERVATION',
            id,
            'COGNITIVE_OBSERVATION_VERIFIED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_SUPPORT_PLAN': {
          this.requireClinicalReviewer(c);

          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO behavioral_support_plans (
              support_plan_id,
              resident_id,
              status,
              known_preferences,
              known_triggers,
              communication_approach,
              reassurance_strategy,
              environmental_support,
              mobility_or_activity_support,
              owner_id,
              owner_role
            )
            VALUES (
              $1,$2,'DRAFT',$3,$4,$5,$6,$7,$8,$9,$10
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.knownPreferences ?? null,
              c.knownTriggers ?? null,
              c.communicationApproach ?? null,
              c.reassuranceStrategy ?? null,
              c.environmentalSupport ?? null,
              c.mobilityOrActivitySupport ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_SUPPORT_PLAN',
            id,
            'SUPPORT_PLAN_CREATED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'REVIEW_SUPPORT_PLAN': {
          this.requireManager(c);

          const id = c.supportPlanId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_support_plans
            WHERE support_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Support plan not found.');
          }

          if (q.rows[0].status !== 'DRAFT') {
            throw new BadRequestException(
              'Only DRAFT support plan may be reviewed.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_support_plans
            SET
              status='REVIEWED',
              reviewer_id=$2,
              reviewer_role=$3,
              reviewed_at=now(),
              updated_at=now()
            WHERE support_plan_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_SUPPORT_PLAN',
            id,
            'SUPPORT_PLAN_REVIEWED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACTIVATE_SUPPORT_PLAN': {
          this.requireManager(c);

          const id = c.supportPlanId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_support_plans
            WHERE support_plan_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Support plan not found.');
          }

          if (q.rows[0].status !== 'REVIEWED') {
            throw new BadRequestException(
              'Only REVIEWED support plan may activate.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_support_plans
            SET
              status='ACTIVE',
              activated_at=now(),
              updated_at=now()
            WHERE support_plan_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_SUPPORT_PLAN',
            id,
            'SUPPORT_PLAN_ACTIVATED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_EPISODE': {
          const id = randomUUID();

          if (!c.observableBehavior) {
            throw new BadRequestException(
              'Observable behavior is required.',
            );
          }

          const r = await client.query(
            `
            INSERT INTO behavioral_episodes (
              episode_id,
              resident_id,
              episode_type,
              location,
              antecedent_observation,
              observable_behavior,
              immediate_safety_context,
              state,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,'OPEN',$8,$9
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.episodeType ?? 'BEHAVIORAL_EPISODE',
              c.location ?? null,
              c.antecedentObservation ?? null,
              c.observableBehavior,
              c.immediateSafetyContext ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_EPISODE',
            id,
            'BEHAVIORAL_EPISODE_CREATED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_EPISODE': {
          this.requireManager(c);

          if (
            !c.ownerId ||
            !c.ownerRole ||
            ['AI','SYSTEM'].includes(
              String(c.ownerRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'Human owner required.',
            );
          }

          const id = c.episodeId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_episodes
            WHERE episode_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Episode not found.');
          }

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN episode may be assigned.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_episodes
            SET
              state='ASSIGNED',
              owner_id=$2,
              owner_role=$3,
              assigned_at=now(),
              updated_at=now()
            WHERE episode_id=$1
            RETURNING *
            `,
            [id,c.ownerId,c.ownerRole],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_EPISODE',
            id,
            'BEHAVIORAL_EPISODE_ASSIGNED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACKNOWLEDGE_EPISODE': {
          const id = c.episodeId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_episodes
            WHERE episode_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Episode not found.');
          }

          if (q.rows[0].state !== 'ASSIGNED') {
            throw new BadRequestException(
              'Only ASSIGNED episode may be acknowledged.',
            );
          }

          if (q.rows[0].owner_id !== c.actorId) {
            throw new BadRequestException(
              'Only assigned human owner may acknowledge.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_episodes
            SET
              state='ACKNOWLEDGED',
              acknowledged_at=now(),
              updated_at=now()
            WHERE episode_id=$1
            RETURNING *
            `,
            [id],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_EPISODE',
            id,
            'BEHAVIORAL_EPISODE_ACKNOWLEDGED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_RESPONSE': {
          const id = randomUUID();

          const ep = await client.query(
            `
            SELECT *
            FROM behavioral_episodes
            WHERE episode_id=$1
            FOR UPDATE
            `,
            [c.episodeId],
          );

          if (!ep.rowCount) {
            throw new NotFoundException('Episode not found.');
          }

          if (
            !['ACKNOWLEDGED','RESPONDING'].includes(
              ep.rows[0].state,
            )
          ) {
            throw new BadRequestException(
              'Episode must be ACKNOWLEDGED or RESPONDING.',
            );
          }

          if (
            ep.rows[0].owner_id &&
            ep.rows[0].owner_id !== c.actorId
          ) {
            throw new BadRequestException(
              'Only assigned human owner may document response.',
            );
          }

          await client.query(
            `
            UPDATE behavioral_episodes
            SET
              state='RESPONDING',
              updated_at=now()
            WHERE episode_id=$1
            `,
            [c.episodeId],
          );

          const r = await client.query(
            `
            INSERT INTO behavioral_responses (
              response_id,
              resident_id,
              episode_id,
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
              c.episodeId,
              c.responseType ?? 'NON_PHARMACOLOGICAL_SUPPORT',
              c.responseNotes ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_RESPONSE',
            id,
            'BEHAVIORAL_RESPONSE_RECORDED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_RESPONSE': {
          this.requireClinicalReviewer(c);

          const id = c.responseId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_responses
            WHERE response_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Response not found.');
          }

          if (q.rows[0].state !== 'RECORDED') {
            throw new BadRequestException(
              'Only RECORDED response may verify.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_responses
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
            client,
            residentId,
            'BEHAVIORAL_RESPONSE',
            id,
            'BEHAVIORAL_RESPONSE_VERIFIED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_WANDERING_EVENT': {
          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO wandering_events (
              wandering_event_id,
              resident_id,
              episode_id,
              event_type,
              last_known_location,
              found_location,
              state,
              owner_id,
              owner_role,
              created_by,
              created_by_role
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,'OPEN',$7,$8,$9,$10
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.episodeId ?? null,
              c.eventType ?? 'WANDERING',
              c.lastKnownLocation ?? null,
              c.foundLocation ?? null,
              c.ownerId ?? c.actorId,
              c.ownerRole ?? c.actorRole,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'WANDERING_EVENT',
            id,
            'WANDERING_EVENT_CREATED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACKNOWLEDGE_WANDERING': {
          const id = c.wanderingEventId;

          const q = await client.query(
            `
            SELECT *
            FROM wandering_events
            WHERE wandering_event_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException(
              'Wandering event not found.',
            );
          }

          if (q.rows[0].state !== 'OPEN') {
            throw new BadRequestException(
              'Only OPEN wandering event may acknowledge.',
            );
          }

          if (
            q.rows[0].owner_id &&
            q.rows[0].owner_id !== c.actorId
          ) {
            throw new BadRequestException(
              'Only human owner may acknowledge.',
            );
          }

          const r = await client.query(
            `
            UPDATE wandering_events
            SET
              state='ACKNOWLEDGED',
              acknowledged_by=$2,
              acknowledged_at=now(),
              updated_at=now()
            WHERE wandering_event_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            client,
            residentId,
            'WANDERING_EVENT',
            id,
            'WANDERING_EVENT_ACKNOWLEDGED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_ESCALATION': {
          const id = randomUUID();

          const r = await client.query(
            `
            INSERT INTO behavioral_escalations (
              escalation_id,
              resident_id,
              episode_id,
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
              residentId,
              c.episodeId ?? null,
              c.reason,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_ESCALATION',
            id,
            'BEHAVIORAL_ESCALATION_CREATED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ASSIGN_ESCALATION': {
          this.requireManager(c);

          if (
            !c.reviewerId ||
            !c.reviewerRole ||
            ['AI','SYSTEM'].includes(
              String(c.reviewerRole).toUpperCase(),
            )
          ) {
            throw new BadRequestException(
              'Human reviewer required.',
            );
          }

          const id = c.escalationId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_escalations
            WHERE escalation_id=$1
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

          const r = await client.query(
            `
            UPDATE behavioral_escalations
            SET
              state='ASSIGNED',
              reviewer_id=$2,
              reviewer_role=$3,
              assigned_by=$4,
              assigned_by_role=$5,
              assigned_at=now(),
              updated_at=now()
            WHERE escalation_id=$1
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
            client,
            residentId,
            'BEHAVIORAL_ESCALATION',
            id,
            'BEHAVIORAL_ESCALATION_ASSIGNED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'ACCEPT_ESCALATION': {
          const id = c.escalationId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_escalations
            WHERE escalation_id=$1
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
              'Only assigned reviewer may accept.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_escalations
            SET
              state='ACCEPTED',
              accepted_by=$2,
              accepted_at=now(),
              updated_at=now()
            WHERE escalation_id=$1
            RETURNING *
            `,
            [id,c.actorId],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_ESCALATION',
            id,
            'BEHAVIORAL_ESCALATION_ACCEPTED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_ESCALATION': {
          const id = c.escalationId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_escalations
            WHERE escalation_id=$1
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

          const r = await client.query(
            `
            UPDATE behavioral_escalations
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolution_notes=$4,
              resolved_at=now(),
              updated_at=now()
            WHERE escalation_id=$1
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
            client,
            residentId,
            'BEHAVIORAL_ESCALATION',
            id,
            'BEHAVIORAL_ESCALATION_RESOLVED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'RESOLVE_EPISODE': {
          const id = c.episodeId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_episodes
            WHERE episode_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Episode not found.');
          }

          if (
            !['ACKNOWLEDGED','RESPONDING'].includes(
              q.rows[0].state,
            )
          ) {
            throw new BadRequestException(
              'Episode cannot resolve from current state.',
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

          const r = await client.query(
            `
            UPDATE behavioral_episodes
            SET
              state='RESOLVED',
              resolved_by=$2,
              resolved_by_role=$3,
              resolved_at=now(),
              updated_at=now()
            WHERE episode_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_EPISODE',
            id,
            'BEHAVIORAL_EPISODE_RESOLVED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CREATE_POST_REVIEW': {
          this.requireClinicalReviewer(c);

          const id = randomUUID();

          const ep = await client.query(
            `
            SELECT *
            FROM behavioral_episodes
            WHERE episode_id=$1
            FOR UPDATE
            `,
            [c.episodeId],
          );

          if (!ep.rowCount) {
            throw new NotFoundException('Episode not found.');
          }

          if (ep.rows[0].state !== 'RESOLVED') {
            throw new BadRequestException(
              'Post-review requires RESOLVED episode.',
            );
          }

          const r = await client.query(
            `
            INSERT INTO behavioral_post_reviews (
              post_review_id,
              resident_id,
              episode_id,
              review_notes,
              contributing_factors,
              follow_up_recommendation,
              reviewer_id,
              reviewer_role,
              state
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,'COMPLETED'
            )
            RETURNING *
            `,
            [
              id,
              residentId,
              c.episodeId,
              c.reviewNotes,
              c.contributingFactors ?? null,
              c.followUpRecommendation ?? null,
              c.actorId,
              c.actorRole,
            ],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_POST_REVIEW',
            id,
            'BEHAVIORAL_POST_REVIEW_COMPLETED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'VERIFY_POST_REVIEW': {
          this.requireClinicalReviewer(c);

          const id = c.postReviewId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_post_reviews
            WHERE post_review_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Post review not found.');
          }

          if (q.rows[0].state !== 'COMPLETED') {
            throw new BadRequestException(
              'Only COMPLETED review may verify.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_post_reviews
            SET
              state='VERIFIED',
              verified_by=$2,
              verified_by_role=$3,
              verified_at=now()
            WHERE post_review_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_POST_REVIEW',
            id,
            'BEHAVIORAL_POST_REVIEW_VERIFIED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        case 'CLOSE_EPISODE': {
          this.requireManager(c);

          const id = c.episodeId;

          const q = await client.query(
            `
            SELECT *
            FROM behavioral_episodes
            WHERE episode_id=$1
            FOR UPDATE
            `,
            [id],
          );

          if (!q.rowCount) {
            throw new NotFoundException('Episode not found.');
          }

          if (q.rows[0].state !== 'RESOLVED') {
            throw new BadRequestException(
              'Only RESOLVED episode may close.',
            );
          }

          const review = await client.query(
            `
            SELECT COUNT(*)::int AS c
            FROM behavioral_post_reviews
            WHERE episode_id=$1
              AND state='VERIFIED'
            `,
            [id],
          );

          if (Number(review.rows[0].c) < 1) {
            throw new BadRequestException(
              'Verified post-event review required before closure.',
            );
          }

          const r = await client.query(
            `
            UPDATE behavioral_episodes
            SET
              state='CLOSED',
              closed_by=$2,
              closed_by_role=$3,
              closed_at=now(),
              updated_at=now()
            WHERE episode_id=$1
            RETURNING *
            `,
            [id,c.actorId,c.actorRole],
          );

          await this.audit(
            client,
            residentId,
            'BEHAVIORAL_EPISODE',
            id,
            'BEHAVIORAL_EPISODE_CLOSED',
            c,
            r.rows[0],
          );

          result = r.rows[0];
          break;
        }

        default:
          throw new BadRequestException(
            'Unsupported Step 7T action.',
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
