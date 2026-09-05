import { HumanActorRole } from '../types/actor';

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'STATUS_CHANGE'
  | 'PRICING_CONFIG_EDIT'
  | 'DISCOUNT_APPLIED'
  | 'DISCOUNT_REMOVED'
  | 'PAYMENT_RECORDED'
  | 'INVOICE_SETTLED'
  | 'MEDICATION_ADMINISTERED'
  | 'MEDICATION_POSTPONED'
  | 'PRESCRIPTION_ADDED'
  | 'INVENTORY_TRANSACTION'
  | 'ADMISSION_FINALIZED'
  | 'HEALTH_REPORT_GENERATED'
  | 'SHIFT_SWAP_REQUESTED'
  | 'SHIFT_SWAP_APPROVED'
  | 'SHIFT_SWAP_REJECTED'
  | 'LEAVE_APPROVED'
  | 'DIRECT_CARE_LOGGED';

export type AuditModuleKey =
  | 'BILLING_PRICING'
  | 'MEDICATION_EMAR'
  | 'INVENTORY'
  | 'CARE_OPERATIONS'
  | 'ADMISSIONS'
  | 'HEALTH_REPORTS'
  | 'WORKFORCE_SHIFTS'
  | 'RESIDENT_LEAVE'
  | 'ACCOMMODATION'
  | 'SYSTEM_ADMIN';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601
  actorId: string;
  actorName: string;
  actorRole: HumanActorRole;
  actorRoleLabel: string;
  actionType: AuditActionType;
  actionLabel: string;
  module: AuditModuleKey;
  moduleLabel: string;
  targetEntityId: string;
  targetEntityName: string;
  residentId?: string;
  residentName?: string;
  summary: string;
  details?: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
  deviceInfo?: string;
  severity: 'NORMAL' | 'IMPORTANT' | 'CRITICAL';
}

export const AUDIT_MODULE_LABELS: Record<AuditModuleKey, { label: string; icon: string }> = {
  BILLING_PRICING: { label: 'Quản lý Phí & Bảng Giá', icon: '💳' },
  MEDICATION_EMAR: { label: 'Y Lệnh Thuốc & eMAR', icon: '💊' },
  INVENTORY: { label: 'Kho Dược & Vật Tư', icon: '📦' },
  CARE_OPERATIONS: { label: 'Vận Hành Chăm Sóc', icon: '🩺' },
  ADMISSIONS: { label: 'Tiếp Nhận & Đánh Giá', icon: '📋' },
  HEALTH_REPORTS: { label: 'Báo Cáo Sức Khỏe', icon: '📑' },
  WORKFORCE_SHIFTS: { label: 'Lịch Trực & Đổi Ca', icon: '👥' },
  RESIDENT_LEAVE: { label: 'Nghỉ Phép & Tạm Vắng (RLA)', icon: '🚪' },
  ACCOMMODATION: { label: 'Sơ Đồ Phòng & Giường', icon: '🛏️' },
  SYSTEM_ADMIN: { label: 'Hệ Thống & Phân Quyền', icon: '⚙️' },
};

export const AUDIT_ACTION_LABELS: Record<AuditActionType, { label: string; badgeClass: string; icon: string }> = {
  CREATE: { label: 'Tạo mới', badgeClass: 'badge-info', icon: '➕' },
  UPDATE: { label: 'Cập nhật', badgeClass: 'badge-warning', icon: '✏️' },
  DELETE: { label: 'Xóa dữ liệu', badgeClass: 'badge-danger', icon: '🗑️' },
  APPROVE: { label: 'Phê duyệt', badgeClass: 'badge-success', icon: '✅' },
  REJECT: { label: 'Từ chối', badgeClass: 'badge-danger', icon: '❌' },
  STATUS_CHANGE: { label: 'Đổi trạng thái', badgeClass: 'badge-warning', icon: '🔄' },
  PRICING_CONFIG_EDIT: { label: 'Sửa biểu giá', badgeClass: 'badge-danger', icon: '💰' },
  DISCOUNT_APPLIED: { label: 'Duyệt giảm giá', badgeClass: 'badge-success', icon: '🎁' },
  DISCOUNT_REMOVED: { label: 'Hủy giảm giá', badgeClass: 'badge-warning', icon: '↩️' },
  PAYMENT_RECORDED: { label: 'Thu tiền', badgeClass: 'badge-success', icon: '💵' },
  INVOICE_SETTLED: { label: 'Khóa sổ', badgeClass: 'badge-neutral', icon: '🔒' },
  MEDICATION_ADMINISTERED: { label: 'Ký uống thuốc', badgeClass: 'badge-success', icon: '💊' },
  MEDICATION_POSTPONED: { label: 'Tạm hoãn thuốc', badgeClass: 'badge-danger', icon: '⚠️' },
  PRESCRIPTION_ADDED: { label: 'Kê đơn y lệnh', badgeClass: 'badge-info', icon: '📝' },
  INVENTORY_TRANSACTION: { label: 'Nhập/Xuất kho', badgeClass: 'badge-info', icon: '📥' },
  ADMISSION_FINALIZED: { label: 'Hoàn thiện hồ sơ tiếp nhận', badgeClass: 'badge-success', icon: '📑' },
  HEALTH_REPORT_GENERATED: { label: 'Xuất báo cáo SK', badgeClass: 'badge-info', icon: '📊' },
  SHIFT_SWAP_REQUESTED: { label: 'Đề nghị đổi ca', badgeClass: 'badge-warning', icon: '🔄' },
  SHIFT_SWAP_APPROVED: { label: 'Duyệt đổi ca', badgeClass: 'badge-success', icon: '✅' },
  SHIFT_SWAP_REJECTED: { label: 'Từ chối đổi ca', badgeClass: 'badge-danger', icon: '❌' },
  LEAVE_APPROVED: { label: 'Duyệt nghỉ phép', badgeClass: 'badge-success', icon: '🚪' },
  DIRECT_CARE_LOGGED: { label: 'Ghi nhật ký chăm sóc', badgeClass: 'badge-info', icon: '✍️' },
};

