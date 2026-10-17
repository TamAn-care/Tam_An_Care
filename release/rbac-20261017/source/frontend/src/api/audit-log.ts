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

// NO SEED DATA — Production-ready empty state
// NO SEED DATA — Production-ready empty state
let mockAuditLogs: AuditLogEntry[] = [];

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
