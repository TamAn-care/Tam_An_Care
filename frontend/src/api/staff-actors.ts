import type {
  HumanActorSession,
  HumanActorRole,
} from '../types/actor';

import { recordSystemAuditLog } from './audit-log';
import { getStoredAdminPassword, setStoredAdminPassword } from './auth';

export type StaffActorStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface StaffActor {
  actorId: string;
  staffCode: string;
  displayName: string;
  primaryOperationalRole: HumanActorRole;
  department: string;
  email: string;
  phone: string;
  status: StaffActorStatus;
  employmentReference: string | null;
  initialPassword?: string;
  lastPasswordResetAt?: string;
  createdByActorId?: string;
  createdByActorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffActorListOptions {
  limit?: number;
  role?: HumanActorRole;
  status?: StaffActorStatus;
  searchTerm?: string;
}

export interface CreateStaffAccountInput {
  actorId?: string;
  staffCode?: string;
  displayName: string;
  primaryOperationalRole: HumanActorRole;
  department: string;
  email: string;
  phone: string;
  initialPassword?: string;
  requirePasswordChangeOnFirstLogin?: boolean;
}

export interface ResetStaffPasswordInput {
  actorId: string;
  newPassword?: string;
}

export interface UpdateStaffStatusInput {
  actorId: string;
  status: StaffActorStatus;
  reason?: string;
}

// In-Memory Mock Staff Dataset
export let mockStaffActors: StaffActor[] = [
  {
    actorId: 'Admin',
    staffCode: 'ADMIN-001',
    displayName: 'Quản Trị Viên Tối Cao (Admin)',
    primaryOperationalRole: 'ADMIN',
    department: 'Ban Quản Trị Hệ Thống Tối Cao',
    email: 'admin@tamancare.vn',
    phone: '0900 000 001',
    status: 'ACTIVE',
    employmentReference: 'SUPER-ADMIN-ROOT',
    initialPassword: 'Admin',
    lastPasswordResetAt: '2026-09-02T08:00:00+07:00',
    createdByActorId: 'SYSTEM-ROOT',
    createdByActorName: 'Quản Trị Hệ Thống',
    createdAt: '2026-08-01T00:00:00+07:00',
    updatedAt: '2026-09-02T08:00:00+07:00',
  },
  {
    actorId: 'TA-DIR-01',
    staffCode: 'TA-DIR-01',
    displayName: 'Hoàng Quốc Anh',
    primaryOperationalRole: 'SUPERVISOR',
    department: 'Ban Giám Đốc',
    email: 'quocanh.hoang@tamancare.vn',
    phone: '0912 345 678',
    status: 'ACTIVE',
    employmentReference: 'QĐ-01/2026/BGD-TA',
    initialPassword: 'TamAn@Director#2026',
    lastPasswordResetAt: '2026-08-01T08:00:00+07:00',
    createdByActorId: 'Admin',
    createdByActorName: 'Quản Trị Viên Tối Cao (Admin)',
    createdAt: '2026-08-01T08:00:00+07:00',
    updatedAt: '2026-09-01T14:15:30+07:00',
  },
  {
    actorId: 'TA-MGR-01',
    staffCode: 'TA-MGR-01',
    displayName: 'Nguyễn Thị Thu Hà',
    primaryOperationalRole: 'CARE_MANAGER',
    department: 'Khối Quản Lý Vận Hành',
    email: 'thuha.nguyen@tamancare.vn',
    phone: '0988 765 432',
    status: 'ACTIVE',
    employmentReference: 'QĐ-02/2026/BGD-TA',
    initialPassword: 'TamAn@Manager#2026',
    lastPasswordResetAt: '2026-08-05T09:30:00+07:00',
    createdByActorId: 'TA-DIR-01',
    createdByActorName: 'Hoàng Quốc Anh (Ban Giám đốc)',
    createdAt: '2026-08-05T09:30:00+07:00',
    updatedAt: '2026-09-01T16:00:00+07:00',
  },
  {
    actorId: 'TA-NUR-01',
    staffCode: 'TA-NUR-01',
    displayName: 'Trần Thị Mai',
    primaryOperationalRole: 'NURSE',
    department: 'Khối Y Tế & Điều Dưỡng',
    email: 'mai.tran@tamancare.vn',
    phone: '0977 123 456',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-12/2026/TA',
    initialPassword: 'TamAn@Nurse#2026',
    lastPasswordResetAt: '2026-08-10T10:00:00+07:00',
    createdByActorId: 'TA-MGR-01',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-10T10:00:00+07:00',
    updatedAt: '2026-08-10T10:00:00+07:00',
  },
  {
    actorId: 'TA-CG-01',
    staffCode: 'TA-CG-01',
    displayName: 'Lê Văn Nam',
    primaryOperationalRole: 'CAREGIVER',
    department: 'Khối Chăm Sóc Trực Tiếp',
    email: 'nam.le@tamancare.vn',
    phone: '0934 567 890',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-18/2026/TA',
    initialPassword: 'TamAn@Care#2026',
    lastPasswordResetAt: '2026-08-12T14:20:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-12T14:20:00+07:00',
    updatedAt: '2026-08-12T14:20:00+07:00',
  },
  {
    actorId: 'STAFF-CG-005',
    staffCode: 'NV-CG-005',
    displayName: 'Phạm Thị Lan',
    primaryOperationalRole: 'CAREGIVER',
    department: 'Khối Chăm Sóc Trực Tiếp',
    email: 'lan.pham@tamancare.vn',
    phone: '0903 221 144',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-22/2026/TA',
    initialPassword: 'TamAn@Care#2026',
    lastPasswordResetAt: '2026-08-15T11:00:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-15T11:00:00+07:00',
    updatedAt: '2026-08-15T11:00:00+07:00',
  },
  {
    actorId: 'STAFF-NUT-007',
    staffCode: 'NV-NUT-007',
    displayName: 'Hoàng Minh Châu',
    primaryOperationalRole: 'NUTRITIONIST',
    department: 'Bộ Phận Dinh Dưỡng & Bếp Ăn',
    email: 'chau.hoang@tamancare.vn',
    phone: '0918 998 877',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-08/2026/TA',
    initialPassword: 'TamAn@Nutri#2026',
    lastPasswordResetAt: '2026-08-08T08:30:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-08T08:30:00+07:00',
    updatedAt: '2026-08-08T08:30:00+07:00',
  },
  {
    actorId: 'STAFF-ACC-008',
    staffCode: 'NV-ACC-008',
    displayName: 'Vũ Bích Ngọc',
    primaryOperationalRole: 'ACCOUNTANT',
    department: 'Phòng Kế Toán & Viện Phí',
    email: 'ngoc.vu@tamancare.vn',
    phone: '0966 332 211',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-05/2026/TA',
    initialPassword: 'TamAn@Finance#2026',
    lastPasswordResetAt: '2026-08-02T09:00:00+07:00',
    createdByActorId: 'STAFF-DIR-001',
    createdByActorName: 'Hoàng Quốc Anh (Ban Giám đốc)',
    createdAt: '2026-08-02T09:00:00+07:00',
    updatedAt: '2026-08-02T09:00:00+07:00',
  },
  {
    actorId: 'STAFF-REC-009',
    staffCode: 'NV-REC-009',
    displayName: 'Đặng Thanh Tâm',
    primaryOperationalRole: 'RECEPTIONIST',
    department: 'Bộ Phận Lễ Tân & Tiếp Đón',
    email: 'tam.dang@tamancare.vn',
    phone: '0945 667 788',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-15/2026/TA',
    initialPassword: 'TamAn@Welcome#2026',
    lastPasswordResetAt: '2026-08-20T13:45:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-20T13:45:00+07:00',
    updatedAt: '2026-08-20T13:45:00+07:00',
  },
  {
    actorId: 'STAFF-PSY-010',
    staffCode: 'NV-PSY-010',
    displayName: 'Lý Quốc Cường',
    primaryOperationalRole: 'PSYCHOLOGIST',
    department: 'Tư Vấn & Trị Liệu Tâm Lý',
    email: 'cuong.ly@tamancare.vn',
    phone: '0922 445 566',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-09/2026/TA',
    initialPassword: 'TamAn@Psy#2026',
    lastPasswordResetAt: '2026-08-18T10:15:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-18T10:15:00+07:00',
    updatedAt: '2026-08-18T10:15:00+07:00',
  },
  {
    actorId: 'STAFF-SW-011',
    staffCode: 'NV-SW-011',
    displayName: 'Bùi Thị Loan',
    primaryOperationalRole: 'SOCIAL_WORKER',
    department: 'Công Tác Xã Hội & Đời Sống',
    email: 'loan.bui@tamancare.vn',
    phone: '0978 112 299',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-16/2026/TA',
    initialPassword: 'TamAn@Social#2026',
    lastPasswordResetAt: '2026-08-22T09:00:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-22T09:00:00+07:00',
    updatedAt: '2026-08-22T09:00:00+07:00',
  },
  {
    actorId: 'STAFF-REH-012',
    staffCode: 'NV-REH-012',
    displayName: 'Đỗ Hữu Phước',
    primaryOperationalRole: 'REHABILITATION_SPECIALIST',
    department: 'Vật Lý Trị Liệu & PHCN',
    email: 'phuoc.do@tamancare.vn',
    phone: '0933 887 766',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-19/2026/TA',
    initialPassword: 'TamAn@Rehab#2026',
    lastPasswordResetAt: '2026-08-25T15:30:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-25T15:30:00+07:00',
    updatedAt: '2026-08-25T15:30:00+07:00',
  },
  {
    actorId: 'STAFF-HK-013',
    staffCode: 'NV-HK-013',
    displayName: 'Nguyễn Văn Tiến',
    primaryOperationalRole: 'HOUSEKEEPING',
    department: 'Bộ Phận Buồng Phòng & Tạp Vụ',
    email: 'tien.nguyen@tamancare.vn',
    phone: '0908 554 433',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-25/2026/TA',
    initialPassword: 'TamAn@House#2026',
    lastPasswordResetAt: '2026-08-26T08:00:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-26T08:00:00+07:00',
    updatedAt: '2026-08-26T08:00:00+07:00',
  },
  {
    actorId: 'STAFF-SEC-014',
    staffCode: 'NV-SEC-014',
    displayName: 'Trần Văn Mạnh',
    primaryOperationalRole: 'SECURITY',
    department: 'Đội An Ninh & Trật Tự',
    email: 'manh.tran@tamancare.vn',
    phone: '0919 778 899',
    status: 'ACTIVE',
    employmentReference: 'HĐLĐ-28/2026/TA',
    initialPassword: 'TamAn@Security#2026',
    lastPasswordResetAt: '2026-08-28T07:30:00+07:00',
    createdByActorId: 'STAFF-MGR-002',
    createdByActorName: 'Nguyễn Thị Thu Hà (Quản lý)',
    createdAt: '2026-08-28T07:30:00+07:00',
    updatedAt: '2026-08-28T07:30:00+07:00',
  },
];

export function generateSecurePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%=+';
  const all = upper + lower + digits + special;

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  for (let i = 0; i < 8; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  return `TamAn@${pwd}`;
}

export async function listStaffActors(
  actor: HumanActorSession | null,
  options: StaffActorListOptions = {},
): Promise<StaffActor[]> {
  await new Promise((r) => setTimeout(r, 80));

  // Sync Admin password from storage
  const adminAccount = mockStaffActors.find((s) => s.actorId === 'Admin');
  if (adminAccount) {
    adminAccount.initialPassword = getStoredAdminPassword();
  }

  let results = [...mockStaffActors];

  if (options.role && options.role !== ('ALL' as any)) {
    results = results.filter((s) => s.primaryOperationalRole === options.role);
  }

  if (options.status && options.status !== ('ALL' as any)) {
    results = results.filter((s) => s.status === options.status);
  }

  if (options.searchTerm && options.searchTerm.trim()) {
    const q = options.searchTerm.toLowerCase();
    results = results.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.actorId.toLowerCase().includes(q) ||
        s.staffCode.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q)
    );
  }

  return results;
}

