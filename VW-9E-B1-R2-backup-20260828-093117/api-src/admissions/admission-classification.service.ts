import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

import type {
  ActorContext,
  ActorRole,
} from './admission.service';

export type CareLevel =
  | 'INDEPENDENT'
  | 'ASSISTED'
  | 'HIGH_ASSISTANCE'
  | 'DEPENDENT';

type AssistanceLevel =
  | 'INDEPENDENT'
  | 'SUPERVISION'
  | 'PARTIAL_ASSISTANCE'
  | 'SUBSTANTIAL_ASSISTANCE'
  | 'FULL_ASSISTANCE';

type RiskLevel =
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

const ADL_ACTIVITIES = [
  'EATING',
  'BATHING',
  'DRESSING',
  'TOILETING',
  'MOBILITY',
  'TRANSFER',
] as const;

const ASSISTANCE_LEVELS: AssistanceLevel[] = [
  'INDEPENDENT',
  'SUPERVISION',
  'PARTIAL_ASSISTANCE',
  'SUBSTANTIAL_ASSISTANCE',
  'FULL_ASSISTANCE',
];

const RISK_LEVELS: RiskLevel[] = [
  'LOW',
  'MODERATE',
  'HIGH',
  'CRITICAL',
];

const CARE_LEVELS: CareLevel[] = [
  'INDEPENDENT',
  'ASSISTED',
  'HIGH_ASSISTANCE',
  'DEPENDENT',
];

interface ActorRow {
  primary_operational_role: ActorRole;
  status: string;
}

interface AssessmentInput {
  assessmentType?: unknown;
  summary?: unknown;
  clinicalNotes?: unknown;

  adl?: Array<{
    activityCode?: unknown;
    assistanceLevel?: unknown;
    score?: unknown;
    notes?: unknown;
  }>;

  cognitive?: {
    alertness?: unknown;
    orientation?: unknown;
    memory?: unknown;
    communication?: unknown;
    behavior?: unknown;
    mood?: unknown;
    cognitiveImpairment?: unknown;
    notes?: unknown;
  };

  nutrition?: {
    dietType?: unknown;
    swallowingStatus?: unknown;
    oralHealth?: unknown;
    feedingAssistanceRequired?: unknown;
    nutritionRisk?: unknown;
    hydrationObservation?: unknown;
    notes?: unknown;
  };

  risks?: Array<{
    riskType?: unknown;
    riskLevel?: unknown;
    score?: unknown;
    assessmentMethod?: unknown;
    details?: unknown;
  }>;
}

interface ApprovalInput {
  approvedCareLevel?: unknown;
  overrideReason?: unknown;
}

interface DecisionInput {
  decision?: unknown;
  conditions?: unknown;
  reason?: unknown;
}

@Injectable()
export class AdmissionClassificationService {
  private readonly ruleSetVersion =
    'TAMANCARE-CARE-V1-ADL-RISK';

  constructor(
    private readonly database: DatabaseService,
  ) {}

  private requiredString(
    value: unknown,
    field: string,
  ): string {
    if (
      typeof value !== 'string' ||
      !value.trim()
    ) {
      throw new BadRequestException(
        `${field} là thông tin bắt buộc.`,
      );
    }

    return value.trim();
  }

