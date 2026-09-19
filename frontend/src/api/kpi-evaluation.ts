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
  | 'COMMUNICATIONS'            // Nhân viên truyền thông
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
  CAREGIVER: 'Nhân viên chăm sóc',
  NURSE: 'Nhân viên y tế',
  NUTRITIONIST: 'Nhân viên dinh dưỡng',
  HOUSEKEEPING: 'Nhân viên tạp vụ',
  REHABILITATION_SPECIALIST: 'Nhân viên phục hồi chức năng',
  COMMUNICATIONS: 'Nhân viên truyền thông',
  OFFICE_ADMIN: 'Nhân viên hành chính',
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
    { id: 'KPI-NT-KIT-01', code: 'NT_KIT01', title: 'Vệ sinh, khử khuẩn dụng cụ nấu & khu vực bếp ăn sạch sẽ khô ráo', category: 'Phụ trách Bếp (Vệ sinh & Bố trí)', description: 'Khử khuẩn khay ăn inox, bàn chế biến, làm sạch sàn bếp sau mỗi ca trực', weight: 15 },
    { id: 'KPI-NT-KIT-02', code: 'NT_KIT02', title: 'Sắp xếp, bố trí đồ dùng & dụng cụ bếp gọn gàng đúng nơi quy định', category: 'Phụ trách Bếp (Vệ sinh & Bố trí)', description: 'Xoong nồi, khay đĩa ngăn nắp; kiểm tra an toàn hệ thống điện, gas & PCCC bếp', weight: 15 },
    { id: 'KPI-NT-MEAL-01', code: 'NT_MEAL01', title: 'Sơ chế & chế biến thực phẩm đúng thực đơn dinh dưỡng y khoa', category: 'Phụ trách Bữa Ăn (Sơ chế & Chế biến)', description: 'Cơm mềm, cháo xay nhuyễn, súp loãng, dinh dưỡng qua sonde chuẩn định lượng', weight: 20 },
    { id: 'KPI-NT-MEAL-02', code: 'NT_MEAL02', title: 'Chia suất ăn đúng giờ & đảm bảo kiểm định nhiệt độ, khẩu vị', category: 'Phụ trách Bữa Ăn (Sơ chế & Chế biến)', description: 'Chia suất 07h-11h-14h-17h đúng cữ; giữ ấm món ăn & thử mẫu cảm quan trước khi chia', weight: 20 },
    { id: 'KPI-NT-FOOD-01', code: 'NT_FOOD01', title: 'Tiếp nhận, kiểm đếm & phân loại thực phẩm đầu vào chuẩn VietGAP/HACCP', category: 'Phụ trách Thực Phẩm (Tiếp nhận & Bảo quản)', description: 'Đo nhiệt độ xe giao hàng, kiểm tra tem nguồn gốc & phân loại rau củ/thịt cá tươi sống', weight: 15 },
    { id: 'KPI-NT-FOOD-02', code: 'NT_FOOD02', title: 'Bảo quản thực phẩm kho mát/đông & Lưu mẫu thức ăn 24h chuẩn y tế', category: 'Phụ trách Thực Phẩm (Tiếp nhận & Bảo quản)', description: 'Lưu trữ đông -18°C/mát 0-4°C; lưu mẫu thức ăn >=150g trong tủ niêm phong 24h có nhãn', weight: 15 },
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
  COMMUNICATIONS: [
    { id: 'KPI-COM-01', code: 'COM01', title: 'Truyền thông nội bộ & phát tin Bell Notice kịp thời', category: 'Chuyên môn', description: 'Phát hành thông tin truyền thông, vinh danh khen thưởng đúng quy định', weight: 35 },
    { id: 'KPI-COM-02', code: 'COM02', title: 'Quản lý hình ảnh & tư liệu thông tin của Trung tâm', category: 'Nghiệp vụ', description: 'Bảo mật thông tin cá nhân của các cụ và lưu trữ tư liệu hoạt động', weight: 35 },
    { id: 'KPI-COM-03', code: 'COM03', title: 'Phối hợp với các phòng ban tổ chức sự kiện & phong trào', category: 'Phối hợp', description: 'Tổ chức các sự kiện đời sống tinh thần cho các cụ và nhân viên', weight: 30 },
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
  {
    id: 'KPI-20260910-002',
    staffId: 'STAFF-NUR-003',
    staffName: 'Trần Thị Bích',
    jobGroup: 'NURSE',
    jobGroupLabel: 'Nhân viên y tế',
    shiftDate: '2026-09-10',
    shiftName: 'Ca Sáng (06:00 - 14:00)',
    evaluatorId: 'STAFF-DIR-001',
    evaluatorName: 'Ban Giám đốc',
    evaluatedAt: '2026-09-10T14:00:00+07:00',
    totalScore: 95,
    overallGrade: 'EXCELLENT',
    overallGradeLabel: 'Xuất Sắc - Khen Thưởng Vinh Danh',
    warningSent: false,
    honorSent: true,
    notes: 'Thực hiện chính xác 100% lệnh phát thuốc eMAR cho 29 phòng, chủ động cấp cứu sốt nhẹ cho cụ Bình.',
    results: [
      { criterionId: 'KPI-NU-01', criterionCode: 'NU01', criterionTitle: 'Thực hiện nghiêm ngặt Quy tắc 5 Đúng trong phát & ký eMAR thuốc', status: 'EXCELLENT' },
      { criterionId: 'KPI-NU-02', criterionCode: 'NU02', criterionTitle: 'Theo dõi chỉ số sinh hiệu định kỳ & xử lý vết thương đúng chuẩn', status: 'EXCELLENT' },
      { criterionId: 'KPI-NU-03', criterionCode: 'NU03', criterionTitle: 'Quản lý kho Dược phẩm chặt chẽ, kiểm kê hạn sử dụng đúng quy định', status: 'PASSED' },
      { criterionId: 'KPI-NU-04', criterionCode: 'NU04', criterionTitle: 'Báo cáo kịp thời chuyển viện & phối hợp bác sĩ tuyến trên', status: 'PASSED' },
    ],
  },
  {
    id: 'KPI-20260908-003',
    staffId: 'nut-lan-001',
    staffName: 'Lê Thiện Lan',
    jobGroup: 'NUTRITIONIST',
    jobGroupLabel: 'Nhân viên dinh dưỡng',
    shiftDate: '2026-09-08',
    shiftName: 'Ca Sáng (06:00 - 14:00)',
    evaluatorId: 'STAFF-MGR-001',
    evaluatorName: 'Nguyễn Thị Thu Hà',
    evaluatedAt: '2026-09-08T13:30:00+07:00',
    totalScore: 94,
    overallGrade: 'EXCELLENT',
    overallGradeLabel: 'Xuất Sắc - Khen Thưởng Vinh Danh',
    warningSent: false,
    honorSent: true,
    notes: 'Vệ sinh bếp ăn sạch sẽ khô ráo, bố trí thiết bị đúng nơi quy định, tiếp nhận thực phẩm tươi VietGAP và lưu mẫu 24h chuẩn niêm phong.',
    results: [
      { criterionId: 'KPI-NT-KIT-01', criterionCode: 'NT_KIT01', criterionTitle: 'Vệ sinh, khử khuẩn dụng cụ nấu & khu vực bếp ăn sạch sẽ khô ráo', status: 'EXCELLENT' },
      { criterionId: 'KPI-NT-KIT-02', criterionCode: 'NT_KIT02', criterionTitle: 'Sắp xếp, bố trí đồ dùng & dụng cụ bếp gọn gàng đúng nơi quy định', status: 'PASSED' },
      { criterionId: 'KPI-NT-MEAL-01', criterionCode: 'NT_MEAL01', criterionTitle: 'Sơ chế & chế biến thực phẩm đúng thực đơn dinh dưỡng y khoa', status: 'PASSED' },
      { criterionId: 'KPI-NT-MEAL-02', criterionCode: 'NT_MEAL02', criterionTitle: 'Chia suất ăn đúng giờ & đảm bảo kiểm định nhiệt độ, khẩu vị', status: 'PASSED' },
      { criterionId: 'KPI-NT-FOOD-01', criterionCode: 'NT_FOOD01', criterionTitle: 'Tiếp nhận, kiểm đếm & phân loại thực phẩm đầu vào chuẩn VietGAP/HACCP', status: 'PASSED' },
      { criterionId: 'KPI-NT-FOOD-02', criterionCode: 'NT_FOOD02', criterionTitle: 'Bảo quản thực phẩm kho mát/đông & Lưu mẫu thức ăn 24h chuẩn y tế', status: 'EXCELLENT' },
    ],
  },
  {
    id: 'KPI-20260905-004',
    staffId: 'hk-minh-001',
    staffName: 'Phạm Hồng Minh',
    jobGroup: 'HOUSEKEEPING',
    jobGroupLabel: 'Nhân viên Tạp vụ & Vệ sinh',
    shiftDate: '2026-09-05',
    shiftName: 'Ca Chiều (14:00 - 22:00)',
    evaluatorId: 'STAFF-MGR-001',
    evaluatorName: 'Trần Nguyễn Anh Quản Lý',
    evaluatedAt: '2026-09-05T21:30:00+07:00',
    totalScore: 60,
    overallGrade: 'NEEDS_IMPROVEMENT',
    overallGradeLabel: 'Cần Nhắc Nhở - Chưa Đạt',
    warningSent: true,
    honorSent: false,
    notes: 'Quên thu gom túi rác y tế màu vàng Tầng 3 đúng cữ 20:00, đã nhắc nhở trực tiếp.',
    results: [
      { criterionId: 'KPI-HK-01', criterionCode: 'HK01', criterionTitle: 'Làm sạch & khử khuẩn phòng ở NCT, hành lang, nhà vệ sinh', status: 'PASSED' },
      { criterionId: 'KPI-HK-02', criterionCode: 'HK02', criterionTitle: 'Thu gom & phân loại rác thải sinh hoạt/y tế đúng quy định', status: 'FAILED' },
      { criterionId: 'KPI-HK-03', criterionCode: 'HK03', criterionTitle: 'Giặt sấy & phân loại ga giường, khăn tắm, quần áo cho các cụ', status: 'PASSED' },
    ],
  },
  {
    id: 'KPI-20260828-005',
    staffId: 'cg-tuan-002',
    staffName: 'Hoàng Văn Tuấn',
    jobGroup: 'CAREGIVER',
    jobGroupLabel: 'Nhân viên Chăm sóc',
    shiftDate: '2026-08-28',
    shiftName: 'Ca Sáng (06:00 - 14:00)',
    evaluatorId: 'STAFF-MGR-001',
    evaluatorName: 'Trần Nguyễn Anh Quản Lý',
    evaluatedAt: '2026-08-28T13:50:00+07:00',
    totalScore: 92,
    overallGrade: 'GOOD',
    overallGradeLabel: 'Đạt Yêu Cầu',
    warningSent: false,
    honorSent: false,
    notes: 'Chăm sóc chu đáo các cụ tầng 2.',
    results: [
      { criterionId: 'KPI-CG-01', criterionCode: 'CG01', criterionTitle: 'Tuân thủ quy trình vệ sinh cá nhân cho NCT', status: 'PASSED' },
      { criterionId: 'KPI-CG-02', criterionCode: 'CG02', criterionTitle: 'Thái độ chăm sóc ân cần, nhẹ nhàng', status: 'EXCELLENT' },
      { criterionId: 'KPI-CG-03', criterionCode: 'CG03', criterionTitle: 'Báo cáo ngay sự cố lâm sàng cho Y tế', status: 'PASSED' },
      { criterionId: 'KPI-CG-04', criterionCode: 'CG04', criterionTitle: 'Ghi nhật ký chăm sóc đầy đủ & bảo quản đồ tiêu hao', status: 'PASSED' },
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
    totalScore: Math.min(100, score),
    overallGrade,
    overallGradeLabel,
    results: input.results,
    warningSent: isWarning,
    honorSent: isHonor,
    notes: input.notes,
  };

  mockStaffKPIEvaluations = [newRecord, ...mockStaffKPIEvaluations];

  // Gửi Bell Notice tự động
  if (isWarning) {
    const failedItems = input.results.filter((r) => r.status === 'FAILED').map((r) => r.criterionTitle).join('; ');
    await sendSystemNotification({
      targetStaffId: input.staffId,
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
      isGlobal: true,
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
    summary: `Đã đánh giá KPI ca ${input.shiftName} cho ${input.staffName}. Kết quả: ${overallGradeLabel} (${newRecord.totalScore}/100 điểm).`,
    details: `Số tiêu chí đạt: ${totalPassed} | Chưa đạt: ${totalFailed} | Phát Bell Notice: ${isWarning ? 'Cảnh báo cá nhân' : isHonor ? 'Vinh danh toàn viện' : 'Không'}.`,
    severity: isWarning ? 'CRITICAL' : 'NORMAL',
  });

  return newRecord;
}

// Interfaces & Logic cho Tổng Hợp KPI Theo Kỳ (Tháng, Quý, Năm)
export interface KPISynthesisItem {
  staffId: string;
  staffName: string;
  jobGroup: JobGroup;
  jobGroupLabel: string;
  periodLabel: string;
  totalEvaluatedShifts: number;
  averageScore: number;
  passedCount: number;
  excellentCount: number;
  failedCount: number;
  criterionPassRatePercent: number;
  finalRank: 'A+' | 'A' | 'B' | 'C';
  finalRankLabel: string;
  evaluationSummary: string;
}

export interface KPISynthesisSummary {
  periodType: 'MONTH' | 'QUARTER' | 'YEAR';
  periodValue: string;
  totalStaffEvaluated: number;
  averageFacilityScore: number;
  excellentStaffCount: number;
  goodStaffCount: number;
  warningStaffCount: number;
  items: KPISynthesisItem[];
}

export function synthesizeStaffKPI(
  periodType: 'MONTH' | 'QUARTER' | 'YEAR',
  periodValue: string, // e.g. "2026-09", "2026-Q3", "2026"
  jobGroupFilter: string = 'ALL'
): KPISynthesisSummary {
  // Lọc các bản ghi theo thời gian
  let filteredRecords = mockStaffKPIEvaluations.filter((rec) => {
    if (periodType === 'MONTH') {
      return rec.shiftDate.startsWith(periodValue); // "2026-09"
    }
    if (periodType === 'QUARTER') {
      const [yearStr, qStr] = periodValue.split('-Q');
      const year = yearStr || '2026';
      const quarter = parseInt(qStr || '3', 10);
      const recYear = rec.shiftDate.slice(0, 4);
      const recMonth = parseInt(rec.shiftDate.slice(5, 7), 10);
      const recQuarter = Math.ceil(recMonth / 3);
      return recYear === year && recQuarter === quarter;
    }
    if (periodType === 'YEAR') {
      return rec.shiftDate.startsWith(periodValue); // "2026"
    }
    return true;
  });

  if (jobGroupFilter !== 'ALL') {
    filteredRecords = filteredRecords.filter((rec) => rec.jobGroup === jobGroupFilter);
  }

  // Nhóm theo nhân viên
  const staffGroups = new Map<string, StaffKPIEvaluationRecord[]>();
  for (const rec of filteredRecords) {
    const list = staffGroups.get(rec.staffId) || [];
    list.push(rec);
    staffGroups.set(rec.staffId, list);
  }

  const items: KPISynthesisItem[] = [];

  staffGroups.forEach((records, staffId) => {
    const staffName = records[0].staffName;
    const jobGroup = records[0].jobGroup;
    const jobGroupLabel = JOB_GROUP_LABELS[jobGroup];

    const totalEvaluatedShifts = records.length;
    const totalScoreSum = records.reduce((sum, r) => sum + r.totalScore, 0);
    const averageScore = Math.round(totalScoreSum / totalEvaluatedShifts);

    let passedCount = 0;
    let excellentCount = 0;
    let failedCount = 0;
    let totalCriteriaEvaluated = 0;

    records.forEach((r) => {
      r.results.forEach((res) => {
        totalCriteriaEvaluated++;
        if (res.status === 'EXCELLENT') {
          excellentCount++;
          passedCount++;
        } else if (res.status === 'PASSED') {
          passedCount++;
        } else if (res.status === 'FAILED') {
          failedCount++;
        }
      });
    });

    const criterionPassRatePercent = totalCriteriaEvaluated > 0
      ? Math.round((passedCount / totalCriteriaEvaluated) * 100)
      : 100;

    let finalRank: 'A+' | 'A' | 'B' | 'C' = 'A';
    let finalRankLabel = 'Đạt Tiêu Chuẩn (Hạng A)';

    if (averageScore >= 95 && failedCount === 0) {
      finalRank = 'A+';
      finalRankLabel = 'Xuất Sắc Vượt Bậc (Hạng A+)';
    } else if (averageScore >= 80 && failedCount <= 1) {
      finalRank = 'A';
      finalRankLabel = 'Hoàn Thành Tốt (Hạng A)';
    } else if (averageScore >= 65 && failedCount <= 2) {
      finalRank = 'B';
      finalRankLabel = 'Cần Cải Thiện (Hạng B)';
    } else {
      finalRank = 'C';
      finalRankLabel = 'Cảnh Báo Thi Đua (Hạng C)';
    }

    let periodLabelStr = periodValue;
    if (periodType === 'MONTH') periodLabelStr = `Tháng ${periodValue.slice(5)}/${periodValue.slice(0, 4)}`;
    if (periodType === 'QUARTER') periodLabelStr = `${periodValue.replace('-', ' - ')}`;
    if (periodType === 'YEAR') periodLabelStr = `Năm ${periodValue}`;

    items.push({
      staffId,
      staffName,
      jobGroup,
      jobGroupLabel,
      periodLabel: periodLabelStr,
      totalEvaluatedShifts,
      averageScore,
      passedCount,
      excellentCount,
      failedCount,
      criterionPassRatePercent,
      finalRank,
      finalRankLabel,
      evaluationSummary: `Hoàn thành ${totalEvaluatedShifts} ca trực. Tỷ lệ đạt tiêu chí ${criterionPassRatePercent}%. Số lỗi phát hiện: ${failedCount}.`,
    });
  });

  const totalStaffEvaluated = items.length;
  const averageFacilityScore = totalStaffEvaluated > 0
    ? Math.round(items.reduce((acc, i) => acc + i.averageScore, 0) / totalStaffEvaluated)
    : 0;

  const excellentStaffCount = items.filter((i) => i.finalRank === 'A+').length;
  const goodStaffCount = items.filter((i) => i.finalRank === 'A').length;
  const warningStaffCount = items.filter((i) => i.finalRank === 'B' || i.finalRank === 'C').length;

  return {
    periodType,
    periodValue,
    totalStaffEvaluated,
    averageFacilityScore,
    excellentStaffCount,
    goodStaffCount,
    warningStaffCount,
    items,
  };
}

// Hàm phát Bell Notice vinh danh nhân viên hoàn thành xuất sắc KPI kỳ (Tháng, Quý, Năm) cho toàn thể viện Tâm An
export async function publishPeriodKPIHonorNotices(
  actor: HumanActorSession,
  summary: KPISynthesisSummary
): Promise<number> {
  const excellentItems = summary.items.filter((i) => i.finalRank === 'A+');
  if (excellentItems.length === 0) return 0;

  for (const item of excellentItems) {
    await sendSystemNotification({
      title: `🌟 VINH DANH XUẤT SẮC KPI THI ĐUA ${item.periodLabel.toUpperCase()}`,
      message: `Tâm An Care trân trọng vinh danh Nhân viên ${item.staffName} (${item.jobGroupLabel}) đã đạt danh hiệu XUẤT SẮC VƯỢT BẬC (Hạng A+) trong ${item.periodLabel} với điểm số trung bình ${item.averageScore}/100!`,
      type: 'HONOR_NOTICE',
      severity: 'INFO',
      isGlobal: true, // Gửi Bell notice thông báo tới toàn thể nhân viên Tâm An
    });

    await recordSystemAuditLog({
      actorId: actor.actorId || 'STAFF-DIR-001',
      actorName: actor.displayName || 'Ban Giám đốc',
      actorRole: actor.actorRole || 'SUPERVISOR',
      actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Ban Giám đốc',
      actionType: 'CREATE',
      actionLabel: 'Phát Bell Notice vinh danh KPI thi đua kỳ',
      module: 'CARE_OPERATIONS',
      moduleLabel: 'Quản Lý Nhân Sự & KPI',
      targetEntityId: item.staffId,
      targetEntityName: `Vinh danh KPI kỳ: ${item.staffName}`,
      summary: `Đã phát Bell Notice thông báo toàn viện vinh danh cá nhân ${item.staffName} đạt Hạng A+ trong ${item.periodLabel}.`,
      severity: 'IMPORTANT',
    });
  }

  return excellentItems.length;
}


