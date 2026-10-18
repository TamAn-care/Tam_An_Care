import type {
  HumanActorSession,
  HumanActorRole,
} from '../types/actor';

const ACTOR_STORAGE_KEY = 'taman-care-v75-development-actor';
const TOKEN_STORAGE_KEY = 'taman-care-production-access-token';

interface TokenPayload {
  sub?: unknown;
  role?: unknown;
  jti?: unknown;
  exp?: unknown;
}

export function clearStoredAuthSession(): void {
  window.localStorage.removeItem(ACTOR_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      '=',
    );
    return JSON.parse(window.atob(padded)) as TokenPayload;
  } catch {
    return null;
  }
}

export function readStoredAccessToken(): string | null {
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    return null;
  }

  const payload = decodeTokenPayload(token);
  if (
    !payload ||
    typeof payload.sub !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }

  return token;
}

export function storeAccessToken(token: string): void {
  const payload = decodeTokenPayload(token);
  if (
    !payload ||
    typeof payload.sub !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Phiên đăng nhập không hợp lệ.');
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export interface StoredAuthMetadata {
  token: string;
  actorId: string;
  actorRole: string;
  sessionId?: string;
  expiresAt: number;
}

export function readStoredAuthMetadata(): StoredAuthMetadata | null {
  const token = readStoredAccessToken();
  if (!token) {
    return null;
  }

  const payload = decodeTokenPayload(token);
  if (
    !payload ||
    typeof payload.sub !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    clearStoredAuthSession();
    return null;
  }

  return {
    token,
    actorId: payload.sub,
    actorRole: payload.role,
    sessionId: typeof payload.jti === 'string' ? payload.jti : undefined,
    expiresAt: payload.exp,
  };
}

export function readStoredActor(): HumanActorSession | null {
  const raw = window.localStorage.getItem(ACTOR_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Partial<HumanActorSession>;
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
        typeof value.displayName === 'string'
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
    window.localStorage.removeItem(ACTOR_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ACTOR_STORAGE_KEY,
    JSON.stringify(actor),
  );
}

const ALL_ROLES: readonly HumanActorRole[] = [
  'ADMIN',
  'SUPERVISOR',
  'CARE_MANAGER',
  'MEDICAL_HEAD',
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