export async function getStaffActor(
  actorId: string,
  actor: HumanActorSession | null,
): Promise<StaffActor> {
  await new Promise((r) => setTimeout(r, 50));
  const found = mockStaffActors.find((s) => s.actorId === actorId || s.staffCode === actorId);
  if (!found) {
    throw new Error(`Không tìm thấy nhân sự với mã ${actorId}`);
  }
  return found;
}

export function getNextSequentialStaffCode(
  role: HumanActorRole,
  existingList?: Array<{ staffCode?: string; actorId?: string }>,
): { staffCode: string; actorId: string; prefix: string; seqNumber: number } {
  const rolePrefixMap: Record<HumanActorRole, string> = {
    ADMIN: 'ADM',
    SUPERVISOR: 'DIR',
    CARE_MANAGER: 'MGR',
    NURSE: 'NUR',
    CAREGIVER: 'CG',
    NUTRITIONIST: 'NUT',
    ACCOUNTANT: 'ACC',
    RECEPTIONIST: 'REC',
    PSYCHOLOGIST: 'PSY',
    SOCIAL_WORKER: 'SW',
    REHABILITATION_SPECIALIST: 'REH',
    HOUSEKEEPING: 'HK',
    SECURITY: 'SEC',
    GUARDIAN: 'GUA',
  };

  const prefix = rolePrefixMap[role] || 'STF';

  // Gather all accounts to calculate highest sequence number
  const allAccounts = existingList ?? mockStaffActors;

  // Also check localStorage created staff if available
  let localCreated: Array<{ staffCode?: string; actorId?: string }> = [];
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('tamancare_created_staff');
      if (stored) localCreated = JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  const mergedList = [...allAccounts, ...localCreated];
  let maxSeq = 0;
  const pattern = new RegExp(`(?:TA-|NV-|STAFF-)?${prefix}[-_]?(\\d+)`, 'i');

  for (const item of mergedList) {
    if (!item) continue;
    const codes = [item.staffCode, item.actorId].filter(Boolean);
    for (const codeStr of codes) {
      const match = (codeStr as string).match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const seqPadded = String(nextSeq).padStart(2, '0');

  return {
    staffCode: `TA-${prefix}-${seqPadded}`,
    actorId: `TA-${prefix}-${seqPadded}`,
    prefix,
    seqNumber: nextSeq,
  };
}

export async function createStaffAccount(
  actor: HumanActorSession | null,
  input: CreateStaffAccountInput,
): Promise<StaffActor> {
  await new Promise((r) => setTimeout(r, 120));

  if (!actor) {
    throw new Error('Chưa xác định phiên làm việc. Vui lòng đăng nhập.');
  }

  // PHÂN QUYỀN CẤP BẬC (RBAC HIERARCHY):
  if (input.primaryOperationalRole === 'ADMIN' && actor.actorRole !== 'ADMIN') {
    throw new Error('Quyền hạn bị từ chối: Chỉ Quản trị viên Tối cao (Admin) mới có quyền tạo tài khoản Admin.');
  }

  if (actor.actorRole === 'CARE_MANAGER' && (input.primaryOperationalRole === 'SUPERVISOR' || input.primaryOperationalRole === 'ADMIN')) {
    throw new Error('Quyền hạn bị từ chối: Quản lý không có thẩm quyền tạo tài khoản thuộc Ban Giám đốc hoặc Admin.');
  }

  if (actor.actorRole !== 'ADMIN' && actor.actorRole !== 'SUPERVISOR' && actor.actorRole !== 'CARE_MANAGER') {
    throw new Error('Quyền hạn bị từ chối: Bạn không có quyền cấp tài khoản.');
  }

  const seqInfo = getNextSequentialStaffCode(input.primaryOperationalRole, mockStaffActors);
  const actorId = input.actorId?.trim() || seqInfo.actorId;
  const staffCode = input.staffCode?.trim() || seqInfo.staffCode;
  const initialPassword = input.initialPassword?.trim() || generateSecurePassword();

  const newStaff: StaffActor = {
    actorId,
    staffCode,
    displayName: input.displayName.trim(),
    primaryOperationalRole: input.primaryOperationalRole,
    department: input.department.trim() || 'Vận Hành & Chăm Sóc',
    email: input.email.trim(),
    phone: input.phone.trim(),
    status: 'ACTIVE',
    employmentReference: `HĐLĐ-${seqInfo.seqNumber}/2026/TA`,
    initialPassword,
    lastPasswordResetAt: new Date().toISOString(),
    createdByActorId: actor.actorId || 'STAFF-UNKNOWN',
    createdByActorName: `${actor.displayName || 'Nhân sự'} (${actor.actorRole === 'ADMIN' ? 'Admin' : actor.actorRole === 'SUPERVISOR' ? 'Ban Giám đốc' : 'Quản lý'})`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockStaffActors = [newStaff, ...mockStaffActors];

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('tamancare_created_staff');
      const existingList = stored ? JSON.parse(stored) : [];
      const newActiveMember = {
        actorId: newStaff.actorId,
        staffCode: newStaff.staffCode,
        displayName: newStaff.displayName,
        actorRole: newStaff.primaryOperationalRole,
        status: newStaff.status,
      };
      if (!existingList.some((s: any) => s.actorId === newActiveMember.actorId || s.staffCode === newActiveMember.staffCode)) {
        existingList.push(newActiveMember);
        localStorage.setItem('tamancare_created_staff', JSON.stringify(existingList));
      }
    } catch {
      // Ignore storage errors
    }
  }

  // Ghi nhật ký kiểm toán quy trách nhiệm
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-UNKNOWN',
    actorName: actor.displayName || 'Nhân sự cấp tài khoản',
    actorRole: actor.actorRole || 'ADMIN',
    actorRoleLabel: actor.actorRole === 'ADMIN' ? 'Quản trị viên Tối cao' : actor.actorRole === 'SUPERVISOR' ? 'Ban Giám đốc' : 'Quản lý',
    actionType: 'CREATE',
    actionLabel: 'Cấp tài khoản & mật khẩu nhân sự mới',
    module: 'SYSTEM_ADMIN',
    moduleLabel: 'Nhân Sự & Phân Quyền',
    targetEntityId: newStaff.actorId,
    targetEntityName: `${newStaff.displayName} (${newStaff.staffCode})`,
    summary: `Khởi tạo tài khoản ID ${newStaff.actorId} cho ${newStaff.displayName} với vai trò ${newStaff.primaryOperationalRole}.`,
    details: `Mã NV: ${newStaff.staffCode} | Bộ phận: ${newStaff.department} | Email: ${newStaff.email} | SĐT: ${newStaff.phone} | Cấp bởi: ${newStaff.createdByActorName}.`,
    previousValue: 'Chưa có tài khoản',
    newValue: `Đã cấp tài khoản: ACTIVE (${newStaff.primaryOperationalRole})`,
    severity: (newStaff.primaryOperationalRole === 'ADMIN' || newStaff.primaryOperationalRole === 'SUPERVISOR') ? 'CRITICAL' : 'IMPORTANT',
  });

  return newStaff;
}

