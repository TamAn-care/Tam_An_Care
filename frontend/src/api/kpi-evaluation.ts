import { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';
import { sendSystemNotification } from './notifications';
import { ROLE_LABELS } from '../auth/role-policy';

export type JobGroup =
  | 'CAREGIVER'                 // Nhân viên Chăm sóc
  | 'NURSE'                     // Nhân viên Y tế
  | 'NUTRITIONIST'              // Bếp / Dinh dưỡng
  | 'HOUSEKEEPING'              // Tạp vụ
  | 'REHABILITATION_SPECIALIST' // Vật lý trị liệu
  | 'OFFICE_ADMIN';             // Văn phòng & Khác

export interface KPICriterion {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  weight: number; // Điểm trọng số
}

export interface KPICriterionResult {
  criterionId: string;
  criterionCode: string;
  criterionTitle: string;
  status: 'PASSED' | 'FAILED' | 'EXCELLENT';
  note?: string;
}

export interface StaffKPIEvaluationRecord {
  id: string;
  staffId: string;
  staffName: string;
  jobGroup: JobGroup;
  jobGroupLabel: string;
  shiftDate: string; // YYYY-MM-DD
  shiftName: string; // Sáng / Chiều / Đêm / Ca 24h
  evaluatorId: string;
  evaluatorName: string;
  evaluatedAt: string; // ISO
  totalScore: number; // Thang điểm 100
  overallGrade: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'CRITICAL_WARNING';
  overallGradeLabel: string;
  results: KPICriterionResult[];
  warningSent: boolean;
  honorSent: boolean;
  notes?: string;
}

export const JOB_GROUP_LABELS: Record<JobGroup, string> = {
  CAREGIVER: 'Nhân viên Chăm sóc',
  NURSE: 'Nhân viên Y tế / Điều dưỡng',
  NUTRITIONIST: 'Nhân viên Bếp & Dinh dưỡng',
  HOUSEKEEPING: 'Nhân viên Tạp vụ & Vệ sinh',
  REHABILITATION_SPECIALIST: 'Nhân viên Vật lý trị liệu',
  OFFICE_ADMIN: 'Nhân viên Văn phòng & Hành chính',
};

// Bộ tiêu chí chuẩn hóa theo từng nhóm công việc
export const DEFAULT_KPI_CRITERIA_BY_GROUP: Record<JobGroup, KPICriterion[]> = {
  CAREGIVER: [
    { id: 'KPI-CG-01', code: 'CG01', title: 'Tuân thủ quy trình vệ sinh cá nhân cho NCT (Tắm, xoay trở, thay tã đúng cữ)', category: 'Chuyên môn', description: 'Thực hiện đủ cữ tắm, vệ sinh, hỗ trợ xoay trở 2h/lần với cụ cấp độ 3', weight: 25 },
    { id: 'KPI-CG-02', code: 'CG02', title: 'Thái độ chăm sóc ân cần, nhẹ nhàng, không gắt gỏng với các cụ', category: 'Thái độ', description: 'Giao tiếp lịch sự, hỗ trợ tận tình, tạo cảm giác an tâm', weight: 25 },
    { id: 'KPI-CG-03', code: 'CG03', title: 'Báo cáo ngay sự cố lâm sàng hoặc dấu hiệu bất thường cho Y tế', category: 'An toàn', description: 'Kịp thời phát hiện sốt, bỏ ăn, té ngã, trầy xước', weight: 25 },
    { id: 'KPI-CG-04', code: 'CG04', title: 'Ghi nhật ký chăm sóc đầy đủ & bảo quản đồ tiêu hao gia đình gửi', category: 'Hành chính', description: 'Cập nhật ứng dụng đầy đủ, không thất thoát sữa/bỉm của cụ', weight: 25 },
  ],
  NURSE: [
    { id: 'KPI-NU-01', code: 'NU01', title: 'Thực hiện nghiêm ngặt Quy tắc 5 Đúng trong phát & ký eMAR thuốc', category: 'Chuyên môn y tế', description: 'Đúng người, đúng thuốc, đúng liều, đúng đường dùng, đúng thời gian', weight: 30 },
    { id: 'KPI-NU-02', code: 'NU02', title: 'Theo dõi chỉ số sinh hiệu định kỳ & xử lý vết thương đúng chuẩn', category: 'Lâm sàng', description: 'Đo huyết áp, SpO2, đường huyết, thay băng rửa vết loét chuẩn tiệt trùng', weight: 30 },
    { id: 'KPI-NU-03', code: 'NU03', title: 'Quản lý kho Dược phẩm chặt chẽ, kiểm kê hạn sử dụng đúng quy định', category: 'Quản lý kho', description: 'Không để thuốc hết hạn, kiểm kê khớp số lượng tủ thuốc', weight: 20 },
    { id: 'KPI-NU-04', code: 'NU04', title: 'Báo cáo kịp thời chuyển viện & phối hợp bác sĩ tuyến trên', category: 'Phối hợp', description: 'Kịp thời lập hồ sơ chuyển viện khi cụ có diễn biến nặng', weight: 20 },
  ],
  NUTRITIONIST: [
    { id: 'KPI-NT-01', code: 'NT01', title: 'Tiếp nhận & kiểm đếm thực phẩm đầu vào chuẩn an toàn vệ sinh', category: 'An toàn thực phẩm', description: 'Đo nhiệt độ giao hàng, kiểm tra độ tươi sống & chứng nhận VietGAP', weight: 30 },
    { id: 'KPI-NT-02', code: 'NT02', title: 'Chế biến đúng thực đơn dinh dưỡng & đảm bảo giờ chia suất ăn', category: 'Vận hành bếp', description: 'Ăn sáng 07:00-08:00, Trưa 11:00-12:00, Phụ 14:00, Tối 17:00-18:00', weight: 30 },
    { id: 'KPI-NT-03', code: 'NT03', title: 'Lưu mẫu thức ăn 24 giờ đúng hộp niêm phong & tủ lưu mẫu', category: 'Quy chuẩn y tế', description: 'Đủ trọng lượng mẫu >=150g, ghi nhãn rõ ngày giờ người lưu', weight: 20 },
    { id: 'KPI-NT-04', code: 'NT04', title: 'Vệ sinh dụng cụ nấu & khu vực bếp ăn sạch sẽ khô ráo', category: 'Vệ sinh', description: 'Khử khuẩn khay ăn inox và làm sạch sàn bếp sau mỗi ca', weight: 20 },
  ],
  HOUSEKEEPING: [
    { id: 'KPI-HK-01', code: 'HK01', title: 'Làm sạch & khử khuẩn phòng ở NCT, hành lang, nhà vệ sinh', category: 'Vệ sinh', description: 'Phòng ở sạch sẽ, nhà vệ sinh khô ráo không trơn trượt', weight: 35 },
    { id: 'KPI-HK-02', code: 'HK02', title: 'Thu gom & phân loại rác thải sinh hoạt/y tế đúng quy định', category: 'An toàn môi trường', description: 'Đổ rác đúng giờ, túi rác vàng y tế niêm phong chuẩn', weight: 35 },
    { id: 'KPI-HK-03', code: 'HK03', title: 'Giặt sấy & phân loại ga giường, khăn tắm, quần áo cho các cụ', category: 'Giặt giũ', description: 'Quần áo thơm tho, không lẫn lộn giữa các phòng', weight: 30 },
  ],
  REHABILITATION_SPECIALIST: [
    { id: 'KPI-RH-01', code: 'RH01', title: 'Thực hiện đúng bài tập PHCN & vật lý trị liệu theo chỉ định', category: 'Chuyên môn PHCN', description: 'Tập vận động khớp, tập đi, chiếu tia hồng ngoại đủ thời gian', weight: 40 },
    { id: 'KPI-RH-02', code: 'RH02', title: 'Đảm bảo an toàn tuyệt đối cho NCT trong quá trình tập luyện', category: 'An toàn', description: 'Tránh ngã, bong gân, quá sức trong khi tập dụng cụ', weight: 30 },
    { id: 'KPI-RH-03', code: 'RH03', title: 'Ghi nhận tiến triển vận động & báo cáo định kỳ cho Quản lý', category: 'Theo dõi', description: 'Đánh giá thang điểm Barthel / MMT tiến triển hàng tuần', weight: 30 },
  ],
  OFFICE_ADMIN: [
    { id: 'KPI-OF-01', code: 'OF01', title: 'Tiếp đón người nhà thân thiện, giải đáp thắc mắc chu đáo', category: 'Dịch vụ', description: 'Thái độ lịch sự, xử lý nhanh thủ tục hành chính', weight: 35 },
    { id: 'KPI-OF-02', code: 'OF02', title: 'Quản lý hồ sơ cư dân & đối soát hóa đơn viện phí chính xác', category: 'Nghiệp vụ', description: 'Bảng thu phí chính xác, không tính nhầm chi phí', weight: 35 },
    { id: 'KPI-OF-03', code: 'OF03', title: 'Phối hợp điều phối nhân sự & hỗ trợ các khoa phòng vận hành', category: 'Phối hợp', description: 'Kịp thời thông báo ca trực, lịch ăn, lịch thăm cho toàn viện', weight: 30 },
  ],
};

let mockStaffKPIEvaluations: StaffKPIEvaluationRecord[] = [
  {
    id: 'KPI-20260912-001',
    staffId: 'cg-tuan-002',
    staffName: 'Hoàng Văn Tuấn',
    jobGroup: 'CAREGIVER',
    jobGroupLabel: 'Nhân viên Chăm sóc',
    shiftDate: '2026-09-12',
    shiftName: 'Ca Sáng (06:00 - 14:00)',
    evaluatorId: 'STAFF-MGR-001',
    evaluatorName: 'Trần Nguyễn Anh Quản Lý',
    evaluatedAt: '2026-09-12T13:45:00+07:00',
    totalScore: 100,
    overallGrade: 'EXCELLENT',
    overallGradeLabel: 'Xuất Sắc - Khen Thưởng Vinh Danh',
    warningSent: false,
    honorSent: true,
    notes: 'Đã chủ động hỗ trợ cụ An và cụ Bình tập đi dạo vườn hoa. Ghi chép nhật ký trực tuyến rất tỉ mỉ.',
    results: [
      { criterionId: 'KPI-CG-01', criterionCode: 'CG01', criterionTitle: 'Tuân thủ quy trình vệ sinh cá nhân cho NCT', status: 'EXCELLENT' },
      { criterionId: 'KPI-CG-02', criterionCode: 'CG02', criterionTitle: 'Thái độ chăm sóc ân cần, nhẹ nhàng', status: 'EXCELLENT' },
      { criterionId: 'KPI-CG-03', criterionCode: 'CG03', criterionTitle: 'Báo cáo ngay sự cố lâm sàng cho Y tế', status: 'PASSED' },
      { criterionId: 'KPI-CG-04', criterionCode: 'CG04', criterionTitle: 'Ghi nhật ký chăm sóc đầy đủ & bảo quản đồ tiêu hao', status: 'EXCELLENT' },
    ],
  },
];

export async function fetchStaffKPIEvaluations(staffId?: string): Promise<StaffKPIEvaluationRecord[]> {
  await new Promise((r) => setTimeout(r, 100));
  if (staffId) {
    return mockStaffKPIEvaluations.filter((k) => k.staffId === staffId);
  }
  return [...mockStaffKPIEvaluations];
}

export async function submitStaffKPIEvaluation(
  actor: HumanActorSession,
  input: {
    staffId: string;
    staffName: string;
    jobGroup: JobGroup;
    shiftDate: string;
    shiftName: string;
    results: KPICriterionResult[];
    notes?: string;
  }
): Promise<StaffKPIEvaluationRecord> {
  await new Promise((r) => setTimeout(r, 150));

  const totalPassed = input.results.filter((r) => r.status === 'PASSED' || r.status === 'EXCELLENT').length;
  const totalFailed = input.results.filter((r) => r.status === 'FAILED').length;
  const totalExcellent = input.results.filter((r) => r.status === 'EXCELLENT').length;

  let overallGrade: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'CRITICAL_WARNING' = 'GOOD';
  let overallGradeLabel = 'Đạt Yêu Cầu';

  if (totalFailed > 0) {
    overallGrade = totalFailed >= 2 ? 'CRITICAL_WARNING' : 'NEEDS_IMPROVEMENT';
    overallGradeLabel = totalFailed >= 2 ? 'Cảnh Báo Nghiêm Trọng' : 'Cần Nhắc Nhở - Chưa Đạt';
  } else if (totalExcellent >= 3) {
    overallGrade = 'EXCELLENT';
    overallGradeLabel = 'Xuất Sắc - Khen Thưởng Vinh Danh';
  }

  const score = Math.round(((totalPassed + totalExcellent * 0.2) / input.results.length) * 100);

  const isWarning = totalFailed > 0;
  const isHonor = overallGrade === 'EXCELLENT';

  const newRecord: StaffKPIEvaluationRecord = {
    id: `KPI-${Date.now().toString().slice(-8)}`,
    staffId: input.staffId,
    staffName: input.staffName,
    jobGroup: input.jobGroup,
    jobGroupLabel: JOB_GROUP_LABELS[input.jobGroup],
    shiftDate: input.shiftDate,
    shiftName: input.shiftName,
    evaluatorId: actor.actorId || 'STAFF-MGR-001',
    evaluatorName: actor.displayName || 'Nhân viên Quản lý',
    evaluatedAt: new Date().toISOString(),
    totalScore: score,
    overallGrade,
    overallGradeLabel,
    results: input.results,
    warningSent: isWarning,
    honorSent: isHonor,
    notes: input.notes,
  };

  mockStaffKPIEvaluations = [newRecord, ...mockStaffKPIEvaluations];

  // Bán Bell Notice tự động
  if (isWarning) {
    const failedItems = input.results.filter((r) => r.status === 'FAILED').map((r) => r.criterionTitle).join('; ');
    await sendSystemNotification({
      targetStaffId: input.staffId, // Gửi riêng cho cá nhân nhân viên đó
      title: '⚠️ CẢNH BÁO / NHẮC NHỞ KPI CA TRỰC',
      message: `Quản lý ${actor.displayName} đã ghi nhận tiêu chí chưa đạt trong ca ${input.shiftName} ngày ${input.shiftDate}: ${failedItems}. Ghi chú: ${input.notes || 'Vui lòng rút kinh nghiệm và chấn chỉnh ngay'}.`,
      type: 'WARNING_NOTICE',
      severity: 'HIGH',
      isGlobal: false,
    });
  }

  if (isHonor) {
    await sendSystemNotification({
      title: '🌟 VINH DANH KHEN THƯỞNG THÀNH TÍCH CA TRỰC',
      message: `Tâm An Care vinh danh Nhân viên ${input.staffName} (${JOB_GROUP_LABELS[input.jobGroup]}) đã hoàn thành XUẤT SẮC 100% tiêu chí KPI ca ${input.shiftName} ngày ${input.shiftDate}!`,
      type: 'HONOR_NOTICE',
      severity: 'INFO',
      isGlobal: true, // Gửi Bell notice cho toàn thể nhân viên trong Tâm An
    });
  }

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-MGR-001',
    actorName: actor.displayName || 'Nhân viên Quản lý',
    actorRole: actor.actorRole || 'CARE_MANAGER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Quản lý',
    actionType: 'CREATE',
    actionLabel: 'Đánh giá KPI nhân viên ca trực',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Quản Lý Nhân Sự & KPI',
    targetEntityId: newRecord.id,
    targetEntityName: `Đánh giá KPI: ${input.staffName} (${input.shiftName})`,
    summary: `Đã đánh giá KPI ca ${input.shiftName} cho ${input.staffName}. Kết quả: ${overallGradeLabel} (${score}/100 điểm).`,
    details: `Số tiêu chí đạt: ${totalPassed} | Chưa đạt: ${totalFailed} | Phát Bell Notice: ${isWarning ? 'Cảnh báo cá nhân' : isHonor ? 'Vinh danh toàn viện' : 'Không'}.`,
    severity: isWarning ? 'CRITICAL' : 'NORMAL',
  });

  return newRecord;
}
