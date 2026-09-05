import { API_BASE_URL } from './client';
import { HumanActorRole } from '../types/actor';
import { mockStaffActors } from './staff-actors';

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
  { actorId: 'TA-DIR-01', staffCode: 'TA-DIR-01', displayName: 'Hoàng Quốc Anh (Ban Giám Đốc)', actorRole: 'SUPERVISOR', status: 'ACTIVE' },
  { actorId: 'STAFF-DIR-001', staffCode: 'NV-DIR-001', displayName: 'Hà Quang Anh (Ban Giám Đốc)', actorRole: 'SUPERVISOR', status: 'ACTIVE' },
  { actorId: 'TA-MGR-01', staffCode: 'TA-MGR-01', displayName: 'Nguyễn Thị Thu Hà (Quản Lý Vận Hành)', actorRole: 'CARE_MANAGER', status: 'ACTIVE' },
  { actorId: 'STAFF-MGR-001', staffCode: 'MGR-001', displayName: 'Phạm Minh Đức (Quản Lý Vận Hành)', actorRole: 'CARE_MANAGER', status: 'ACTIVE' },

  // Điều Dưỡng Y Tế
  { actorId: 'TA-NUR-01', staffCode: 'TA-NUR-01', displayName: 'Trần Thị Mai (Điều Dưỡng Viên)', actorRole: 'NURSE', status: 'ACTIVE' },
  { actorId: 'STAFF-NUR-001', staffCode: 'NUR-001', displayName: 'Lê Thị Lan (Điều Dưỡng Trưởng)', actorRole: 'NURSE', status: 'ACTIVE' },

  // Chăm Sóc Viên
  { actorId: 'TA-CG-01', staffCode: 'TA-CG-01', displayName: 'Lê Văn Nam (Chăm Sóc Viên)', actorRole: 'CAREGIVER', status: 'ACTIVE' },
  { actorId: 'cg-mai-001', staffCode: 'CG-001', displayName: 'Trần Thị Mai (Chăm Sóc Viên Khu A)', actorRole: 'CAREGIVER', status: 'ACTIVE' },
  { actorId: 'cg-hoa-003', staffCode: 'CG-003', displayName: 'Đặng Thị Hoa (Chăm Sóc Viên Khu B)', actorRole: 'CAREGIVER', status: 'ACTIVE' },

  // Dinh Dưỡng & Bếp
  { actorId: 'TA-NUT-01', staffCode: 'TA-NUT-01', displayName: 'Hoàng Minh Châu (Chuyên Gia Dinh Dưỡng)', actorRole: 'NUTRITIONIST', status: 'ACTIVE' },

  // Kế Toán & Viện Phí
  { actorId: 'TA-ACC-01', staffCode: 'TA-ACC-01', displayName: 'Vũ Bích Ngọc (Kế Toán Viện Phí)', actorRole: 'ACCOUNTANT', status: 'ACTIVE' },

  // Lễ Tân & Tiếp Đón
  { actorId: 'TA-REC-01', staffCode: 'TA-REC-01', displayName: 'Đặng Thanh Tâm (Lễ Tân Tiếp Đón)', actorRole: 'RECEPTIONIST', status: 'ACTIVE' },

  // Tâm Lý & PHCN
  { actorId: 'TA-PSY-01', staffCode: 'TA-PSY-01', displayName: 'Lý Quốc Cường (Tư Vấn Tâm Lý)', actorRole: 'PSYCHOLOGIST', status: 'ACTIVE' },
  { actorId: 'TA-REH-01', staffCode: 'TA-REH-01', displayName: 'Đỗ Hữu Phước (Vật Lý Trị Liệu)', actorRole: 'REHABILITATION_SPECIALIST', status: 'ACTIVE' },

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