export async function resetStaffPassword(
  actor: HumanActorSession | null,
  input: ResetStaffPasswordInput,
): Promise<{ success: boolean; newPassword: string }> {
  await new Promise((r) => setTimeout(r, 100));

  if (!actor) {
    throw new Error('Chưa xác định phiên làm việc.');
  }

  const staff = mockStaffActors.find((s) => s.actorId === input.actorId);
  if (!staff) {
    throw new Error(`Không tìm thấy tài khoản với mã ${input.actorId}`);
  }

  // BẢO MẬT CẤP BẬC:
  if (staff.primaryOperationalRole === 'ADMIN' && actor.actorRole !== 'ADMIN') {
    throw new Error('Quyền hạn bị từ chối: Chỉ Quản trị viên Tối cao (Admin) mới có quyền đổi mật khẩu tài khoản Admin.');
  }

  if (actor.actorRole === 'CARE_MANAGER' && (staff.primaryOperationalRole === 'SUPERVISOR' || staff.primaryOperationalRole === 'ADMIN')) {
    throw new Error('Quyền hạn bị từ chối: Quản lý không có quyền đặt lại mật khẩu của Ban Giám đốc hoặc Admin.');
  }

  const newPassword = input.newPassword?.trim() || generateSecurePassword();
  staff.initialPassword = newPassword;
  staff.lastPasswordResetAt = new Date().toISOString();
  staff.updatedAt = new Date().toISOString();

  // If this is the Admin account, persist to local storage
  if (staff.actorId === 'Admin' || staff.primaryOperationalRole === 'ADMIN') {
    setStoredAdminPassword(newPassword);
  }

  // Ghi nhật ký kiểm toán
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-UNKNOWN',
    actorName: actor.displayName || 'Nhân sự',
    actorRole: actor.actorRole || 'ADMIN',
    actorRoleLabel: actor.actorRole === 'ADMIN' ? 'Quản trị viên Tối cao' : actor.actorRole === 'SUPERVISOR' ? 'Ban Giám đốc' : 'Quản lý',
    actionType: 'UPDATE',
    actionLabel: 'Đặt lại mật khẩu tài khoản nhân sự',
    module: 'SYSTEM_ADMIN',
    moduleLabel: 'Nhân Sự & Phân Quyền',
    targetEntityId: staff.actorId,
    targetEntityName: `${staff.displayName} (${staff.staffCode})`,
    summary: `Đặt lại mật khẩu truy cập cho tài khoản ${staff.displayName} (${staff.actorId}).`,
    details: `Thực hiện bởi: ${actor.displayName} (${actor.actorRole}). Mật khẩu mới đã được cập nhật thành công và sẵn sàng gửi cho nhân sự.`,
    severity: 'IMPORTANT',
  });

  return { success: true, newPassword };
}

