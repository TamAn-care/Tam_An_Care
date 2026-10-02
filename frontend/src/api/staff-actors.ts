import type {
  HumanActorSession,
  HumanActorRole,
} from '../types/actor';

import {
  apiRequest,
} from './client';

export type StaffActorStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface StaffActor {
  actorId: string;
  staffCode: string;
  displayName: string;
  primaryOperationalRole:
    HumanActorRole;
  department: string;
  email: string;
  phone: string;
  status: StaffActorStatus;
  employmentReference:
    string | null;
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
  primaryOperationalRole:
    HumanActorRole;
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

interface StaffListResponse {
  items: StaffActor[];
  count: number;
  limit: number;
}

const SUPPORTED_CREATE_ROLES:
  readonly HumanActorRole[] = [
    'ADMIN',
    'SUPERVISOR',
    'CARE_MANAGER',
    'MEDICAL_HEAD',
    'NURSE',
    'CAREGIVER',
    'NUTRITIONIST',
    'ACCOUNTANT',
    'RECEPTIONIST',
    'PSYCHOLOGIST',
    'SOCIAL_WORKER',
    'REHABILITATION_SPECIALIST',
    'COMMUNICATIONS',
    'HOUSEKEEPING',
    'SECURITY',
    'GUARDIAN',
  ];

function requireActor(
  actor: HumanActorSession | null,
): HumanActorSession {
  if (!actor) {
    throw new Error(
      'Chưa xác định phiên làm việc. Vui lòng đăng nhập.',
    );
  }

  return actor;
}

export function generateSecurePassword():
  string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%=+';

  const bytes =
    new Uint32Array(14);

  window.crypto.getRandomValues(
    bytes,
  );

  let result = 'Ta@';

  for (
    let i = 0;
    i < bytes.length;
    i += 1
  ) {
    result +=
      chars[
        bytes[i] %
          chars.length
      ];
  }

  return result;
}

export function getNextSequentialStaffCode(
  role: HumanActorRole,
  existingList:
    Array<{
      staffCode?: string;
      actorId?: string;
    }> = [],
): {
  staffCode: string;
  actorId: string;
  prefix: string;
  seqNumber: number;
} {
  const prefixMap:
    Partial<
      Record<
        HumanActorRole,
        string
      >
    > = {
      SUPERVISOR: 'DIR',
      CARE_MANAGER: 'MGR',
      NURSE: 'NUR',
      CAREGIVER: 'CG',
    };

  const prefix =
    prefixMap[role] ||
    'STF';

  let maxSeq = 0;

  const pattern =
    new RegExp(
      `(?:TA-|NV-|STAFF-)?${prefix}[-_]?(\\d+)`,
      'i',
    );

  for (const item of existingList) {
    for (
      const code
      of [
        item.staffCode,
        item.actorId,
      ]
    ) {
      if (!code) {
        continue;
      }

      const match =
        code.match(pattern);

      if (match?.[1]) {
        const n =
          Number(match[1]);

        if (
          Number.isFinite(n) &&
          n > maxSeq
        ) {
          maxSeq = n;
        }
      }
    }
  }

  const seqNumber =
    maxSeq + 1;

  const seq =
    String(seqNumber)
      .padStart(2, '0');

  return {
    staffCode:
      `TA-${prefix}-${seq}`,
    actorId:
      `TA-${prefix}-${seq}`,
    prefix,
    seqNumber,
  };
}

export async function listStaffActors(
  actor:
    HumanActorSession | null,
  options:
    StaffActorListOptions = {},
): Promise<StaffActor[]> {
  requireActor(actor);

  const params =
    new URLSearchParams();

  params.set(
    'limit',
    String(
      Math.min(
        options.limit || 100,
        100,
      ),
    ),
  );

  if (
    options.status &&
    options.status !==
      ('ALL' as StaffActorStatus)
  ) {
    params.set(
      'status',
      options.status,
    );
  }

  const response =
    await apiRequest<
      StaffListResponse
    >(
      `/api/operations/staff-actors?${params.toString()}`,
      {
        actor,
      },
    );

  let items =
    response.items || [];

  if (
    options.role &&
    options.role !==
      ('ALL' as HumanActorRole)
  ) {
    items =
      items.filter(
        (item) =>
          item.primaryOperationalRole ===
            options.role,
      );
  }

  if (
    options.searchTerm?.trim()
  ) {
    const q =
      options.searchTerm
        .trim()
        .toLowerCase();

    items =
      items.filter(
        (item) =>
          item.displayName
            .toLowerCase()
            .includes(q)
          ||
          item.staffCode
            .toLowerCase()
            .includes(q)
          ||
          item.actorId
            .toLowerCase()
            .includes(q)
          ||
          item.department
            .toLowerCase()
            .includes(q)
          ||
          item.email
            .toLowerCase()
            .includes(q)
          ||
          item.phone
            .includes(q),
      );
  }

  return items;
}