function getLocalStorageCreatedStaff(): ActiveStaffMember[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('tamancare_created_staff');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function fetchActiveStaff(): Promise<ActiveStaffMember[]> {
  const localCreated = getLocalStorageCreatedStaff();
  let baseList: ActiveStaffMember[] = [];

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/active-staff`);
    if (!res.ok) throw new Error('API server returned non-ok');
    const data: ActiveStaffMember[] = await res.json();
    baseList = [ADMIN_DEMO_ACCOUNT, ...data.filter((d) => d.actorId !== 'Admin')];
  } catch {
    // Fallback if API is offline: return master mock staff list
    baseList = MOCK_ACTIVE_STAFF_ACCOUNTS;
  }

  // Merge in created staff from staff-actors or localStorage
  const merged = [...baseList];
  for (const item of localCreated) {
    if (!merged.some((m) => m.actorId === item.actorId || m.staffCode === item.staffCode)) {
      merged.push(item);
    }
  }

  return merged;
}

export async function resolveStaffActor(actorIdOrCode: string): Promise<ActiveStaffMember> {
  const rawInput = actorIdOrCode.trim();
  const q = rawInput.toLowerCase();
  const normalizedSearch = q.replace(/^(ta-|nv-|staff-)/, '');

  // 1. Check Root Admin aliases
  if (q === 'admin' || q === 'staff-admin-001' || q === 'admin-001' || q === 'adm-001' || q === 'ta-adm-01') {
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

  // 3. Robust Local Resolver: Check dynamically created staff in localStorage
  const createdStaff = getLocalStorageCreatedStaff();
  const matchCreated = createdStaff.find(
    (s) =>
      s.actorId.toLowerCase() === q ||
      s.staffCode.toLowerCase() === q ||
      s.staffCode.toLowerCase().replace(/^(ta-|nv-|staff-)/, '') === normalizedSearch,
  );
  if (matchCreated) return matchCreated;

  // 4. Check in-memory mockStaffActors list from staff-actors.ts
  if (Array.isArray(mockStaffActors)) {
    const matchMockActor = mockStaffActors.find(
      (s) =>
        s.actorId.toLowerCase() === q ||
        s.staffCode.toLowerCase() === q ||
        s.staffCode.toLowerCase().replace(/^(ta-|nv-|staff-)/, '') === normalizedSearch,
    );
    if (matchMockActor) {
      return {
        actorId: matchMockActor.actorId,
        staffCode: matchMockActor.staffCode,
        displayName: matchMockActor.displayName,
        actorRole: matchMockActor.primaryOperationalRole,
        status: matchMockActor.status,
      };
    }
  }

  // 5. Check master mock staff accounts list
  const match = MOCK_ACTIVE_STAFF_ACCOUNTS.find(
    (s) =>
      s.actorId.toLowerCase() === q ||
      s.staffCode.toLowerCase() === q ||
      s.staffCode.toLowerCase().replace(/^(ta-|nv-|staff-)/, '') === normalizedSearch,
  );
  if (match) return match;

  // 6. Fuzzy fallback search if user typed partial code or name
  const fuzzyMatch = MOCK_ACTIVE_STAFF_ACCOUNTS.find(
    (s) =>
      s.staffCode.toLowerCase().includes(q) ||
      s.actorId.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q),
  );
  if (fuzzyMatch) return fuzzyMatch;

  // 7. Dynamic Pattern Resolver for standard staff code formats (e.g. TA-DIR-01, NV-DIR-240, DIR-01, etc.)
  const codePatternMatch = rawInput.match(/^(?:TA-|NV-|STAFF-)?([A-Z]{2,4})[-_]?(\d+)$/i);
  if (codePatternMatch) {
    const prefix = codePatternMatch[1].toUpperCase();
    const numInt = parseInt(codePatternMatch[2], 10);
    const numStr = String(numInt).padStart(2, '0');

    const roleMap: Record<string, { role: HumanActorRole; name: string }> = {
      DIR: { role: 'SUPERVISOR', name: 'Cán Bộ Ban Giám Đốc' },
      MGR: { role: 'CARE_MANAGER', name: 'Cán Bộ Quản Lý Vận Hành' },
      NUR: { role: 'NURSE', name: 'Điều Dưỡng Viên' },
      CG: { role: 'CAREGIVER', name: 'Chăm Sóc Viên' },
      NUT: { role: 'NUTRITIONIST', name: 'Chuyên Gia Dinh Dưỡng' },
      ACC: { role: 'ACCOUNTANT', name: 'Kế Toán Viện Phí' },
      REC: { role: 'RECEPTIONIST', name: 'Lễ Tân Tiếp Đón' },
      PSY: { role: 'PSYCHOLOGIST', name: 'Tư Vấn Tâm Lý' },
      SW: { role: 'SOCIAL_WORKER', name: 'Công Tác Xã Hội' },
      REH: { role: 'REHABILITATION_SPECIALIST', name: 'Kỹ Thuật Viên PHCN' },
      HK: { role: 'HOUSEKEEPING', name: 'Nhân Viên Buồng Phòng' },
      SEC: { role: 'SECURITY', name: 'Nhân Viên An Ninh' },
      GUA: { role: 'GUARDIAN', name: 'Thân Nhân Cư Dân' },
      ADM: { role: 'ADMIN', name: 'Quản Trị Viên' },
    };

    if (roleMap[prefix]) {
      const config = roleMap[prefix];
      const dynamicStaff: ActiveStaffMember = {
        actorId: `TA-${prefix}-${numStr}`,
        staffCode: `TA-${prefix}-${numStr}`,
        displayName: `${config.name} (${prefix}-${numStr})`,
        actorRole: config.role,
        status: 'ACTIVE',
      };

      // Persist to created staff so it stays saved
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('tamancare_created_staff');
          const existingList: ActiveStaffMember[] = stored ? JSON.parse(stored) : [];
          if (!existingList.some((s) => s.staffCode === dynamicStaff.staffCode || s.actorId === dynamicStaff.actorId)) {
            existingList.push(dynamicStaff);
            localStorage.setItem('tamancare_created_staff', JSON.stringify(existingList));
          }
        } catch {
          // ignore storage errors
        }
      }
      return dynamicStaff;
    }
  }

  throw new Error(`Không tìm thấy tài khoản nhân sự với mã: "${actorIdOrCode}". Vui lòng kiểm tra lại mã nhân viên.`);
}

export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const currentPassword = getStoredAdminPassword();
  return inputPassword === currentPassword;
}
