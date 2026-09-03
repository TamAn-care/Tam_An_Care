import { API_BASE_URL } from './client';
import { HumanActorRole } from '../types/actor';

export interface ActiveStaffMember {
  actorId: string;
  staffCode: string;
  displayName: string;
  actorRole: HumanActorRole;
  status: string;
}

export const ADMIN_DEMO_ACCOUNT: ActiveStaffMember = {
  actorId: 'Admin',
  staffCode: 'ADMIN-001',
  displayName: 'Quản Trị Viên Tối Cao (Admin)',
  actorRole: 'ADMIN',
  status: 'ACTIVE',
};

// Master Demo Staff Dataset for local resolution & offline mode
export const MOCK_ACTIVE_STAFF_ACCOUNTS: ActiveStaffMember[] = [
  ADMIN_DEMO_ACCOUNT,

  // Ban Giám Đốc & Quản Lý
  { actorId: 'STAFF-DIR-001', staffCode: 'DIR-001', displayName: 'Hà Quang Anh (Ban Giám Đốc)', actorRole: 'SUPERVISOR', status: 'ACTIVE' },
  { actorId: 'STAFF-DIR-001', staffCode: 'NV-DIR-001', displayName: 'Hoàng Quốc Anh (Ban Giám Đốc)', actorRole: 'SUPERVISOR', status: 'ACTIVE' },
  { actorId: 'STAFF-MGR-001', staffCode: 'MGR-001', displayName: 'Phạm Minh Đức (Quản Lý Vận Hành)', actorRole: 'CARE_MANAGER', status: 'ACTIVE' },
  { actorId: 'STAFF-MGR-002', staffCode: 'NV-MGR-002', displayName: 'Nguyễn Thị Thu Hà (Quản Lý Vận Hành)', actorRole: 'CARE_MANAGER', status: 'ACTIVE' },

  // Điều Dưỡng Y Tế
  { actorId: 'STAFF-NUR-001', staffCode: 'NUR-001', displayName: 'Lê Thị Lan (Điều Dưỡng Trưởng)', actorRole: 'NURSE', status: 'ACTIVE' },
  { actorId: 'STAFF-NUR-003', staffCode: 'NUR-003', displayName: 'Trần Thị Bích (Điều Dưỡng Viên)', actorRole: 'NURSE', status: 'ACTIVE' },
  { actorId: 'STAFF-NUR-003', staffCode: 'NV-NUR-003', displayName: 'Trần Thị Mai (Điều Dưỡng Viên)', actorRole: 'NURSE', status: 'ACTIVE' },

  // Chăm Sóc Viên
  { actorId: 'cg-mai-001', staffCode: 'CG-001', displayName: 'Trần Thị Mai (Chăm Sóc Viên Khu A)', actorRole: 'CAREGIVER', status: 'ACTIVE' },
  { actorId: 'cg-mai-001', staffCode: 'STAFF-CG-001', displayName: 'Trần Thị Mai (Chăm Sóc Viên Khu A)', actorRole: 'CAREGIVER', status: 'ACTIVE' },
  { actorId: 'cg-hoa-003', staffCode: 'CG-003', displayName: 'Đặng Thị Hoa (Chăm Sóc Viên Khu B)', actorRole: 'CAREGIVER', status: 'ACTIVE' },
  { actorId: 'cg-hoa-003', staffCode: 'STAFF-CG-003', displayName: 'Đặng Thị Hoa (Chăm Sóc Viên Khu B)', actorRole: 'CAREGIVER', status: 'ACTIVE' },
  { actorId: 'STAFF-CG-004', staffCode: 'NV-CG-004', displayName: 'Lê Văn Nam (Chăm Sóc Viên)', actorRole: 'CAREGIVER', status: 'ACTIVE' },
  { actorId: 'STAFF-CG-005', staffCode: 'NV-CG-005', displayName: 'Phạm Thị Lan (Chăm Sóc Viên)', actorRole: 'CAREGIVER', status: 'ACTIVE' },

  // Dinh Dưỡng & Bếp
  { actorId: 'STAFF-NUT-001', staffCode: 'NUT-001', displayName: 'Vũ Thị Dung (Chuyên Gia Dinh Dưỡng)', actorRole: 'NUTRITIONIST', status: 'ACTIVE' },
  { actorId: 'STAFF-NUT-007', staffCode: 'NV-NUT-007', displayName: 'Hoàng Minh Châu (Chuyên Gia Dinh Dưỡng)', actorRole: 'NUTRITIONIST', status: 'ACTIVE' },

  // Kế Toán & Viện Phí
  { actorId: 'STAFF-ACC-001', staffCode: 'ACC-001', displayName: 'Hoàng Bích Ngọc (Kế Toán Viện Phí)', actorRole: 'ACCOUNTANT', status: 'ACTIVE' },
  { actorId: 'STAFF-ACC-008', staffCode: 'NV-ACC-008', displayName: 'Vũ Bích Ngọc (Kế Toán Viện Phí)', actorRole: 'ACCOUNTANT', status: 'ACTIVE' },

  // Lễ Tân & Tiếp Đón
  { actorId: 'STAFF-REC-001', staffCode: 'REC-001', displayName: 'Lê Thu Hà (Lễ Tân Tiếp Đón)', actorRole: 'RECEPTIONIST', status: 'ACTIVE' },
  { actorId: 'STAFF-REC-009', staffCode: 'NV-REC-009', displayName: 'Đặng Thanh Tâm (Lễ Tân Tiếp Đón)', actorRole: 'RECEPTIONIST', status: 'ACTIVE' },

  // Tâm Lý & PHCN
  { actorId: 'STAFF-PSY-001', staffCode: 'PSY-001', displayName: 'Nguyễn Thanh Nga (Tư Vấn Tâm Lý)', actorRole: 'PSYCHOLOGIST', status: 'ACTIVE' },
  { actorId: 'STAFF-PSY-010', staffCode: 'NV-PSY-010', displayName: 'Lý Quốc Cường (Tư Vấn Tâm Lý)', actorRole: 'PSYCHOLOGIST', status: 'ACTIVE' },
  { actorId: 'STAFF-REH-001', staffCode: 'REH-001', displayName: 'Nguyễn Văn Thành (Vật Lý Trị Liệu)', actorRole: 'REHABILITATION_SPECIALIST', status: 'ACTIVE' },
  { actorId: 'STAFF-REH-012', staffCode: 'NV-REH-012', displayName: 'Đỗ Hữu Phước (Vật Lý Trị Liệu)', actorRole: 'REHABILITATION_SPECIALIST', status: 'ACTIVE' },

  // Thân Nhân
  { actorId: 'guardian-bao-001', staffCode: 'GD-001', displayName: 'Lê Gia Bảo (Thân nhân cụ Nguyễn Văn An)', actorRole: 'GUARDIAN', status: 'ACTIVE' },
  { actorId: 'guardian-duc-002', staffCode: 'GD-002', displayName: 'Trần Anh Đức (Thân nhân cụ Trần Thị Bình)', actorRole: 'GUARDIAN', status: 'ACTIVE' },
];

