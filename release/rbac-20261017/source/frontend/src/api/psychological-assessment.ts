import { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';
import { ROLE_LABELS } from '../auth/role-policy';
import { apiRequest } from './client';

export interface PsychologicalAssessment {
  id: string;
  residentId: string;
  residentName: string;
  roomNumber: string;
  assessmentDate: string; // ISO String / YYYY-MM-DD
  period: 'MONTHLY' | 'QUARTERLY' | 'AD_HOC';
  periodLabel: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: 'PSYCHOLOGIST' | 'SOCIAL_WORKER' | 'SUPERVISOR' | 'ADMIN';
  evaluatorRoleLabel: string;

  // Tiêu chí đánh giá tâm lý chi tiết
  emotionalState: 'CHEERFUL' | 'STABLE' | 'ANXIOUS' | 'DEPRESSED' | 'AGITATED' | 'APATHETIC';
  emotionalStateLabel: string;
  emotionalNotes?: string;

  socialCommunication: 'ACTIVE' | 'NORMAL' | 'WITHDRAWN' | 'RESISTANT' | 'ISOLATED';
  socialCommunicationLabel: string;
  socialNotes?: string;

  cognitiveMemory: 'ALERT' | 'MILD_FORGETFUL' | 'MODERATE_IMPAIRMENT' | 'DISORIENTED';
  cognitiveMemoryLabel: string;

  sleepQuality: 'GOOD' | 'INTERRUPTED' | 'INSOMNIA' | 'NIGHT_WANDERING';
  sleepQualityLabel: string;

  overallConclusion: string; // Kết luận tổng quát
  careRecommendations: string; // Khuyến nghị chăm sóc gửi gia đình

  sharedWithFamilyAt?: string; // Thời gian gửi/chia sẻ cho gia đình trên Cổng thân nhân
}

export const EMOTIONAL_STATE_META: Record<string, { label: string; badge: string }> = {
  CHEERFUL: { label: 'Vui vẻ, tinh thần phấn chấn', badge: 'badge-success' },
  STABLE: { label: 'Tâm lý ổn định, bình hòa', badge: 'badge-info' },
  ANXIOUS: { label: 'Có dấu hiệu lo âu, bồn chồn', badge: 'badge-warning' },
  DEPRESSED: { label: 'Trầm cảm, u buồn, chán ăn', badge: 'badge-danger' },
  AGITATED: { label: 'Kích động, cáu gắt, nhạy cảm', badge: 'badge-danger' },
  APATHETIC: { label: 'Thờ ơ, thụ động, ít phản ứng', badge: 'badge-neutral' },
};

export const SOCIAL_COMMUNICATION_META: Record<string, { label: string }> = {
  ACTIVE: { label: 'Tích cực giao tiếp, hăng hái tham gia hoạt động chung' },
  NORMAL: { label: 'Tương tác bình thường với nhân viên & các cụ xung quanh' },
  WITHDRAWN: { label: 'Thu mình, ít trò chuyện, thích ở phòng riêng' },
  RESISTANT: { label: 'Xung đột nhẹ, từ chối tương tác xã hội' },
  ISOLATED: { label: 'Cô lập hoàn toàn, không muốn tiếp xúc' },
};

type PsychologicalAssessmentRow = {
  psychological_assessment_id: string;
  resident_id: string;
  resident_name?: string;
  room_number?: string;
  assessment_date: string;
  period: PsychologicalAssessment['period'];
  period_label: string;
  emotional_state: PsychologicalAssessment['emotionalState'];
  emotional_notes?: string | null;
  social_communication: PsychologicalAssessment['socialCommunication'];
  social_notes?: string | null;
  cognitive_memory: PsychologicalAssessment['cognitiveMemory'];
  sleep_quality: PsychologicalAssessment['sleepQuality'];
  overall_conclusion: string;
  care_recommendations: string;
  evaluator_id: string;
  evaluator_name: string;
  evaluator_role: PsychologicalAssessment['evaluatorRole'];
  evaluator_role_label: string;
  shared_with_family_at?: string | null;
};

const COGNITIVE_MEMORY_META: Record<string, string> = {
  ALERT: 'Tỉnh táo, trí nhớ ổn định theo tuổi',
  MILD_FORGETFUL: 'Giảm nhớ ngắn hạn nhẹ',
  MODERATE_IMPAIRMENT: 'Suy giảm nhận thức mức độ vừa',
  DISORIENTED: 'Mất định hướng',
};

const SLEEP_QUALITY_META: Record<string, string> = {
  GOOD: 'Giấc ngủ tốt',
  INTERRUPTED: 'Giấc ngủ chập chờn, hay thức giấc',
  INSOMNIA: 'Mất ngủ',
  NIGHT_WANDERING: 'Đi lại ban đêm',
};

function mapPsychologicalAssessment(
  row: PsychologicalAssessmentRow,
): PsychologicalAssessment {
  return {
    id: row.psychological_assessment_id,
    residentId: row.resident_id,
    residentName: row.resident_name || row.resident_id,
    roomNumber: row.room_number || '',
    assessmentDate: String(row.assessment_date).slice(0, 10),
    period: row.period,
    periodLabel: row.period_label,
    evaluatorId: row.evaluator_id,
    evaluatorName: row.evaluator_name,
    evaluatorRole: row.evaluator_role,
    evaluatorRoleLabel: row.evaluator_role_label,
    emotionalState: row.emotional_state,
    emotionalStateLabel:
      EMOTIONAL_STATE_META[row.emotional_state]?.label ||
      row.emotional_state,
    emotionalNotes: row.emotional_notes || undefined,
    socialCommunication: row.social_communication,
    socialCommunicationLabel:
      SOCIAL_COMMUNICATION_META[row.social_communication]?.label ||
      row.social_communication,
    socialNotes: row.social_notes || undefined,
    cognitiveMemory: row.cognitive_memory,
    cognitiveMemoryLabel:
      COGNITIVE_MEMORY_META[row.cognitive_memory] ||
      row.cognitive_memory,
    sleepQuality: row.sleep_quality,
    sleepQualityLabel:
      SLEEP_QUALITY_META[row.sleep_quality] ||
      row.sleep_quality,
    overallConclusion: row.overall_conclusion,
    careRecommendations: row.care_recommendations,
    sharedWithFamilyAt:
      row.shared_with_family_at || undefined,
  };
}

export async function fetchPsychologicalAssessments(
  residentId?: string,
  actor?: HumanActorSession,
): Promise<PsychologicalAssessment[]> {
  const path = residentId
    ? `/behavioral-cognitive/${encodeURIComponent(
        residentId,
      )}/psychological-assessments`
    : '/behavioral-cognitive/psychological-assessments';

  const rows =
    await apiRequest<PsychologicalAssessmentRow[]>(
      path,
      actor
        ? {
            actor,
          }
        : undefined,
    );

  return rows.map(mapPsychologicalAssessment);
}

export async function fetchGuardianResidentIds(
  actor: HumanActorSession,
): Promise<string[]> {
  if (
    !actor?.actorId ||
    actor.actorRole !== 'GUARDIAN'
  ) {
    return [];
  }

  const result =
    await apiRequest<{
      residentIds: string[];
    }>(
      '/behavioral-cognitive/guardian-resident-ids',
      {
        actor,
      },
    );

  return Array.isArray(result?.residentIds)
    ? result.residentIds
    : [];
}

export async function createPsychologicalAssessment(
  actor: HumanActorSession,
  input: Omit<
    PsychologicalAssessment,
    | 'id'
    | 'evaluatorId'
    | 'evaluatorName'
    | 'evaluatorRole'
    | 'evaluatorRoleLabel'
    | 'sharedWithFamilyAt'
  >,
): Promise<PsychologicalAssessment> {
  if (!actor?.actorId || !actor?.actorRole) {
    throw new Error(
      'Không xác định được người thực hiện đánh giá tâm lý.',
    );
  }

  const roleLabel =
    actor.actorRole === 'PSYCHOLOGIST'
      ? 'Nhân viên Tâm lý'
      : actor.actorRole === 'SOCIAL_WORKER'
      ? 'Nhân viên Công tác xã hội'
      : ROLE_LABELS[actor.actorRole] ||
        actor.actorRole ||
        'Chuyên viên';

  const row =
    await apiRequest<PsychologicalAssessmentRow>(
      `/behavioral-cognitive/${encodeURIComponent(
        input.residentId,
      )}/psychological-assessments`,
      {
        method: 'POST',
        actor,
        body: JSON.stringify({
          ...input,
          actorId: actor.actorId,
          actorRole: actor.actorRole,
          actorName: actor.displayName,
          evaluatorName: actor.displayName,
          evaluatorRoleLabel: roleLabel,
        }),
      },
    );

  const newForm = mapPsychologicalAssessment({
    ...row,
    resident_name:
      row.resident_name || input.residentName,
    room_number:
      row.room_number || input.roomNumber,
  });

  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName:
      actor.displayName || 'Chuyên viên Tâm lý',
    actorRole: actor.actorRole,
    actorRoleLabel:
      ROLE_LABELS[actor.actorRole] ||
      actor.actorRole ||
      'Chuyên viên',
    actionType: 'CREATE',
    actionLabel:
      'Lập Phiếu Đánh Giá Tâm Lý Định Kỳ',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Đánh Giá Tâm Lý & CTXH',
    targetEntityId: newForm.id,
    targetEntityName:
      `Phiếu tâm lý cụ ${newForm.residentName} (${newForm.periodLabel})`,
    summary:
      `${roleLabel} ${actor.displayName || ''} đã đánh giá tâm lý cho cụ ${newForm.residentName}. Kết luận: ${newForm.overallConclusion}`,
    details:
      `Trạng thái: ${newForm.emotionalStateLabel} | Giao tiếp: ${newForm.socialCommunicationLabel} | Đã lưu vào hồ sơ chuyên môn.`,
    severity: 'IMPORTANT',
  });

  return newForm;
}