export async function updateStaffStatus(
  actor: HumanActorSession | null,
  input: UpdateStaffStatusInput,
): Promise<StaffActor> {
  await new Promise((r) => setTimeout(r, 100));

  if (!actor) {
    throw new Error('Chưa xác định phiên làm việc.');
  }

  const staff = mockStaffActors.find((s) => s.actorId === input.actorId);
  if (!staff) {
    throw new Error(`Không tìm thấy tài khoản với mã ${input.actorId}`);
  }

  // BẢO MẬT CẤP BẬC:
  if (staff.primaryOperationalRole === 'ADMIN' && actor.actorRole !== 'ADMIN') {
    throw new Error('Quyền hạn bị từ chối: Không thể thay đổi trạng thái của tài khoản Quản trị viên Tối cao (Admin).');
  }

  if (actor.actorRole === 'CARE_MANAGER' && (staff.primaryOperationalRole === 'SUPERVISOR' || staff.primaryOperationalRole === 'ADMIN')) {
    throw new Error('Quyền hạn bị từ chối: Quản lý không có quyền thay đổi trạng thái tài khoản Ban Giám đốc hoặc Admin.');
  }

  const prevStatus = staff.status;
  staff.status = input.status;
  staff.updatedAt = new Date().toISOString();

  // Ghi nhật ký kiểm toán
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-UNKNOWN',
    actorName: actor.displayName || 'Nhân sự',
    actorRole: actor.actorRole || 'ADMIN',
    actorRoleLabel: actor.actorRole === 'ADMIN' ? 'Quản trị viên Tối cao' : actor.actorRole === 'SUPERVISOR' ? 'Ban Giám đốc' : 'Quản lý',
    actionType: 'UPDATE',
    actionLabel: 'Cập nhật trạng thái tài khoản nhân sự',
    module: 'SYSTEM_ADMIN',
    moduleLabel: 'Nhân Sự & Phân Quyền',
    targetEntityId: staff.actorId,
    targetEntityName: `${staff.displayName} (${staff.staffCode})`,
    summary: `Thay đổi trạng thái tài khoản ${staff.displayName} từ ${prevStatus} sang ${input.status}.`,
    details: `Lý do: ${input.reason || 'Điều chỉnh nhân sự theo quyết định vận hành'}. Thực hiện bởi: ${actor.displayName}.`,
    previousValue: `Trạng thái cũ: ${prevStatus}`,
    newValue: `Trạng thái mới: ${input.status}`,
    severity: input.status === 'SUSPENDED' ? 'CRITICAL' : 'IMPORTANT',
  });

  return staff;
}