  private optionalString(
    value: unknown,
  ): string | null {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Dữ liệu văn bản không hợp lệ.',
      );
    }

    return value.trim() || null;
  }

  private optionalNumber(
    value: unknown,
  ): number | null {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      throw new BadRequestException(
        'Giá trị điểm phải là số hợp lệ.',
      );
    }

    return value;
  }

  private async assertActor(
    actor: ActorContext,
    allowedRoles: ActorRole[],
  ) {
    const result =
      await this.database.query<ActorRow>(
        `
        SELECT
          primary_operational_role,
          status
        FROM staff_actors
        WHERE actor_id=$1
        LIMIT 1
        `,
        [actor.actorId],
      );

    const row = result.rows[0];

    if (
      !row ||
      row.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Phiên nhân sự không hợp lệ.',
      );
    }

    if (
      row.primary_operational_role !==
      actor.actorRole
    ) {
      throw new ForbiddenException(
        'Vai trò phiên làm việc không khớp.',
      );
    }

    if (
      !allowedRoles.includes(
        row.primary_operational_role,
      )
    ) {
      throw new ForbiddenException(
        'Không có quyền thực hiện thao tác này.',
      );
    }
  }

  private async assertCase(
    admissionCaseId: string,
  ) {
    const result =
      await this.database.query(
        `
        SELECT
          admission_case_id,
          resident_id,
          status
        FROM admission_cases
        WHERE admission_case_id=$1
        LIMIT 1
        `,
        [admissionCaseId],
      );

    if (!result.rows[0]) {
      throw new NotFoundException(
        'Không tìm thấy hồ sơ tiếp nhận.',
      );
    }

    return result.rows[0];
  }

  async createAssessment(
    actor: ActorContext,
    admissionCaseId: string,
    input: AssessmentInput,
  ) {
    await this.assertActor(
      actor,
      [
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    await this.assertCase(
      admissionCaseId,
    );

    const assessmentType =
      this.optionalString(
        input.assessmentType,
      ) || 'INITIAL';

    const adl =
      Array.isArray(input.adl)
        ? input.adl
        : [];

    const risks =
      Array.isArray(input.risks)
        ? input.risks
        : [];

    const seen =
      new Set<string>();

    for (const item of adl) {
      const activity =
        this.requiredString(
          item.activityCode,
          'Hoạt động ADL',
        );

      if (
        !ADL_ACTIVITIES.includes(
          activity as
            typeof ADL_ACTIVITIES[number],
        )
      ) {
        throw new BadRequestException(
          `Hoạt động ADL không hợp lệ: ${activity}`,
        );
      }

      if (seen.has(activity)) {
        throw new BadRequestException(
          `Hoạt động ADL bị trùng: ${activity}`,
        );
      }

      seen.add(activity);

      const assistance =
        this.requiredString(
          item.assistanceLevel,
          'Mức hỗ trợ ADL',
        );

      if (
        !ASSISTANCE_LEVELS.includes(
          assistance as AssistanceLevel,
        )
      ) {
        throw new BadRequestException(
          `Mức hỗ trợ không hợp lệ: ${assistance}`,
        );
      }
    }

    for (const item of risks) {
      this.requiredString(
        item.riskType,
        'Loại nguy cơ',
      );

      const riskLevel =
        this.requiredString(
          item.riskLevel,
          'Mức nguy cơ',
        );

      if (
        !RISK_LEVELS.includes(
          riskLevel as RiskLevel,
        )
      ) {
        throw new BadRequestException(
          `Mức nguy cơ không hợp lệ: ${riskLevel}`,
        );
      }
    }

    return this.database.withTransaction(
      async (client) => {
        const assessment =
          await client.query(
            `
            INSERT INTO admission_assessments (
              admission_assessment_id,
              admission_case_id,
              assessment_type,
              status,
              started_at,
              completed_at,
              assessed_by,
              assessed_by_role,
              summary,
              clinical_notes
            )
            VALUES (
              'admission-assessment-' ||
                gen_random_uuid()::text,
              $1,
              $2,
              'COMPLETED',
              now(),
              now(),
              $3,
              $4,
              $5,
              $6
            )
            RETURNING *
            `,
            [
              admissionCaseId,
              assessmentType,
              actor.actorId,
              actor.actorRole,
              this.optionalString(
                input.summary,
              ),
              this.optionalString(
                input.clinicalNotes,
              ),
            ],
          );

        const assessmentId =
          assessment.rows[0]
            .admission_assessment_id;

        for (const item of adl) {
          await client.query(
            `
            INSERT INTO admission_adl_items (
              admission_adl_item_id,
              admission_assessment_id,
              activity_code,
              assistance_level,
              score,
              notes,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              'admission-adl-' ||
                gen_random_uuid()::text,
              $1,$2,$3,$4,$5,$6,$7
            )
            `,
            [
              assessmentId,
              String(item.activityCode),
              String(item.assistanceLevel),
              this.optionalNumber(
                item.score,
              ),
              this.optionalString(
                item.notes,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );
        }

        if (input.cognitive) {
          const c =
            input.cognitive;

          await client.query(
            `
            INSERT INTO admission_cognitive_assessments (
              admission_cognitive_assessment_id,
              admission_assessment_id,
              alertness,
              orientation,
              memory,
              communication,
              behavior,
              mood,
              cognitive_impairment,
              notes,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              'admission-cognitive-' ||
                gen_random_uuid()::text,
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            )
            `,
            [
              assessmentId,
              this.optionalString(
                c.alertness,
              ),
              this.optionalString(
                c.orientation,
              ),
              this.optionalString(
                c.memory,
              ),
              this.optionalString(
                c.communication,
              ),
              this.optionalString(
                c.behavior,
              ),
              this.optionalString(
                c.mood,
              ),
              this.optionalString(
                c.cognitiveImpairment,
              ),
              this.optionalString(
                c.notes,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );
        }

        if (input.nutrition) {
          const n =
            input.nutrition;

          await client.query(
            `
            INSERT INTO admission_nutrition_assessments (
              admission_nutrition_assessment_id,
              admission_assessment_id,
              diet_type,
              swallowing_status,
              oral_health,
              feeding_assistance_required,
              nutrition_risk,
              hydration_observation,
              notes,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              'admission-nutrition-' ||
                gen_random_uuid()::text,
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
            )
            `,
            [
              assessmentId,
              this.optionalString(
                n.dietType,
              ),
              this.optionalString(
                n.swallowingStatus,
              ),
              this.optionalString(
                n.oralHealth,
              ),
              n.feedingAssistanceRequired === true,
              this.optionalString(
                n.nutritionRisk,
              ),
              this.optionalString(
                n.hydrationObservation,
              ),
              this.optionalString(
                n.notes,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );
        }

        for (const item of risks) {
          await client.query(
            `
            INSERT INTO admission_risk_items (
              admission_risk_item_id,
              admission_assessment_id,
              risk_type,
              risk_level,
              score,
              assessment_method,
              details,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              'admission-risk-' ||
                gen_random_uuid()::text,
              $1,$2,$3,$4,$5,$6,$7,$8
            )
            `,
            [
              assessmentId,
              String(item.riskType),
              String(item.riskLevel),
              this.optionalNumber(
                item.score,
              ),
              this.optionalString(
                item.assessmentMethod,
              ),
              this.optionalString(
                item.details,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );
        }

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            entity_type,
            entity_id,
            new_state
          )
          VALUES (
            $1,
            'ASSESSMENT_COMPLETED',
            $2,
            $3,
            'ADMISSION_ASSESSMENT',
            $4,
            jsonb_build_object(
              'assessmentType',
              $5::text
            )
          )
          `,
          [
            admissionCaseId,
            actor.actorId,
            actor.actorRole,
            assessmentId,
            assessmentType,
          ],
        );

        return {
          admissionAssessmentId:
            assessmentId,
          status:
            'COMPLETED',
          adlItemCount:
            adl.length,
          riskItemCount:
            risks.length,
        };
      },
    );
  }

  private async latestAssessment(
    admissionCaseId: string,
  ) {
    const result =
      await this.database.query(
        `
        SELECT *
        FROM admission_assessments
        WHERE
          admission_case_id=$1
          AND status IN (
            'COMPLETED',
            'VERIFIED'
          )
        ORDER BY
          completed_at DESC NULLS LAST,
          created_at DESC
        LIMIT 1
        `,
        [admissionCaseId],
      );

    if (!result.rows[0]) {
      throw new BadRequestException(
        'Chưa có đánh giá ban đầu hoàn thành.',
      );
    }

    return result.rows[0];
  }

  async generateClassification(
    actor: ActorContext,
    admissionCaseId: string,
  ) {
    await this.assertActor(
      actor,
      [
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    await this.assertCase(
      admissionCaseId,
    );

    const assessment =
      await this.latestAssessment(
        admissionCaseId,
      );

    const assessmentId =
      assessment
        .admission_assessment_id;

    const adlResult =
      await this.database.query<{
        activity_code: string;
        assistance_level:
          AssistanceLevel;
      }>(
        `
        SELECT
          activity_code,
          assistance_level
        FROM admission_adl_items
        WHERE admission_assessment_id=$1
        `,
        [assessmentId],
      );

    const riskResult =
      await this.database.query<{
        risk_type: string;
        risk_level: RiskLevel;
      }>(
        `
        SELECT
          risk_type,
          risk_level
        FROM admission_risk_items
        WHERE admission_assessment_id=$1
        `,
        [assessmentId],
      );

    const present =
      new Set(
        adlResult.rows.map(
          (row) =>
            row.activity_code,
        ),
      );

    const missingRequirements =
      ADL_ACTIVITIES.filter(
        (activity) =>
          !present.has(activity),
      );

    const assistanceRank:
      Record<AssistanceLevel, number> = {
        INDEPENDENT: 0,
        SUPERVISION: 1,
        PARTIAL_ASSISTANCE: 1,
        SUBSTANTIAL_ASSISTANCE: 2,
        FULL_ASSISTANCE: 3,
      };

    const riskRankMap:
      Record<RiskLevel, number> = {
        LOW: 0,
        MODERATE: 1,
        HIGH: 2,
        CRITICAL: 3,
      };

    let adlRank = 0;
    let riskRank = 0;

    const triggeredRules:
      string[] = [];

    const redFlags:
      string[] = [];

    for (
      const item
      of adlResult.rows
    ) {
      const rank =
        assistanceRank[
          item.assistance_level
        ];

      adlRank =
        Math.max(
          adlRank,
          rank,
        );

      if (rank > 0) {
        triggeredRules.push(
          `ADL:${item.activity_code}:${item.assistance_level}`,
        );
      }
    }

    for (
      const item
      of riskResult.rows
    ) {
      const rank =
        riskRankMap[
          item.risk_level
        ];

      riskRank =
        Math.max(
          riskRank,
          rank,
        );

      if (rank > 0) {
        triggeredRules.push(
          `RISK:${item.risk_type}:${item.risk_level}`,
        );
      }

      if (
        item.risk_level ===
          'HIGH' ||
        item.risk_level ===
          'CRITICAL'
      ) {
        redFlags.push(
          `${item.risk_type}:${item.risk_level}`,
        );
      }
    }

    const finalRank =
      Math.max(
        adlRank,
        riskRank,
      );

    const suggestedCareLevel =
      missingRequirements.length > 0
        ? null
        : CARE_LEVELS[
            finalRank
          ];

    const reviewStatus =
      missingRequirements.length > 0
        ? 'REASSESSMENT_REQUIRED'
        : 'PENDING';

    const reassessmentRequired =
      missingRequirements.length > 0;

    return this.database.withTransaction(
      async (client) => {
        const inserted =
          await client.query(
            `
            INSERT INTO admission_care_classifications (
              admission_care_classification_id,
              admission_case_id,
              admission_assessment_id,
              rule_set_version,
              domain_scores,
              triggered_rules,
              red_flags,
              missing_requirements,
              suggested_care_level,
              suggestion_generated_at,
              review_status,
              reassessment_required
            )
            VALUES (
              'admission-classification-' ||
                gen_random_uuid()::text,
              $1,
              $2,
              $3,
              $4::jsonb,
              $5::jsonb,
              $6::jsonb,
              $7::jsonb,
              $8,
              now(),
              $9,
              $10
            )
            RETURNING *
            `,
            [
              admissionCaseId,
              assessmentId,
              this.ruleSetVersion,
              JSON.stringify({
                adlHighestRank:
                  adlRank,
                riskHighestRank:
                  riskRank,
                adlItemCount:
                  adlResult.rows.length,
                riskItemCount:
                  riskResult.rows.length,
              }),
              JSON.stringify(
                triggeredRules,
              ),
              JSON.stringify(
                redFlags,
              ),
              JSON.stringify(
                missingRequirements,
              ),
              suggestedCareLevel,
              reviewStatus,
              reassessmentRequired,
            ],
          );

        const row =
          inserted.rows[0];

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            entity_type,
            entity_id,
            new_state
          )
          VALUES (
            $1,
            'CLASSIFICATION_GENERATED',
            $2,
            $3,
            'CARE_CLASSIFICATION',
            $4,
            jsonb_build_object(
              'suggestedCareLevel',
              $5::text,
              'ruleSetVersion',
              $6::text
            )
          )
          `,
          [
            admissionCaseId,
            actor.actorId,
            actor.actorRole,
            row
              .admission_care_classification_id,
            suggestedCareLevel,
            this.ruleSetVersion,
          ],
        );

        return {
          classificationId:
            row
              .admission_care_classification_id,

          ruleSetVersion:
            row.rule_set_version,

          suggestedCareLevel:
            row.suggested_care_level,

          reviewStatus:
            row.review_status,

          triggeredRules:
            row.triggered_rules,

          redFlags:
            row.red_flags,

          missingRequirements:
            row.missing_requirements,

          reassessmentRequired:
            row
              .reassessment_required,
        };
      },
    );
  }

  async approveClassification(
    actor: ActorContext,
    admissionCaseId: string,
    classificationId: string,
    input: ApprovalInput,
  ) {
    await this.assertActor(
      actor,
      [
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    await this.assertCase(
      admissionCaseId,
    );

    const approvedCareLevel =
      this.requiredString(
        input.approvedCareLevel,
        'Mức chăm sóc được phê duyệt',
      );

    if (
      !CARE_LEVELS.includes(
        approvedCareLevel as CareLevel,
      )
    ) {
      throw new BadRequestException(
        'Mức chăm sóc không hợp lệ.',
      );
    }

    const existing =
      await this.database.query<{
        suggested_care_level:
          CareLevel | null;
      }>(
        `
        SELECT
          suggested_care_level
        FROM admission_care_classifications
        WHERE
          admission_case_id=$1
          AND admission_care_classification_id=$2
        LIMIT 1
        `,
        [
          admissionCaseId,
          classificationId,
        ],
      );

    const current =
      existing.rows[0];

    if (!current) {
      throw new NotFoundException(
        'Không tìm thấy kết quả phân loại.',
      );
    }

    if (
      !current
        .suggested_care_level
    ) {
      throw new BadRequestException(
        'Chưa đủ dữ liệu để phê duyệt mức chăm sóc.',
      );
    }

    const overrideApplied =
      current
        .suggested_care_level !==
      approvedCareLevel;

    const overrideReason =
      this.optionalString(
        input.overrideReason,
      );

    if (
      overrideApplied &&
      !overrideReason
    ) {
      throw new BadRequestException(
        'Phải ghi rõ lý do khi thay đổi đề xuất của hệ thống.',
      );
    }

    const reviewStatus =
      overrideApplied
        ? 'OVERRIDDEN'
        : 'APPROVED';

    return this.database.withTransaction(
      async (client) => {
        const updated =
          await client.query(
            `
            UPDATE admission_care_classifications
            SET
              approved_care_level=$1,
              approved_by=$2,
              approved_by_role=$3,
              approved_at=now(),
              override_applied=$4,
              override_reason=$5,
              review_status=$6,
              updated_at=now()
            WHERE
              admission_case_id=$7
              AND admission_care_classification_id=$8
            RETURNING *
            `,
            [
              approvedCareLevel,
              actor.actorId,
              actor.actorRole,
              overrideApplied,
              overrideReason,
              reviewStatus,
              admissionCaseId,
              classificationId,
            ],
          );

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            entity_type,
            entity_id,
            reason,
            new_state
          )
          VALUES (
            $1,
            'CLASSIFICATION_APPROVED',
            $2,
            $3,
            'CARE_CLASSIFICATION',
            $4,
            $5,
            jsonb_build_object(
              'approvedCareLevel',
              $6::text,
              'overrideApplied',
              $7::boolean
            )
          )
          `,
          [
            admissionCaseId,
            actor.actorId,
            actor.actorRole,
            classificationId,
            overrideReason,
            approvedCareLevel,
            overrideApplied,
          ],
        );

        const row =
          updated.rows[0];

        return {
          classificationId:
            row
              .admission_care_classification_id,

          suggestedCareLevel:
            row.suggested_care_level,

          approvedCareLevel:
            row.approved_care_level,

          reviewStatus:
            row.review_status,

          overrideApplied:
            row.override_applied,

          overrideReason:
            row.override_reason,

          approvedBy:
            row.approved_by,

          approvedAt:
            row.approved_at,
        };
      },
    );
  }

  async createDecision(
    actor: ActorContext,
    admissionCaseId: string,
    input: DecisionInput,
  ) {
    await this.assertActor(
      actor,
      [
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    const admissionCase =
      await this.assertCase(
        admissionCaseId,
      );

    const decision =
      this.requiredString(
        input.decision,
        'Quyết định tiếp nhận',
      );

    const allowed = [
      'APPROVED',
      'CONDITIONAL',
      'FURTHER_ASSESSMENT',
      'NOT_SUITABLE',
    ];

    if (
      !allowed.includes(
        decision,
      )
    ) {
      throw new BadRequestException(
        'Quyết định tiếp nhận không hợp lệ.',
      );
    }

    return this.database.withTransaction(
      async (client) => {
        const result =
          await client.query(
            `
            INSERT INTO admission_decisions (
              admission_decision_id,
              admission_case_id,
              decision,
              conditions,
              reason,
              decided_by,
              decided_by_role
            )
            VALUES (
              'admission-decision-' ||
                gen_random_uuid()::text,
              $1,$2,$3,$4,$5,$6
            )
            RETURNING *
            `,
            [
              admissionCaseId,
              decision,
              this.optionalString(
                input.conditions,
              ),
              this.optionalString(
                input.reason,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );

        const decisionId =
          result.rows[0]
            .admission_decision_id;

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            entity_type,
            entity_id,
            reason,
            new_state
          )
          VALUES (
            $1,
            'ADMISSION_DECIDED',
            $2,
            $3,
            'ADMISSION_DECISION',
            $4,
            $5,
            jsonb_build_object(
              'decision',
              $6::text
            )
          )
          `,
          [
            admissionCaseId,
            actor.actorId,
            actor.actorRole,
            decisionId,
            this.optionalString(
              input.reason,
            ),
            decision,
          ],
        );

        return {
          admissionDecisionId:
            decisionId,

          decision,

          admissionCaseStatus:
            admissionCase.status,

          residentId:
            admissionCase
              .resident_id ?? null,
        };
      },
    );
  }

  async overview(
    actor: ActorContext,
    admissionCaseId: string,
  ) {
    await this.assertActor(
      actor,
      [
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    await this.assertCase(
      admissionCaseId,
    );

    const assessment =
      await this.database.query(
        `
        SELECT *
        FROM admission_assessments
        WHERE admission_case_id=$1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [admissionCaseId],
      );

    const assessmentId =
      assessment.rows[0]
        ?.admission_assessment_id ??
      null;

    const adl =
      assessmentId
        ? await this.database.query(
            `
            SELECT *
            FROM admission_adl_items
            WHERE admission_assessment_id=$1
            ORDER BY activity_code
            `,
            [assessmentId],
          )
        : { rows: [] };

    const cognitive =
      assessmentId
        ? await this.database.query(
            `
            SELECT *
            FROM admission_cognitive_assessments
            WHERE admission_assessment_id=$1
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [assessmentId],
          )
        : { rows: [] };

    const nutrition =
      assessmentId
        ? await this.database.query(
            `
            SELECT *
            FROM admission_nutrition_assessments
            WHERE admission_assessment_id=$1
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [assessmentId],
          )
        : { rows: [] };

    const risks =
      assessmentId
        ? await this.database.query(
            `
            SELECT *
            FROM admission_risk_items
            WHERE admission_assessment_id=$1
            ORDER BY created_at
            `,
            [assessmentId],
          )
        : { rows: [] };

    const classification =
      await this.database.query(
        `
        SELECT *
        FROM admission_care_classifications
        WHERE admission_case_id=$1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [admissionCaseId],
      );

    const decision =
      await this.database.query(
        `
        SELECT *
        FROM admission_decisions
        WHERE admission_case_id=$1
        ORDER BY decided_at DESC
        LIMIT 1
        `,
        [admissionCaseId],
      );

    return {
      assessment:
        assessment.rows[0] ??
        null,

      adl:
        adl.rows,

      cognitive:
        cognitive.rows[0] ??
        null,

      nutrition:
        nutrition.rows[0] ??
        null,

      risks:
        risks.rows,

      classification:
        classification.rows[0] ??
        null,

      decision:
        decision.rows[0] ??
        null,
    };
  }
}
