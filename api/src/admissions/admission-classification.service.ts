import {
  BadRequestException,
  ConflictException,
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
  amendmentReason?: unknown;

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

  private async assertAdmissionApprovalAuthority(
    actor: ActorContext,
  ): Promise<void> {
    const result =
      await this.database.query<{
        active: boolean;
      }>(
        `
        SELECT
          authority.active
        FROM admission_approval_authorities authority
        JOIN staff_actors staff
          ON staff.actor_id = authority.actor_id
        WHERE
          authority.actor_id = $1
          AND authority.active = true
          AND staff.status = 'ACTIVE'
        LIMIT 1
        `,
        [actor.actorId],
      );

    if (!result.rows[0]?.active) {
      throw new ForbiddenException(
        'Chỉ Giám đốc/Ban giám đốc hoặc người được ủy quyền mới có quyền phê duyệt tiếp nhận chính thức.',
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
        'MEDICAL_HEAD',
        'CARE_MANAGER',
        'SUPERVISOR',
        'ADMIN',
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
        const lockedCase =
          await client.query<{
            status: string;
            resident_id: string | null;
          }>(
            `
            SELECT
              status,
              resident_id
            FROM admission_cases
            WHERE admission_case_id=$1
            FOR UPDATE
            `,
            [admissionCaseId],
          );

        const caseRow =
          lockedCase.rows[0];

        if (!caseRow) {
          throw new NotFoundException(
            'Không tìm thấy hồ sơ tiếp nhận.',
          );
        }

        const versionResult =
          await client.query<{
            next_version: string | number;
          }>(
            `
            SELECT
              COALESCE(
                MAX(assessment_version),
                0
              ) + 1 AS next_version
            FROM admission_assessments
            WHERE
              admission_case_id=$1
              AND assessment_type=$2
            `,
            [
              admissionCaseId,
              assessmentType,
            ],
          );

        const nextVersion =
          Number(
            versionResult.rows[0]
              ?.next_version || 1,
          );

        const isPostAdmission =
          caseRow.status === 'ADMITTED'
          && Boolean(caseRow.resident_id);

        const amendmentReason =
          this.optionalString(
            input.amendmentReason,
          );

        if (
          isPostAdmission &&
          !amendmentReason
        ) {
          throw new BadRequestException(
            'Vui lòng nhập lý do bổ sung/chỉnh sửa Phiếu đánh giá sau tiếp nhận.',
          );
        }

        let previousAssessmentId:
          string | null = null;

        let previousAssessmentVersion:
          number | null = null;

        if (isPostAdmission) {
          const previousResult =
            await client.query<{
              admission_assessment_id: string;
              assessment_version: number;
            }>(
              `
              SELECT
                admission_assessment_id,
                assessment_version
              FROM admission_assessments
              WHERE
                admission_case_id=$1
                AND assessment_type=$2
              ORDER BY
                assessment_version DESC,
                created_at DESC
              LIMIT 1
              `,
              [
                admissionCaseId,
                assessmentType,
              ],
            );

          if (previousResult.rows[0]) {
            previousAssessmentId =
              previousResult.rows[0]
                .admission_assessment_id;

            previousAssessmentVersion =
              Number(
                previousResult.rows[0]
                  .assessment_version,
              );
          }
        }

        const assessmentStatus =
          isPostAdmission
            ? 'AMENDED'
            : 'COMPLETED';

        const assessment =
          await client.query(
            `
            INSERT INTO admission_assessments (
              admission_assessment_id,
              admission_case_id,
              assessment_type,
              assessment_version,
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
              $3,
              $4,
              now(),
              now(),
              $5,
              $6,
              $7,
              $8
            )
            RETURNING *
            `,
            [
              admissionCaseId,
              assessmentType,
              nextVersion,
              assessmentStatus,
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

        const assessmentAuditEvent =
          isPostAdmission
            ? 'ASSESSMENT_AMENDED'
            : 'ASSESSMENT_COMPLETED';

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
            previous_state,
            new_state
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'ADMISSION_ASSESSMENT',
            $5,
            $6,
            CASE
              WHEN $7::text IS NULL
              THEN NULL
              ELSE jsonb_build_object(
                'assessmentId',
                $7::text,
                'assessmentVersion',
                $8::integer
              )
            END,
            jsonb_build_object(
              'assessmentType',
              $9::text,
              'assessmentVersion',
              $10::integer,
              'postAdmissionAmendment',
              $11::boolean,
              'assessmentStatus',
              $12::text,
              'amendmentReason',
              $6::text
            )
          )
          `,
          [
            admissionCaseId,
            assessmentAuditEvent,
            actor.actorId,
            actor.actorRole,
            assessmentId,
            isPostAdmission
              ? amendmentReason
              : null,
            previousAssessmentId,
            previousAssessmentVersion,
            assessmentType,
            nextVersion,
            isPostAdmission,
            assessmentStatus,
          ],
        );

        return {
          admissionAssessmentId:
            assessmentId,
          assessmentVersion:
            nextVersion,
          postAdmissionAmendment:
            isPostAdmission,
          amendmentReason:
            isPostAdmission
              ? amendmentReason
              : null,
          status:
            assessmentStatus,
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
            'VERIFIED',
            'AMENDED'
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
        'MEDICAL_HEAD',
        'CARE_MANAGER',
        'SUPERVISOR',
        'ADMIN',
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
        'ADMIN',
      ],
    );

    await this.assertAdmissionApprovalAuthority(
      actor,
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
        'ADMIN',
      ],
    );

    await this.assertAdmissionApprovalAuthority(
      actor,
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

    if (
      admissionCase.status === 'ADMITTED'
    ) {
      throw new ConflictException(
        'Không thể thay đổi quyết định của hồ sơ đã ADMITTED.',
      );
    }

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

    const nextAdmissionStatus:
      Record<string, string> = {
        APPROVED:
          'APPROVED_FOR_ADMISSION',
        CONDITIONAL:
          'CONDITIONAL_ADMISSION',
        FURTHER_ASSESSMENT:
          'FURTHER_ASSESSMENT_REQUIRED',
        NOT_SUITABLE:
          'NOT_SUITABLE',
      };

    const mappedStatus =
      nextAdmissionStatus[decision];

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

        const decisionCaseUpdate =
          await client.query<{
            status: string;
            record_version: string | number;
          }>(
            `
            UPDATE admission_cases
            SET
              status=$2,
              updated_by=$3,
              updated_by_role=$4,
              updated_at=now(),
              record_version=record_version + 1
            WHERE
              admission_case_id=$1
              AND status <> 'ADMITTED'
            RETURNING
              status,
              record_version
            `,
            [
              admissionCaseId,
              mappedStatus,
              actor.actorId,
              actor.actorRole,
            ],
          );

        const updatedCase =
          decisionCaseUpdate.rows[0];

        if (!updatedCase) {
          throw new ConflictException(
            'Không thể cập nhật trạng thái hồ sơ tiếp nhận.',
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
            updatedCase.status,

          residentId:
            admissionCase
              .resident_id ?? null,
        };
      },
    );
  }

  async finalizeAdmission(
    actor: ActorContext,
    admissionCaseId: string,
  ) {
    await this.assertActor(
      actor,
      [
        'CARE_MANAGER',
        'SUPERVISOR',
        'ADMIN',
      ],
    );

    await this.assertAdmissionApprovalAuthority(
      actor,
    );

    return this.database.withTransaction(
      async (client) => {
        const lockedCase =
          await client.query<{
            admission_case_id: string;
            admission_code: string;
            resident_id: string | null;
            prospective_resident_name: string;
            date_of_birth: string | Date | null;
            birth_year: number | null;
            birth_date_precision: string | null;
            gender: string;
            requested_admission_date:
              string | Date | null;
            actual_admission_date:
              string | Date | null;
            admitted_at: Date | null;
            admitted_by: string | null;
            admitted_by_role: string | null;
            status: string;
            record_version: string | number;
          }>(
            `
            SELECT
              admission_case_id,
              admission_code,
              resident_id,
              prospective_resident_name,
              date_of_birth,
              birth_year,
              birth_date_precision,
              gender,
              requested_admission_date,
              actual_admission_date,
              admitted_at,
              admitted_by,
              admitted_by_role,
              status,
              record_version
            FROM admission_cases
            WHERE admission_case_id=$1
            FOR UPDATE
            `,
            [admissionCaseId],
          );

        const admission = lockedCase.rows[0];

        if (!admission) {
          throw new NotFoundException(
            'Không tìm thấy hồ sơ tiếp nhận.',
          );
        }

        if (
          admission.status === 'ADMITTED' &&
          admission.resident_id
        ) {
          const existingResidentResult =
            await client.query<{
              resident_id: string;
              resident_code: string;
              display_name: string;
              care_level: CareLevel;
            }>(
              `
              SELECT
                resident_id,
                resident_code,
                display_name,
                care_level
              FROM residents
              WHERE resident_id=$1
              LIMIT 1
              `,
              [
                admission.resident_id,
              ],
            );

          const existingResident =
            existingResidentResult.rows[0];

          if (!existingResident) {
            throw new ConflictException(
              'Hồ sơ đã ADMITTED nhưng Resident liên kết không tồn tại.',
            );
          }

          return {
            admissionCaseId,
            status: 'ADMITTED',
            residentId:
              existingResident.resident_id,
            residentCode:
              existingResident.resident_code,
            displayName:
              existingResident.display_name,
            careLevel:
              existingResident.care_level,
            actualAdmissionDate:
              admission.actual_admission_date,
            admittedAt:
              admission.admitted_at,
            admittedBy:
              admission.admitted_by,
            admittedByRole:
              admission.admitted_by_role,
            recordVersion:
              Number(admission.record_version),
            idempotent: true,
          };
        }

        if (admission.resident_id) {
          throw new ConflictException(
            'Hồ sơ có resident_id nhưng trạng thái không nhất quán.',
          );
        }

        const decisionResult =
          await client.query<{
            admission_decision_id: string;
            decision: string;
          }>(
            `
            SELECT
              admission_decision_id,
              decision
            FROM admission_decisions
            WHERE admission_case_id=$1
            ORDER BY
              decided_at DESC,
              admission_decision_id DESC
            LIMIT 1
            `,
            [admissionCaseId],
          );

        const latestDecision =
          decisionResult.rows[0];

        if (
          !latestDecision ||
          latestDecision.decision !== 'APPROVED'
        ) {
          throw new ConflictException(
            'Chưa có quyết định tiếp nhận APPROVED hợp lệ.',
          );
        }

        const classificationResult =
          await client.query<{
            admission_care_classification_id:
              string;
            approved_care_level: CareLevel | null;
            review_status: string;
          }>(
            `
            SELECT
              admission_care_classification_id,
              approved_care_level,
              review_status
            FROM admission_care_classifications
            WHERE
              admission_case_id=$1
              AND approved_care_level IS NOT NULL
              AND review_status IN (
                'APPROVED',
                'OVERRIDDEN'
              )
            ORDER BY
              approved_at DESC NULLS LAST,
              updated_at DESC,
              admission_care_classification_id DESC
            LIMIT 1
            `,
            [admissionCaseId],
          );

        const classification =
          classificationResult.rows[0];

        if (
          !classification ||
          !classification.approved_care_level
        ) {
          throw new ConflictException(
            'Chưa có mức chăm sóc được con người phê duyệt.',
          );
        }

        const residentCodeResult =
          await client.query<{
            resident_code: string;
          }>(
            `
            SELECT
              'RES-' ||
              upper(
                substr(
                  replace(
                    gen_random_uuid()::text,
                    '-',
                    ''
                  ),
                  1,
                  12
                )
              ) AS resident_code
            `,
          );

        const residentCode =
          residentCodeResult.rows[0]?.resident_code;

        if (!residentCode) {
          throw new Error(
            'Resident code generation failed',
          );
        }

        const createdResident =
          await client.query<{
            resident_id: string;
            resident_code: string;
            display_name: string;
            date_of_birth: string | Date | null;
            gender: string;
            care_level: CareLevel;
            active_status: boolean;
          }>(
            `
            INSERT INTO residents (
              resident_id,
              resident_code,
              display_name,
              date_of_birth,
              gender,
              room,
              bed,
              care_level,
              active_status
            )
            VALUES (
              'resident-' || gen_random_uuid()::text,
              $1,
              $2,
              $3,
              $4,
              NULL,
              NULL,
              $5,
              true
            )
            RETURNING
              resident_id,
              resident_code,
              display_name,
              date_of_birth,
              gender,
              care_level,
              active_status
            `,
            [
              residentCode,
              admission.prospective_resident_name,
              admission.date_of_birth,
              admission.gender,
              classification.approved_care_level,
            ],
          );

        const resident =
          createdResident.rows[0];

        if (!resident) {
          throw new Error(
            'Resident creation returned no row',
          );
        }

        await client.query(
          `
            UPDATE residents
            SET
              birth_year = $2,
              birth_date_precision = $3
            WHERE resident_id = $1
          `,
          [
            resident.resident_id,
            admission.birth_year,
            admission.birth_date_precision,
          ],
        );

        await client.query(
          `
          INSERT INTO resident_audit (
            event_type,
            target_resident_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          VALUES (
            'RESIDENT_CREATED',
            $1,
            $2,
            $3,
            NULL,
            jsonb_build_object(
              'residentId', $1::text,
              'residentCode', $4::text,
              'displayName', $5::text,
              'dateOfBirth', $6::text,
              'gender', $7::text,
              'careLevel', $8::text,
              'activeStatus', true,
              'source', 'FINAL_ADMISSION'
            )
          )
          `,
          [
            resident.resident_id,
            actor.actorId,
            actor.actorRole,
            resident.resident_code,
            resident.display_name,
            resident.date_of_birth,
            resident.gender,
            resident.care_level,
          ],
        );

        const finalized =
          await client.query<{
            status: string;
            resident_id: string;
            actual_admission_date:
              string | Date;
            admitted_at: Date;
            record_version: string | number;
          }>(
            `
            UPDATE admission_cases
            SET
              resident_id=$1,
              status='ADMITTED',
              actual_admission_date=
                COALESCE(
                  requested_admission_date,
                  CURRENT_DATE
                ),
              admitted_at=now(),
              admitted_by=$2,
              admitted_by_role=$3,
              updated_by=$2,
              updated_by_role=$3,
              updated_at=now(),
              record_version=record_version + 1
            WHERE
              admission_case_id=$4
              AND resident_id IS NULL
              AND status <> 'ADMITTED'
            RETURNING
              status,
              resident_id,
              actual_admission_date,
              admitted_at,
              record_version
            `,
            [
              resident.resident_id,
              actor.actorId,
              actor.actorRole,
              admissionCaseId,
            ],
          );

        const finalCase = finalized.rows[0];

        if (!finalCase) {
          throw new ConflictException(
            'Hồ sơ đã được tiến trình khác hoàn tất.',
          );
        }

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            previous_status,
            new_status,
            entity_type,
            entity_id,
            reason,
            previous_state,
            new_state
          )
          VALUES (
            $1,
            'ADMITTED',
            $2,
            $3,
            $4,
            'ADMITTED',
            'ADMISSION_CASE',
            $1,
            'Final admission completed',
            jsonb_build_object(
              'status', $4::text,
              'residentId', NULL
            ),
            jsonb_build_object(
              'status', 'ADMITTED',
              'residentId', $5::text,
              'approvedCareLevel', $6::text,
              'decisionId', $7::text,
              'classificationId', $8::text
            )
          )
          `,
          [
            admissionCaseId,
            actor.actorId,
            actor.actorRole,
            admission.status,
            resident.resident_id,
            classification.approved_care_level,
            latestDecision.admission_decision_id,
            classification
              .admission_care_classification_id,
          ],
        );

        await client.query(
          `
          INSERT INTO admission_approval_snapshots (
            admission_case_id,
            resident_id,
            admission_assessment_id,
            assessment_version,
            snapshot_type,
            snapshot_data,
            approved_by,
            approved_by_role,
            approved_at
          )
          SELECT
            ac.admission_case_id,
            $2,
            aa.admission_assessment_id,
            aa.assessment_version,
            'FINAL_ADMISSION',
            jsonb_build_object(
              'admissionCase',
              to_jsonb(ac),

              'assessment',
              CASE
                WHEN aa.admission_assessment_id
                  IS NULL
                THEN NULL
                ELSE to_jsonb(aa)
              END,

              'adl',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    to_jsonb(adl)
                    ORDER BY adl.activity_code
                  )
                  FROM admission_adl_items adl
                  WHERE
                    adl.admission_assessment_id =
                    aa.admission_assessment_id
                ),
                '[]'::jsonb
              ),

              'cognitive',
              (
                SELECT to_jsonb(cognitive)
                FROM admission_cognitive_assessments cognitive
                WHERE
                  cognitive.admission_assessment_id =
                  aa.admission_assessment_id
                ORDER BY cognitive.created_at DESC
                LIMIT 1
              ),

              'nutrition',
              (
                SELECT to_jsonb(nutrition)
                FROM admission_nutrition_assessments nutrition
                WHERE
                  nutrition.admission_assessment_id =
                  aa.admission_assessment_id
                ORDER BY nutrition.created_at DESC
                LIMIT 1
              ),

              'risks',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    to_jsonb(risk)
                    ORDER BY risk.created_at
                  )
                  FROM admission_risk_items risk
                  WHERE
                    risk.admission_assessment_id =
                    aa.admission_assessment_id
                ),
                '[]'::jsonb
              ),

              'classification',
              (
                SELECT to_jsonb(classification_row)
                FROM admission_care_classifications classification_row
                WHERE
                  classification_row
                    .admission_care_classification_id =
                    $3
              ),

              'decision',
              (
                SELECT to_jsonb(decision_row)
                FROM admission_decisions decision_row
                WHERE
                  decision_row
                    .admission_decision_id =
                    $4
              ),

              'resident',
              (
                SELECT to_jsonb(resident_row)
                FROM residents resident_row
                WHERE
                  resident_row.resident_id =
                    $2
              )
            ),
            $5,
            $6,
            now()

          FROM admission_cases ac

          LEFT JOIN LATERAL (
            SELECT assessment_row.*
            FROM admission_assessments assessment_row
            WHERE
              assessment_row.admission_case_id =
                ac.admission_case_id
              AND assessment_row.status IN (
                'COMPLETED',
                'VERIFIED',
                'AMENDED'
              )
            ORDER BY
              assessment_row.assessment_version DESC,
              assessment_row.completed_at DESC NULLS LAST,
              assessment_row.created_at DESC
            LIMIT 1
          ) aa
            ON true

          WHERE
            ac.admission_case_id=$1

          ON CONFLICT (
            admission_case_id,
            snapshot_type
          )
          DO NOTHING
          `,
          [
            admissionCaseId,
            resident.resident_id,
            classification
              .admission_care_classification_id,
            latestDecision
              .admission_decision_id,
            actor.actorId,
            actor.actorRole,
          ],
        );

        return {
          admissionCaseId,
          status: finalCase.status,
          residentId: resident.resident_id,
          residentCode: resident.resident_code,
          displayName: resident.display_name,
          careLevel: resident.care_level,
          actualAdmissionDate:
            finalCase.actual_admission_date,
          admittedAt: finalCase.admitted_at,
          admittedBy: actor.actorId,
          admittedByRole: actor.actorRole,
          recordVersion:
            Number(finalCase.record_version),
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
        'MEDICAL_HEAD',
        'CARE_MANAGER',
        'SUPERVISOR',
        'ADMIN',
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