export async function getStaffActor(
  actorId: string,
  actor:
    HumanActorSession | null,
): Promise<StaffActor> {
  requireActor(actor);

  return apiRequest<StaffActor>(
    `/api/operations/staff-actors/${encodeURIComponent(actorId)}`,
    {
      actor,
    },
  );
}

export async function createStaffAccount(
  actor:
    HumanActorSession | null,
  input:
    CreateStaffAccountInput,
): Promise<StaffActor> {
  requireActor(actor);

  if (
    !SUPPORTED_CREATE_ROLES
      .includes(
        input.primaryOperationalRole,
      )
  ) {
    throw new Error(
      'Vai trò nhân sự không hợp lệ hoặc chưa được TamAnCare hỗ trợ.',
    );
  }

  const initialPassword =
    input.initialPassword?.trim()
    || generateSecurePassword();

  if (initialPassword.length < 12) {
    throw new Error(
      'Mật khẩu phải có ít nhất 12 ký tự.',
    );
  }

  const result =
    await apiRequest<StaffActor>(
      '/api/operations/staff-actors',
      {
        method: 'POST',
        actor,
        body:
          JSON.stringify({
            staffCode:
              input.staffCode,
            displayName:
              input.displayName,
            primaryOperationalRole:
              input.primaryOperationalRole,
            department:
              input.department,
            email:
              input.email,
            phone:
              input.phone,
            employmentReference:
              null,
            initialPassword,
          }),
      },
    );

  return {
    ...result,
    initialPassword,
  };
}

export async function resetStaffPassword(
  actor:
    HumanActorSession | null,
  input:
    ResetStaffPasswordInput,
): Promise<{
  success: boolean;
  newPassword: string;
}> {
  requireActor(actor);

  // PROTECTED_ADMIN_ACCOUNT
  if (input.actorId === 'TA-DIR-001') {
    throw new Error(
      'Tài khoản quản trị TA-DIR-001 được bảo vệ. '
      + 'Chỉ có thể đổi mật khẩu bằng chức năng Đổi mật khẩu cá nhân.',
    );
  }


  const password =
    input.newPassword?.trim()
    || generateSecurePassword();

  if (password.length < 12) {
    throw new Error(
      'Mật khẩu phải có ít nhất 12 ký tự.',
    );
  }

  await apiRequest(
    `/api/operations/staff-actors/${encodeURIComponent(input.actorId)}/reset-password`,
    {
      method: 'POST',
      actor,
      body:
        JSON.stringify({
          newPassword:
            password,
        }),
    },
  );

  return {
    success: true,
    newPassword: password,
  };
}

export async function updateStaffStatus(
  actor:
    HumanActorSession | null,
  input:
    UpdateStaffStatusInput,
): Promise<StaffActor> {
  requireActor(actor);

  return apiRequest<StaffActor>(
    `/api/operations/staff-actors/${encodeURIComponent(input.actorId)}/status`,
    {
      method: 'POST',
      actor,
      body:
        JSON.stringify({
          status:
            input.status,
          reason:
            input.reason,
        }),
    },
  );
}

export async function changeSelfPassword(
  actor:
    HumanActorSession | null,
  currentPasswordInput: string,
  newPasswordInput: string,
): Promise<{
  success: boolean;
  message: string;
}> {
  requireActor(actor);

  const newPassword =
    newPasswordInput.trim();

  if (newPassword.length < 12) {
    throw new Error(
      'Mật khẩu mới phải có ít nhất 12 ký tự.',
    );
  }

  return apiRequest(
    '/api/operations/staff-actors/self/change-password',
    {
      method: 'POST',
      actor,
      body:
        JSON.stringify({
          currentPassword:
            currentPasswordInput,
          newPassword,
        }),
    },
  );
}

export async function deleteStaffAccount(
  actor:
    HumanActorSession | null,
  actorIdToDelete: string,
): Promise<{
  success: boolean;
  deletedActor: StaffActor;
}> {
  requireActor(actor);

  return apiRequest(
    `/api/operations/staff-actors/${encodeURIComponent(actorIdToDelete)}/archive`,
    {
      method: 'POST',
      actor,
    },
  );
}