export async function changeSelfPassword(
  actor: HumanActorSession | null,
  currentPasswordInput: string,
  newPasswordInput: string,
): Promise<{ success: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 100));

  if (!actor) {
    throw new Error('Chưa xác định phiên làm việc. Vui lòng đăng nhập.');
  }

  // Find the staff account or admin
  let staff = mockStaffActors.find((s) => s.actorId === actor.actorId);
  if (!staff && actor.actorRole === 'ADMIN') {
    staff = mockStaffActors.find((s) => s.actorId === 'Admin');
  }

  if (staff) {
    // Check current password
    const expectedCurrent = (staff.actorId === 'Admin' || staff.primaryOperationalRole === 'ADMIN')
      ? getStoredAdminPassword()
      : (staff.initialPassword || 'TamAn@2026');

    if (currentPasswordInput.trim() !== expectedCurrent) {
      throw new Error('Mật khẩu hiện tại không chính xác.');
    }

    if (!newPasswordInput.trim() || newPasswordInput.trim().length < 3) {
      throw new Error('Mật khẩu mới phải có tối thiểu 3 ký tự.');
    }

    staff.initialPassword = newPasswordInput.trim();
    staff.lastPasswordResetAt = new Date().toISOString();
    staff.updatedAt = new Date().toISOString();

    if (staff.actorId === 'Admin' || staff.primaryOperationalRole === 'ADMIN') {
      setStoredAdminPassword(newPasswordInput.trim());
    }

    // Ghi nhật ký kiểm toán
    await recordSystemAuditLog({
      actorId: actor.actorId,
      actorName: actor.displayName || staff.displayName,
      actorRole: actor.actorRole,
      actorRoleLabel: actor.actorRole,
      actionType: 'UPDATE',
      actionLabel: 'Thành viên tự đổi mật khẩu cá nhân',
      module: 'SYSTEM_ADMIN',
      moduleLabel: 'Bảo Mật Cá Nhân',
      targetEntityId: staff.actorId,
      targetEntityName: `${staff.displayName} (${staff.staffCode})`,
      summary: `Thành viên ${staff.displayName} (${staff.actorId}) đã tự thay đổi mật khẩu tài khoản thành công.`,
      severity: 'IMPORTANT',
    });

    return { success: true, message: 'Đổi mật khẩu cá nhân thành công!' };
  }

  return { success: true, message: 'Đổi mật khẩu thành công!' };
}