export function getStoredAdminPassword(): string {
  if (typeof window === 'undefined') return 'Admin';
  return window.localStorage.getItem('tamancare_admin_password') || 'Admin';
}

export function setStoredAdminPassword(newPassword: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('tamancare_admin_password', newPassword);
}

export async function fetchActiveStaff(): Promise<ActiveStaffMember[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/active-staff`);
    if (!res.ok) throw new Error('API server returned non-ok');
    const data: ActiveStaffMember[] = await res.json();
    return [ADMIN_DEMO_ACCOUNT, ...data.filter((d) => d.actorId !== 'Admin')];
  } catch {
    // Fallback if API is offline: return master mock staff list
    return MOCK_ACTIVE_STAFF_ACCOUNTS;
  }
}

export async function resolveStaffActor(actorIdOrCode: string): Promise<ActiveStaffMember> {
  const rawInput = actorIdOrCode.trim();
  const q = rawInput.toLowerCase();

  // 1. Check Root Admin aliases
  if (q === 'admin' || q === 'staff-admin-001' || q === 'admin-001' || q === 'adm-001') {
    return ADMIN_DEMO_ACCOUNT;
  }

  // 2. Try remote API resolution if available
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/resolve-actor/${encodeURIComponent(rawInput)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // API offline, proceed to robust local resolver
  }

  // 3. Robust Local Resolver (Matches staffCode, actorId, case-insensitive)
  // Check dynamically created staff in localStorage first
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('tamancare_created_staff');
      if (stored) {
        const createdStaff: ActiveStaffMember[] = JSON.parse(stored);
        const matchCreated = createdStaff.find(
          (s) =>
            s.actorId.toLowerCase() === q ||
            s.staffCode.toLowerCase() === q ||
            s.staffCode.toLowerCase().replace(/^(nv-|staff-)/, '') === q.replace(/^(nv-|staff-)/, ''),
        );
        if (matchCreated) return matchCreated;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Check master mock staff accounts list
  const match = MOCK_ACTIVE_STAFF_ACCOUNTS.find(
    (s) =>
      s.actorId.toLowerCase() === q ||
      s.staffCode.toLowerCase() === q ||
      s.staffCode.toLowerCase().replace(/^(nv-|staff-)/, '') === q.replace(/^(nv-|staff-)/, ''),
  );

  if (match) {
    return match;
  }

  // 4. Fuzzy fallback search if user typed partial code
  const fuzzyMatch = MOCK_ACTIVE_STAFF_ACCOUNTS.find(
    (s) =>
      s.staffCode.toLowerCase().includes(q) ||
      s.actorId.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q),
  );

  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  throw new Error(`Không tìm thấy tài khoản nhân sự với mã: "${actorIdOrCode}". Vui lòng kiểm tra lại mã nhân viên.`);
}

export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const currentPassword = getStoredAdminPassword();
  return inputPassword === currentPassword;
}
