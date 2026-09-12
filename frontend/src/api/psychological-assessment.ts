import { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';
import { ROLE_LABELS } from '../auth/role-policy';

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

let mockPsychologicalAssessments: PsychologicalAssessment[] = [
  {
    id: 'PSY-202609-001',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    roomNumber: 'Phòng 101',
    assessmentDate: '2026-09-05',
    period: 'MONTHLY',
    periodLabel: 'Đánh giá định kỳ Tháng 09/2026',
    evaluatorId: 'STAFF-PSY-001',
    evaluatorName: 'ThS. Nguyễn Thu Trang',
    evaluatorRole: 'PSYCHOLOGIST',
    evaluatorRoleLabel: 'Nhân viên Tâm lý',
    emotionalState: 'CHEERFUL',
    emotionalStateLabel: 'Vui vẻ, tinh thần phấn chấn',
    emotionalNotes: 'Cụ An tâm lý rất vui tươi sau khi con cháu đến thăm tuần trước. Thường xuyên cười nói với điều dưỡng.',
    socialCommunication: 'ACTIVE',
    socialCommunicationLabel: 'Tích cực giao tiếp, hăng hái tham gia hoạt động chung',
    socialNotes: 'Tích cực tham gia câu lạc bộ cờ tướng và trị liệu âm nhạc chiều thứ 4.',
    cognitiveMemory: 'ALERT',
    cognitiveMemoryLabel: 'Tỉnh táo, trí nhớ ổn định theo tuổi',
    sleepQuality: 'GOOD',
    sleepQualityLabel: 'Giấc ngủ ngon, ngủ đủ 7-8 tiếng/đêm',
    overallConclusion: 'Tinh thần và tâm lý cụ An đạt mức rất tốt. Cụ có sự kết nối xã hội cao và động lực sống tích cực.',
    careRecommendations: 'Gia đình tiếp tục duy trì lịch thăm định kỳ cuối tuần. Khuyến khích cụ duy trì đánh cờ và vẽ tranh.',
    sharedWithFamilyAt: '2026-09-05T16:00:00+07:00',
  },
  {
    id: 'PSY-202609-002',
    residentId: 'res-demo-002',
    residentName: 'Trần Thị Bình',
    roomNumber: 'Phòng 102',
    assessmentDate: '2026-09-08',
    period: 'MONTHLY',
    periodLabel: 'Đánh giá định kỳ Tháng 09/2026',
    evaluatorId: 'STAFF-SW-002',
    evaluatorName: 'Phạm Thị Hải Yến',
    evaluatorRole: 'SOCIAL_WORKER',
    evaluatorRoleLabel: 'Nhân viên Công tác xã hội',
    emotionalState: 'ANXIOUS',
    emotionalStateLabel: 'Có dấu hiệu lo âu, bồn chồn',
    emotionalNotes: 'Cụ Bình nhớ nhà vào buổi chiều tối (hội chứng hoàng hôn nhẹ). Hay hỏi nhân viên về con gái.',
    socialCommunication: 'WITHDRAWN',
    socialCommunicationLabel: 'Thu mình, ít trò chuyện, thích ở phòng riêng',
    socialNotes: 'Ngồi xem tivi một mình, chưa chủ động bắt chuyện với bạn cùng phòng.',
    cognitiveMemory: 'MILD_FORGETFUL',
    cognitiveMemoryLabel: 'Giảm nhớ ngắn hạn nhẹ',
    sleepQuality: 'INTERRUPTED',
    sleepQualityLabel: 'Giấc ngủ chập chờn, hay thức giấc lúc 2-3h sáng',
    overallConclusion: 'Cụ Bình đang trong giai đoạn thích ứng tâm lý. Cần hỗ trợ công tác xã hội và liệu pháp trò chuyện ấm áp.',
    careRecommendations: 'Nhân viên CTXH sẽ thực hiện liệu pháp trò chuyện cá nhân 15 phút/ngày. Đề xuất người thân tăng cường gọi video call buổi tối.',
    sharedWithFamilyAt: '2026-09-08T17:30:00+07:00',
  },
];

export async function fetchPsychologicalAssessments(residentId?: string): Promise<PsychologicalAssessment[]> {
  await new Promise((r) => setTimeout(r, 100));
  if (residentId) {
    return mockPsychologicalAssessments.filter((p) => p.residentId === residentId);
  }
  return [...mockPsychologicalAssessments];
}

export async function createPsychologicalAssessment(
  actor: HumanActorSession,
  input: Omit<PsychologicalAssessment, 'id' | 'evaluatorId' | 'evaluatorName' | 'evaluatorRole' | 'evaluatorRoleLabel' | 'sharedWithFamilyAt'>
): Promise<PsychologicalAssessment> {
  await new Promise((r) => setTimeout(r, 150));

  const roleLabel = actor.actorRole === 'PSYCHOLOGIST'
    ? 'Nhân viên Tâm lý'
    : actor.actorRole === 'SOCIAL_WORKER'
    ? 'Nhân viên Công tác xã hội'
    : (actor.actorRole || 'Chuyên viên');

  const newForm: PsychologicalAssessment = {
    ...input,
    id: `PSY-${Date.now().toString().slice(-6)}`,
    evaluatorId: actor.actorId || 'STAFF-PSY-001',
    evaluatorName: actor.displayName || 'Chuyên viên Tâm lý',
    evaluatorRole: (actor.actorRole as any) || 'PSYCHOLOGIST',
    evaluatorRoleLabel: roleLabel,
    sharedWithFamilyAt: new Date().toISOString(),
  };

  mockPsychologicalAssessments = [newForm, ...mockPsychologicalAssessments];

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-PSY-001',
    actorName: actor.displayName || 'Chuyên viên Tâm lý',
    actorRole: actor.actorRole || 'PSYCHOLOGIST',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Chuyên viên',
    actionType: 'CREATE',
    actionLabel: 'Lập Phiếu Đánh Giá Tâm Lý Định Kỳ',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Đánh Giá Tâm Lý & CTXH',
    targetEntityId: newForm.id,
    targetEntityName: `Phiếu tâm lý cụ ${newForm.residentName} (${newForm.periodLabel})`,
    summary: `${roleLabel} ${actor.displayName || ''} đã đánh giá tâm lý cho cụ ${newForm.residentName}. Kết luận: ${newForm.overallConclusion}`,
    details: `Trạng thái: ${newForm.emotionalStateLabel} | Giao tiếp: ${newForm.socialCommunicationLabel} | Đã phát hành lên Cổng thân nhân.`,
    severity: 'IMPORTANT',
  });

  return newForm;
}