// In-memory mock audit trail log
let mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'AUD-20260902-001',
    timestamp: '2026-09-02T07:28:40+07:00',
    actorId: 'STAFF-DIR-001',
    actorName: 'Hoàng Quốc Anh',
    actorRole: 'SUPERVISOR',
    actorRoleLabel: 'Ban Giám đốc',
    actionType: 'PRICING_CONFIG_EDIT',
    actionLabel: 'Cập nhật cấu hình Bảng giá dịch vụ',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: 'PRICING-20260701',
    targetEntityName: 'Biểu phí chuẩn Tâm An Care (Áp dụng 01/07/2026)',
    summary: 'Cập nhật bảng giá dịch vụ chuẩn 5 gói chăm sóc cơ bản và 12 dịch vụ chăm sóc hỗ trợ.',
    details: 'Điều chỉnh định mức Phí chăm sóc phục hồi chức năng chuyên sâu AI: 350.000đ/buổi gói tháng và 500.000đ/buổi lẻ.',
    previousValue: 'VLTL cơ bản 300.000 đ/buổi',
    newValue: 'VLTL - PHCN chuyên sâu AI: 350.000 đ (tháng) / 500.000 đ (lẻ)',
    ipAddress: '192.168.1.10',
    deviceInfo: 'MacBook Pro / Chrome 128.0 (Bàn làm việc BGĐ)',
    severity: 'IMPORTANT',
  },
  {
    id: 'AUD-20260902-002',
    timestamp: '2026-09-02T07:25:15+07:00',
    actorId: 'STAFF-MGR-002',
    actorName: 'Trần Thị Thu Thảo',
    actorRole: 'CARE_MANAGER',
    actorRoleLabel: 'Quản lý',
    actionType: 'DISCOUNT_APPLIED',
    actionLabel: 'Phê duyệt mức giảm giá đặc biệt',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: 'INV-202609-002',
    targetEntityName: 'Bảng kê thu phí Cụ Trần Thị Bình (BKVP-2026-09-002)',
    residentId: 'RES-002',
    residentName: 'Cụ Trần Thị Bình',
    summary: 'Áp dụng giảm 10% phí chăm sóc cơ bản (2.000.000đ) cho Cụ Trần Thị Bình.',
    details: 'Căn cứ: Cụ là Thương binh 3/4 có Huân chương kháng chiến theo chính sách tri ân người có công.',
    previousValue: 'Giảm giá: 0 đ',
    newValue: 'Giảm giá: 2.000.000 đ (-10%)',
    ipAddress: '192.168.1.15',
    deviceInfo: 'iPad Air / Safari (Phòng Quản lý vận hành)',
    severity: 'IMPORTANT',
  },
  {
    id: 'AUD-20260902-003',
    timestamp: '2026-09-02T07:18:22+07:00',
    actorId: 'STAFF-NUR-005',
    actorName: 'Lê Thị Mai',
    actorRole: 'NURSE',
    actorRoleLabel: 'Nhân viên y tế',
    actionType: 'MEDICATION_ADMINISTERED',
    actionLabel: 'Ký xác nhận cho uống thuốc eMAR',
    module: 'MEDICATION_EMAR',
    moduleLabel: 'Y Lệnh Thuốc & eMAR',
    targetEntityId: 'EMAR-20260902-01',
    targetEntityName: 'Y lệnh Amlodipine 5mg - Cữ Sáng (08:00)',
    residentId: 'RES-001',
    residentName: 'Cụ Nguyễn Văn An',
    summary: 'Xác nhận cấp phát thuốc đúng 5 Đúng cho Cụ Nguyễn Văn An cữ sáng.',
    details: 'Đo huyết áp trước uống: 135/85 mmHg, không có phản ứng bất thường.',
    previousValue: 'Trạng thái: PENDING (Chờ cấp phát)',
    newValue: 'Trạng thái: GIVEN (Đã uống đúng cữ)',
    ipAddress: '192.168.1.42',
    deviceInfo: 'Tablet Y tế Xe Tiêm / Android 14',
    severity: 'NORMAL',
  },
  {
    id: 'AUD-20260902-004',
    timestamp: '2026-09-02T07:10:05+07:00',
    actorId: 'STAFF-MGR-002',
    actorName: 'Trần Thị Thu Thảo',
    actorRole: 'CARE_MANAGER',
    actorRoleLabel: 'Quản lý',
    actionType: 'SHIFT_SWAP_APPROVED',
    actionLabel: 'Phê duyệt đề nghị đổi ca trực',
    module: 'WORKFORCE_SHIFTS',
    moduleLabel: 'Lịch Trực & Đổi Ca',
    targetEntityId: 'SWAP-20260902-01',
    targetEntityName: 'Đề nghị đổi ca trực Ngày 02/09 giữa ĐD. Lê Thị Mai & ĐD. Nguyễn Thu Hằng',
    summary: 'Phê duyệt đổi Ca Chiều (14h-22h) ngày 02/09 giữa ĐD. Lê Thị Mai và ĐD. Nguyễn Thu Hằng.',
    details: 'Lý do: ĐD. Lê Thị Mai có việc gia đình đột xuất, ĐD. Nguyễn Thu Hằng tự nguyện trực thay, KPI thời gian được cập nhật tự động.',
    previousValue: 'Người trực: ĐD. Lê Thị Mai (Chờ duyệt)',
    newValue: 'Người trực chính thức: ĐD. Nguyễn Thu Hằng (Đã duyệt)',
    ipAddress: '192.168.1.15',
    deviceInfo: 'iPad Air / Safari',
    severity: 'IMPORTANT',
  },
  {
    id: 'AUD-20260902-005',
    timestamp: '2026-09-02T06:55:30+07:00',
    actorId: 'STAFF-SW-003',
    actorName: 'Vũ Thị Ngọc',
    actorRole: 'SOCIAL_WORKER',
    actorRoleLabel: 'Nhân viên công tác xã hội',
    actionType: 'ADMISSION_FINALIZED',
    actionLabel: 'Chuyển phiếu đánh giá sang Hoàn thiện',
    module: 'ADMISSIONS',
    moduleLabel: 'Tiếp Nhận & Đánh Giá',
    targetEntityId: 'ADM-20260901-001',
    targetEntityName: 'Phiếu Đánh Giá Sức Khỏe Ban Đầu - Cụ Bùi Văn Thành',
    residentId: 'RES-005',
    residentName: 'Cụ Bùi Văn Thành',
    summary: 'Chuyển trạng thái phiếu đánh giá tiếp nhận từ "Bản nháp" sang "Hoàn thiện".',
    details: 'Đã hoàn tất điền thực tế toàn bộ chỉ số sinh hiệu (HA, Mạch, SpO2), mức độ tự chủ ADL (75 điểm - Cấp 2) và tiền sử dị ứng Penicillin.',
    previousValue: 'Trạng thái: DRAFT (Bản nháp)',
    newValue: 'Trạng thái: COMPLETED (Hoàn thiện hồ sơ tiếp nhận)',
    ipAddress: '192.168.1.28',
    deviceInfo: 'Máy trạm Lễ tân & Tiếp nhận / Windows 11',
    severity: 'IMPORTANT',
  },
  {
    id: 'AUD-20260902-006',
    timestamp: '2026-09-02T06:40:12+07:00',
    actorId: 'STAFF-ACC-004',
    actorName: 'Vũ Hoàng Nam',
    actorRole: 'ACCOUNTANT',
    actorRoleLabel: 'Kế toán',
    actionType: 'PAYMENT_RECORDED',
    actionLabel: 'Lập phiếu thu tiền viện phí',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: 'REC-202609-001',
    targetEntityName: 'Phiếu thu PT-202609-001 (36.200.000 đ)',
    residentId: 'RES-001',
    residentName: 'Cụ Nguyễn Văn An',
    summary: 'Thu 36.200.000đ tiền thu phí tháng 09/2026 của Cụ Nguyễn Văn An.',
    details: 'Hình thức: Chuyển khoản Vietcombank (MB-FT260901889922) - Người nộp: Nguyễn Văn Minh (Con trai).',
    previousValue: 'Đã thu: 0 đ | Còn nợ: 36.200.000 đ',
    newValue: 'Đã thu: 36.200.000 đ | Còn nợ: 0 đ (PAID)',
    ipAddress: '192.168.1.33',
    deviceInfo: 'Máy trạm Kế toán / Windows 11',
    severity: 'NORMAL',
  },
  {
    id: 'AUD-20260902-007',
    timestamp: '2026-09-02T06:20:10+07:00',
    actorId: 'STAFF-NUR-006',
    actorName: 'Đặng Thúy Nga',
    actorRole: 'NURSE',
    actorRoleLabel: 'Nhân viên y tế',
    actionType: 'MEDICATION_POSTPONED',
    actionLabel: 'Ghi nhận tạm hoãn dùng thuốc',
    module: 'MEDICATION_EMAR',
    moduleLabel: 'Y Lệnh Thuốc & eMAR',
    targetEntityId: 'EMAR-20260902-04',
    targetEntityName: 'Y lệnh Metformin 850mg - Cụ Lê Thị Cúc',
    residentId: 'RES-003',
    residentName: 'Cụ Lê Thị Cúc',
    summary: 'Ghi nhận tạm hoãn cữ thuốc sáng do Cụ đang chuẩn bị lấy máu xét nghiệm đường huyết lúc đói.',
    details: 'Đã xin ý kiến bác sĩ phụ trách, cữ thuốc được chuyển uống ngay sau khi cụ ăn sáng xong.',
    previousValue: 'Trạng thái: PENDING (Chờ cấp phát)',
    newValue: 'Trạng thái: POSTPONED (Tạm hoãn có lý do lâm sàng)',
    ipAddress: '192.168.1.43',
    deviceInfo: 'Tablet Y tế / Android 14',
    severity: 'IMPORTANT',
  },
  {
    id: 'AUD-20260902-008',
    timestamp: '2026-09-02T06:05:00+07:00',
    actorId: 'STAFF-CG-008',
    actorName: 'Nguyễn Văn Hùng',
    actorRole: 'CAREGIVER',
    actorRoleLabel: 'Nhân viên chăm sóc',
    actionType: 'DIRECT_CARE_LOGGED',
    actionLabel: 'Ghi nhận hoạt động chăm sóc trực tiếp',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Vận Hành Chăm Sóc',
    targetEntityId: 'CARE-LOG-20260902-01',
    targetEntityName: 'Chăm sóc vệ sinh & xoay trở chống loét P.102',
    residentId: 'RES-002',
    residentName: 'Cụ Trần Thị Bình',
    summary: 'Xoay trở tư thế nghiêng trái 30 độ và kiểm tra vùng da cùng cụt.',
    details: 'Vùng da tì đè khô ráo, thoa kem dưỡng chống loét theo chỉ định điều dưỡng.',
    previousValue: 'Tư thế cũ: Nằm ngửa',
    newValue: 'Tư thế mới: Nghiêng trái 30 độ kèm gối chèn',
    ipAddress: '192.168.1.55',
    deviceInfo: 'Smartphone Caregiver App / iOS 18',
    severity: 'NORMAL',
  },
  {
    id: 'AUD-20260901-009',
    timestamp: '2026-09-01T16:45:00+07:00',
    actorId: 'STAFF-DIR-001',
    actorName: 'Hoàng Quốc Anh',
    actorRole: 'SUPERVISOR',
    actorRoleLabel: 'Ban Giám đốc',
    actionType: 'APPROVE',
    actionLabel: 'Ký duyệt thủ tục xuất viện & thanh lý hợp đồng',
    module: 'ADMISSIONS',
    moduleLabel: 'Tiếp Nhận & Đánh Giá',
    targetEntityId: 'DISCHARGE-202609-01',
    targetEntityName: 'Hồ sơ kết thúc hợp đồng nghỉ dưỡng — Cụ Phạm Văn Tuấn',
    residentId: 'RES-004',
    residentName: 'Cụ Phạm Văn Tuấn',
    summary: 'Phê duyệt xuất viện cho Cụ Phạm Văn Tuấn về chăm sóc tại gia đình theo nguyện vọng thân nhân.',
    details: 'Đã hoàn tất kiểm tra quyết toán tài chính, bàn giao đầy đủ hồ sơ bệnh án và thuốc duy trì 14 ngày.',
    previousValue: 'Trạng thái: PENDING_DIRECTOR_APPROVAL (Chờ Ban Giám đốc phê duyệt)',
    newValue: 'Trạng thái: DISCHARGED (Đã xuất viện chính thức)',
    ipAddress: '192.168.1.10',
    deviceInfo: 'MacBook Pro / macOS Sonoma (Phòng Giám đốc)',
    severity: 'CRITICAL',
  },
  {
    id: 'AUD-20260901-010',
    timestamp: '2026-09-01T14:15:30+07:00',
    actorId: 'STAFF-DIR-001',
    actorName: 'Hoàng Quốc Anh',
    actorRole: 'SUPERVISOR',
    actorRoleLabel: 'Ban Giám đốc',
    actionType: 'UPDATE',
    actionLabel: 'Cấu hình hạn mức phê duyệt giảm giá cho Quản lý',
    module: 'SYSTEM_ADMIN',
    moduleLabel: 'Hệ Thống & Phân Quyền',
    targetEntityId: 'POLICY-DISCOUNT-V2',
    targetEntityName: 'Chính sách phân quyền hạn mức giảm giá viện phí',
    summary: 'Quy định hạn mức giảm giá tối đa 15% cho Quản lý và yêu cầu Ban Giám đốc phê duyệt từ 15% trở lên.',
    details: 'Cập nhật chính sách phân cấp tài chính Q3/2026 phục vụ quản trị minh bạch.',
    previousValue: 'Quản lý duyệt tối đa: 10%',
    newValue: 'Quản lý duyệt tối đa: 15% (Trên 15% thuộc thẩm quyền Ban Giám đốc)',
    ipAddress: '192.168.1.10',
    deviceInfo: 'MacBook Pro / Chrome 128.0',
    severity: 'IMPORTANT',
  },
];

