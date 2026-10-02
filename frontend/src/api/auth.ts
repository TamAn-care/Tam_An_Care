import {
  API_BASE_URL,
  apiRequest,
} from './client';

import type {
  HumanActorRole,
} from '../types/actor';

import {
  clearStoredAuthSession,
  readStoredAuthMetadata,
  storeAccessToken,
} from '../auth/session';

export interface ActiveStaffMember {
  actorId: string;
  staffCode: string;
  displayName: string;
  actorRole:
    HumanActorRole;
  status: string;
}

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  actor:
    ActiveStaffMember;
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<ActiveStaffMember> {
  const cleanIdentifier =
    identifier.trim();

  if (
    !cleanIdentifier ||
    !password
  ) {
    throw new Error(
      'Vui lòng nhập đầy đủ tên đăng nhập/mã nhân viên và mật khẩu.',
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          'Accept':
            'application/json',
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify({
            actorId:
              cleanIdentifier,
            password,
          }),
      },
    );

  if (!response.ok) {
    clearStoredAuthSession();

    if (
      response.status ===
        401
    ) {
      throw new Error(
        'Tên đăng nhập/mã nhân viên hoặc mật khẩu không chính xác.',
      );
    }

    throw new Error(
      'Không thể đăng nhập vào hệ thống.',
    );
  }

  const data =
    await response.json() as
      LoginResponse;

  if (
    !data.accessToken ||
    !data.actor ||
    !data.actor.actorId ||
    !data.actor.actorRole
  ) {
    clearStoredAuthSession();

    throw new Error(
      'Máy chủ trả về phiên đăng nhập không hợp lệ.',
    );
  }

  storeAccessToken(
    data.accessToken,
  );

  return data.actor;
}

export async function logoutCurrentSession():
  Promise<void> {
  const auth =
    readStoredAuthMetadata();

  if (!auth) {
    clearStoredAuthSession();
    return;
  }

  try {
    const response =
      await fetch(
        `${API_BASE_URL}/api/auth/logout`,
        {
          method: 'POST',
          headers: {
            'Accept':
              'application/json',
            'Authorization':
              `Bearer ${auth.token}`,
            'x-actor-id':
              auth.actorId,
            'x-auth-session-id':
              auth.sessionId,
          },
        },
      );

    if (
      !response.ok &&
      response.status !== 401
    ) {
      throw new Error(
        'Không thể kết thúc phiên đăng nhập trên máy chủ.',
      );
    }
  } finally {
    clearStoredAuthSession();
  }
}

export async function fetchActiveStaff():
  Promise<ActiveStaffMember[]> {
  return apiRequest<
    ActiveStaffMember[]
  >(
    '/api/auth/active-staff',
  );
}

export async function resolveStaffActor(
  actorIdOrCode: string,
): Promise<ActiveStaffMember> {
  const value =
    actorIdOrCode.trim();

  if (!value) {
    throw new Error(
      'Mã nhân viên không được để trống.',
    );
  }

  return apiRequest<
    ActiveStaffMember
  >(
    `/api/auth/resolve-actor/${encodeURIComponent(value)}`,
  );
}

export function getStoredAdminPassword():
  string {
  return '';
}

export function setStoredAdminPassword(
  _newPassword: string,
): void {
  throw new Error(
    'Mật khẩu Admin cục bộ đã bị vô hiệu hóa trong Production Test.',
  );
}

export async function verifyAdminPassword(
  _inputPassword: string,
): Promise<boolean> {
  return false;
}
