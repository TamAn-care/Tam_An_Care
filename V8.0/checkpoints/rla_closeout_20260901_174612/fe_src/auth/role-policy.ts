import type {
  HumanActorRole,
} from '../types/actor';

export const ROLE_LABELS:
  Record<HumanActorRole, string> = {
    CAREGIVER: 'Nhân viên chăm sóc',
    NURSE: 'Điều dưỡng',
    CARE_MANAGER: 'Quản lý chăm sóc',
    SUPERVISOR: 'Giám sát',
  };

export type AppRouteKey =
  | 'dashboard'
  | 'residents'
  | 'operations'
  | 'staff-access'
  | 'system-status'
  | 'admissions'
  | 'health-reports'
  | 'resident-leave';

export function canAccessRoute(
  role: HumanActorRole,
  route: AppRouteKey,
): boolean {
  if (route === 'staff-access') {
    return role === 'SUPERVISOR';
  }

  return true;
}
