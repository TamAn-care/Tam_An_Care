import type {
  HumanActorSession,
} from '../types/actor';

import {
  apiRequest,
} from './client';


export type PsychosocialProfessionalRole =
  | 'PSYCHOLOGIST'
  | 'SOCIAL_WORKER';


export type PsychosocialEmotionalState =
  | 'POSITIVE'
  | 'STABLE'
  | 'WITHDRAWN'
  | 'ANXIOUS_RESTLESS'
  | 'SAD_REDUCED_INTEREST'
  | 'IRRITABLE_AGITATED'
  | 'UNUSUAL_CHANGE';


export type PsychosocialSocialInteraction =
  | 'PROACTIVE'
  | 'NORMAL'
  | 'LOW'
  | 'REFUSED'
  | 'GOOD_WITH_OTHERS'
  | 'CONFLICT'
  | 'NEEDS_INTEGRATION_SUPPORT';


export type PsychosocialYesPartialNo =
  | 'YES'
  | 'PARTIAL'
  | 'NO';


export type PsychosocialEnvironmentIntegration =
  | 'GOOD'
  | 'ADAPTING'
  | 'DIFFICULT';


export type PsychosocialFollowUpStatus =
  | 'NORMAL'
  | 'MONITOR'
  | 'COORDINATED';


export type PsychosocialInterventionCode =
  | 'EMOTIONAL_SUPPORT'
  | 'INTEGRATION_SUPPORT'
  | 'GROUP_ACTIVITY'
  | 'FAMILY_CONNECTION'
  | 'CONFLICT_SUPPORT'
  | 'PARTICIPATION_ENCOURAGEMENT'
  | 'CASE_FOLLOW_UP'
  | 'REFER_OTHER_DEPARTMENT';


export type PsychosocialObservationStatus =
  | 'ACTIVE'
  | 'CORRECTED'
  | 'VOIDED';


export interface PsychosocialActivityReference {
  activitySessionId: string;
  participationId?: string | null;
}


export interface PsychosocialDailyObservation {
  observationId: string;
  residentId: string;

  observedAt: string;

  authorId: string;
  authorRole: PsychosocialProfessionalRole;

  emotionalState:
    PsychosocialEmotionalState;

  socialInteraction:
    PsychosocialSocialInteraction;

  staffCooperation:
    PsychosocialYesPartialNo | null;

  environmentIntegration:
    PsychosocialEnvironmentIntegration | null;

  dailyActivityInitiative:
    PsychosocialYesPartialNo | null;

  noteworthyBehavior: boolean;
  noteworthyBehaviorNote: string | null;

  notableEventNote: string | null;

  followUpStatus:
    PsychosocialFollowUpStatus;

  coordinationDestination: string | null;
  coordinationReason: string | null;

  interventionCodes:
    PsychosocialInterventionCode[];

  activityRefs:
    PsychosocialActivityReference[];

  professionalNote: string | null;

  status:
    PsychosocialObservationStatus;

  versionNo: number;

  correctedFromId: string | null;

  createdAt: string;
  updatedAt: string;
}


export interface PsychosocialDailyObservationPayload {
  residentId: string;

  observedAt: string;

  emotionalState:
    PsychosocialEmotionalState;

  socialInteraction:
    PsychosocialSocialInteraction;

  staffCooperation?:
    PsychosocialYesPartialNo | null;

  environmentIntegration?:
    PsychosocialEnvironmentIntegration | null;

  dailyActivityInitiative?:
    PsychosocialYesPartialNo | null;

  noteworthyBehavior: boolean;

  noteworthyBehaviorNote?:
    string | null;

  notableEventNote?:
    string | null;

  followUpStatus:
    PsychosocialFollowUpStatus;

  coordinationDestination?:
    string | null;

  coordinationReason?:
    string | null;

  interventionCodes:
    PsychosocialInterventionCode[];

  activityRefs:
    PsychosocialActivityReference[];

  professionalNote?:
    string | null;
}


export interface PsychosocialDailyObservationList {
  residentId: string;
  from: string;
  to: string;

  items:
    PsychosocialDailyObservation[];
}


function requirePsychosocialActor(
  actor: HumanActorSession,
): void {
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
}


function requiredText(
  value: string,
  label: string,
): string {
  const normalized =
    String(value ?? '').trim();

  if (!normalized) {
    throw new Error(
      `${label} không được để trống.`,
    );
  }

  return normalized;
}


export async function listPsychosocialDailyObservations(
  actor: HumanActorSession,
  residentIdInput: string,
  fromInput: string,
  toInput: string,
): Promise<PsychosocialDailyObservationList> {
  requirePsychosocialActor(actor);

  const residentId =
    requiredText(
      residentIdInput,
      'Người cao tuổi',
    );

  const from =
    requiredText(
      fromInput,
      'Thời điểm bắt đầu',
    );

  const to =
    requiredText(
      toInput,
      'Thời điểm kết thúc',
    );

  const params =
    new URLSearchParams();

  params.set(
    'residentId',
    residentId,
  );

  params.set(
    'from',
    from,
  );

  params.set(
    'to',
    to,
  );

  return apiRequest<PsychosocialDailyObservationList>(
    `/api/psychosocial-daily-observations?${params.toString()}`,
    {
      actor,
    },
  );
}


export async function createPsychosocialDailyObservation(
  actor: HumanActorSession,
  payload: PsychosocialDailyObservationPayload,
): Promise<PsychosocialDailyObservation> {
  requirePsychosocialActor(actor);

  return apiRequest<PsychosocialDailyObservation>(
    '/api/psychosocial-daily-observations',
    {
      method: 'POST',
      actor,
      body: JSON.stringify(payload),
    },
  );
}


export async function correctPsychosocialDailyObservation(
  actor: HumanActorSession,
  observationIdInput: string,
  payload: PsychosocialDailyObservationPayload,
): Promise<PsychosocialDailyObservation> {
  requirePsychosocialActor(actor);

  const observationId =
    requiredText(
      observationIdInput,
      'Mã ghi nhận',
    );

  return apiRequest<PsychosocialDailyObservation>(
    `/api/psychosocial-daily-observations/${
      encodeURIComponent(observationId)
    }/correct`,
    {
      method: 'POST',
      actor,
      body: JSON.stringify(payload),
    },
  );
}


export interface PsychosocialAccessibleResident {
  residentId: string;
  residentCode: string;
  displayName: string;
  room: string | null;
  bed: string | null;
}


export interface PsychosocialAccessibleResidentList {
  items:
    PsychosocialAccessibleResident[];
}


export async function listPsychosocialAccessibleResidents(
  actor: HumanActorSession,
): Promise<PsychosocialAccessibleResidentList> {
  requirePsychosocialActor(actor);

  return apiRequest<PsychosocialAccessibleResidentList>(
    '/api/psychosocial-daily-observations/accessible-residents',
    {
      actor,
    },
  );
}
