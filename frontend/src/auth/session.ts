import type {
  HumanActorSession,
  HumanActorRole,
} from '../types/actor';

const STORAGE_KEY =
  'taman-care-v75-development-actor';

export function readStoredActor():
  HumanActorSession | null {
  const raw =
    window.localStorage.getItem(
      STORAGE_KEY,
    );

  if (!raw) {
    return null;
  }

  try {
    const value =
      JSON.parse(raw) as Partial<
        HumanActorSession
      >;

    if (
      typeof value.actorId !== 'string' ||
      !isRole(value.actorRole)
    ) {
      return null;
    }

    return {
      actorId: value.actorId,
      actorRole: value.actorRole,
      displayName:
        typeof value.displayName ===
        'string'
          ? value.displayName
          : undefined,
    };
  } catch {
    return null;
  }
}

export function storeActor(
  actor: HumanActorSession | null,
): void {
  if (!actor) {
    window.localStorage.removeItem(
      STORAGE_KEY,
    );
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(actor),
  );
}

const ALL_ROLES: readonly HumanActorRole[] = [
  'ADMIN',
  'SUPERVISOR',
  'CARE_MANAGER',
  'PSYCHOLOGIST',
  'SOCIAL_WORKER',
  'NURSE',
  'CAREGIVER',
  'NUTRITIONIST',
  'HOUSEKEEPING',
  'REHABILITATION_SPECIALIST',
  'SECURITY',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'GUARDIAN',
] as const;

function isRole(
  value: unknown,
): value is HumanActorRole {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}
