import type {
  HumanActorSession,
} from '../types/actor';

import {
  apiRequest,
} from './client';


export interface ActivityDailyContextParticipation {
  participationId: string;
  attendanceStatus: string;
  participationLevel: string | null;
  recordStatus: string;
}


export interface ActivityDailyContextItem {
  activitySessionId: string;
  activityProgramId: string | null;
  programTitle: string | null;
  activityCategory: string | null;
  sessionType: string;
  scheduledAt: string;
  location: string | null;
  sessionStatus: string;

  participation:
    ActivityDailyContextParticipation | null;
}


export interface ActivityDailyContext {
  residentId: string;
  from: string;
  to: string;

  items:
    ActivityDailyContextItem[];

  authority: {
    serverAuthorized: true;
    residentScopeEnforcement:
      'CANONICAL_RESIDENT_SCOPE';
  };
}


export async function getActivityDailyContext(
  actor: HumanActorSession,
  residentIdInput: string,
  fromInput: string,
  toInput: string,
): Promise<ActivityDailyContext> {
  const residentId =
    String(residentIdInput ?? '').trim();

  const from =
    String(fromInput ?? '').trim();

  const to =
    String(toInput ?? '').trim();


  if (!actor?.actorId || !actor?.actorRole) {
    throw new Error(
      'Không xác định được nhân sự đang thực hiện nghiệp vụ.',
    );
  }


  if (
    actor.actorRole !== 'PSYCHOLOGIST' &&
    actor.actorRole !== 'SOCIAL_WORKER'
  ) {
    throw new Error(
      'Chức năng này chỉ dành cho nghiệp vụ Tâm lý – CTXH.',
    );
  }


  if (!residentId) {
    throw new Error(
      'Chưa xác định người cao tuổi.',
    );
  }


  if (!from || !to) {
    throw new Error(
      'Khoảng thời gian hoạt động không hợp lệ.',
    );
  }


  const params =
    new URLSearchParams();

  params.set('from', from);
  params.set('to', to);


  return apiRequest<ActivityDailyContext>(
    `/api/activity-rehabilitation/${
      encodeURIComponent(residentId)
    }/daily-context?${params.toString()}`,
    {
      actor,
    },
  );
}
