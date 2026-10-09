/**
 * Resident meal registration authorization contract.
 *
 * This policy applies ONLY to registering portions for residents.
 * It does not grant clinical dietary-order writes, menu approval,
 * staff meal registration, or guest/family meal billing rights.
 *
 * Server callers must supply an authenticated, active actor and the
 * resident assignment result from the authoritative access service.
 * Never take either field from client-provided JSON.
 */
export type ResidentMealActorRole =
  | 'CAREGIVER'
  | 'CARE_MANAGER'
  | 'NUTRITIONIST'
  | 'SUPERVISOR'
  | 'ADMIN'
  | string;

export type ResidentMealAction = 'VIEW' | 'REGISTER' | 'UPDATE' | 'CANCEL';

export type ResidentMealPermissionInput = {
  role: ResidentMealActorRole;
  action: ResidentMealAction;
  /** Result of server-side active assignment verification (DIRECT_CARE). */
  assignedResident: boolean;
  /** Actor resolved from authenticated session and active staff record. */
  activeAuthenticatedActor: boolean;
};

export type ResidentMealPermissionResult =
  | { allowed: true; scope: 'ALL' | 'ASSIGNED' }
  | { allowed: false; reason: 'UNAUTHENTICATED' | 'ROLE_FORBIDDEN' | 'OUT_OF_SCOPE' };

export function authorizeResidentMealRegistration(
  input: ResidentMealPermissionInput,
): ResidentMealPermissionResult {
  if (!input.activeAuthenticatedActor) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  const role = String(input.role ?? '').trim().toUpperCase();
  if (role === 'CARE_MANAGER') {
    return { allowed: true, scope: 'ALL' };
  }
  if (role === 'CAREGIVER') {
    return input.assignedResident
      ? { allowed: true, scope: 'ASSIGNED' }
      : { allowed: false, reason: 'OUT_OF_SCOPE' };
  }
  if (
    input.action === 'VIEW' &&
    (role === 'NUTRITIONIST' || role === 'SUPERVISOR')
  ) {
    return { allowed: true, scope: 'ALL' };
  }
  return { allowed: false, reason: 'ROLE_FORBIDDEN' };
}

/**
 * Only count actively registered portions. Caller is responsible for
 * querying durable rows, filtering to the requested day/meal and applying
 * database-level uniqueness for resident + meal slot.
 */
export function countRegisteredPortions(
  registrations: readonly { status: string; portions: number }[],
): number {
  return registrations.reduce((sum, row) => {
    if (row.status !== 'REGISTERED') return sum;
    if (!Number.isSafeInteger(row.portions) || row.portions < 1) {
      throw new Error('Invalid registered portion count');
    }
    return sum + row.portions;
  }, 0);
}
