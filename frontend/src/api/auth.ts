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
    // Fallback if API is offline
    return [
      ADMIN_DEMO_ACCOUNT,
      { actorId: 'STAFF-DIR-001', staffCode: 'NV-DIR-001', displayName: 'Hoàng Quốc Anh', actorRole: 'SUPERVISOR', status: 'ACTIVE' },
      { actorId: 'STAFF-MGR-002', staffCode: 'NV-MGR-002', displayName: 'Nguyễn Thị Thu Hà', actorRole: 'CARE_MANAGER', status: 'ACTIVE' },
      { actorId: 'STAFF-NUR-003', staffCode: 'NV-NUR-003', displayName: 'Trần Thị Mai', actorRole: 'NURSE', status: 'ACTIVE' },
      { actorId: 'STAFF-CG-004', staffCode: 'NV-CG-004', displayName: 'Lê Văn Nam', actorRole: 'CAREGIVER', status: 'ACTIVE' },
      { actorId: 'STAFF-NUT-007', staffCode: 'NV-NUT-007', displayName: 'Hoàng Minh Châu', actorRole: 'NUTRITIONIST', status: 'ACTIVE' },
      { actorId: 'STAFF-ACC-008', staffCode: 'NV-ACC-008', displayName: 'Vũ Bích Ngọc', actorRole: 'ACCOUNTANT', status: 'ACTIVE' },
      { actorId: 'STAFF-REC-009', staffCode: 'NV-REC-009', displayName: 'Đặng Thanh Tâm', actorRole: 'RECEPTIONIST', status: 'ACTIVE' },
    ];
  }
}

export async function resolveStaffActor(actorId: string): Promise<ActiveStaffMember> {
  const trimmed = actorId.trim();
  if (trimmed.toLowerCase() === 'admin' || trimmed === 'STAFF-ADMIN-001' || trimmed === 'ADMIN-001') {
    return ADMIN_DEMO_ACCOUNT;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/resolve-actor/${encodeURIComponent(trimmed)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Không tìm thấy thông tin cho mã: ${actorId}`);
    }
    return res.json();
  } catch (err: any) {
    if (trimmed.toLowerCase() === 'admin') return ADMIN_DEMO_ACCOUNT;
    throw err;
  }
}

export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const currentPassword = getStoredAdminPassword();
  return inputPassword === currentPassword;
}