export interface AuditFilterParams {
  searchTerm?: string;
  module?: AuditModuleKey | 'ALL';
  actorRole?: HumanActorRole | 'ALL';
  actionType?: AuditActionType | 'ALL';
  severity?: 'ALL' | 'NORMAL' | 'IMPORTANT' | 'CRITICAL';
  startDate?: string;
  endDate?: string;
  viewingActorRole?: HumanActorRole;
}

export async function fetchAuditLogs(filters?: AuditFilterParams): Promise<AuditLogEntry[]> {
  await new Promise((r) => setTimeout(r, 120));

  let results = [...mockAuditLogs];

  if (!filters) return results;

  // PHÂN QUYỀN BẢO MẬT CẤP BẬC (RBAC HIERARCHY):
  // 1. Ban Giám đốc (SUPERVISOR): Toàn quyền xem 100% hoạt động của Ban Giám đốc, Quản lý và toàn thể nhân sự.
  // 2. Quản lý (CARE_MANAGER): Xem được hoạt động của nhân viên các bộ phận và Quản lý. KHÔNG xem được hoạt động của Ban Giám đốc.
  if (filters.viewingActorRole === 'CARE_MANAGER') {
    results = results.filter((l) => l.actorRole !== 'SUPERVISOR');
  }

  if (filters.module && filters.module !== 'ALL') {
    results = results.filter((l) => l.module === filters.module);
  }

  if (filters.actorRole && filters.actorRole !== 'ALL') {
    // Nếu Quản lý cố tình lọc theo SUPERVISOR, chặn và trả về rỗng
    if (filters.viewingActorRole === 'CARE_MANAGER' && filters.actorRole === 'SUPERVISOR') {
      return [];
    }
    results = results.filter((l) => l.actorRole === filters.actorRole);
  }

  if (filters.actionType && filters.actionType !== 'ALL') {
    results = results.filter((l) => l.actionType === filters.actionType);
  }

  if (filters.severity && filters.severity !== 'ALL') {
    results = results.filter((l) => l.severity === filters.severity);
  }

  if (filters.searchTerm && filters.searchTerm.trim()) {
    const q = filters.searchTerm.toLowerCase();
    results = results.filter(
      (l) =>
        l.actorName.toLowerCase().includes(q) ||
        l.actorId.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        (l.residentName && l.residentName.toLowerCase().includes(q)) ||
        l.targetEntityName.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
    );
  }

  return results;
}

export async function recordSystemAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
  const newLog: AuditLogEntry = {
    ...entry,
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  mockAuditLogs = [newLog, ...mockAuditLogs];
  return newLog;
}
