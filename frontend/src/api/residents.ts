import {
  apiRequest,
} from './client';

import type {
  HumanActorSession,
} from '../types/actor';

export type ResidentGender =
  | 'MALE'
  | 'FEMALE'
  | 'OTHER'
  | 'UNSPECIFIED';

export type ResidentCareLevel =
  | 'INDEPENDENT'
  | 'ASSISTED'
  | 'HIGH_ASSISTANCE'
  | 'DEPENDENT';

export interface ResidentContext {
  residentId: string;
  residentCode: string;
  displayName: string;
  dateOfBirth: string;
  gender: ResidentGender;
  room: string | null;
  bed: string | null;
  careLevel: ResidentCareLevel;
  activeStatus: boolean;
}

export interface ResidentContextResponse {
  resident: ResidentContext;
  source: 'V7.4.3_DEVELOPMENT_CONTEXT';
  clinicalRecord: false;
}

export type Availability =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'UNAVAILABLE';

export interface OperationalCareViewResponse {
  status: 'OK';
  generatedAt: string;
  viewMode: 'OPERATIONAL_READ_ONLY';

  resident: Record<string, unknown>;
  carePlan: Record<string, unknown> | null;
  workQueue: Array<Record<string, unknown>>;
  clinical: Array<Record<string, unknown>>;

  medication: {
    orders: Array<Record<string, unknown>>;
    administrations:
      Array<Record<string, unknown>>;
  };

  incidents: Array<Record<string, unknown>>;

  availability: {
    resident: Availability;
    carePlan: Availability;
    workQueue: Availability;
    clinical: Availability;
    medicationOrders: Availability;
    medicationAdministrations: Availability;
    incidents: Availability;
  };

  freshness: Record<
    string,
    {
      sourceTimestamp: string | null;
      generatedAt: string;
    }
  >;

  provenance: Record<string, unknown>;

  authority: {
    readOnly: boolean;
    crossDomainMutation: boolean;
    autonomousClinicalAction: boolean;
    autonomousMedicationAction: boolean;
    autonomousIncidentAction: boolean;
    autonomousCarePlanAction: boolean;
    autonomousCareTaskAction: boolean;
  };

  access: {
    actorRole: string;
    scope: string;
    serverAuthorized: boolean;
    residentScopeEnforcement:
      'CANONICAL_RESIDENT_SCOPE';
    redactionApplied: boolean;
  };

  limits: {
    perSourceDomain: number;
  };
}

export async function listResidents(
  actor?: HumanActorSession | null,
): Promise<ResidentContextResponse[]> {
  return apiRequest<ResidentContextResponse[]>(
    '/api/residents',
    {
      actor,
    },
  );
}

export async function getResident(
  residentId: string,
  actor?: HumanActorSession | null,
): Promise<ResidentContextResponse> {
  if (!residentId.trim()) {
    throw new Error(
      'Mã cư dân không được để trống.',
    );
  }

  return apiRequest<ResidentContextResponse>(
    `/api/residents/${encodeURIComponent(residentId)}`,
    {
      actor,
    },
  );
}

export async function getResidentCareView(
  residentId: string,
  actor: HumanActorSession,
): Promise<OperationalCareViewResponse> {
  if (!residentId.trim()) {
    throw new Error(
      'Mã cư dân không được để trống.',
    );
  }

  return apiRequest<OperationalCareViewResponse>(
    `/api/operations/residents/${encodeURIComponent(residentId)}/care-view`,
    {
      actor,
    },
  );
}
