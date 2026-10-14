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

export const MOCK_RESIDENT_CONTEXTS: ResidentContextResponse[] = [
  {
    resident: {
      residentId: 'res-demo-001',
      residentCode: 'RES-2026-001',
      displayName: 'Nguyễn Văn An',
      dateOfBirth: '1944-05-15',
      gender: 'MALE',
      room: '101',
      bed: '101-2',
      careLevel: 'ASSISTED',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
  {
    resident: {
      residentId: 'res-demo-002',
      residentCode: 'RES-2026-002',
      displayName: 'Trần Thị Bình',
      dateOfBirth: '1948-08-20',
      gender: 'FEMALE',
      room: '102',
      bed: '102-1',
      careLevel: 'HIGH_ASSISTANCE',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
  {
    resident: {
      residentId: 'res-demo-003',
      residentCode: 'RES-2026-003',
      displayName: 'Phạm Văn Cường',
      dateOfBirth: '1950-11-10',
      gender: 'MALE',
      room: '103',
      bed: '103-2',
      careLevel: 'INDEPENDENT',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
  {
    resident: {
      residentId: 'res-demo-004',
      residentCode: 'RES-2026-004',
      displayName: 'Phạm Thị Dung',
      dateOfBirth: '1942-03-25',
      gender: 'FEMALE',
      room: '201',
      bed: '201-1',
      careLevel: 'DEPENDENT',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
  {
    resident: {
      residentId: 'res-demo-005',
      residentCode: 'RES-2026-005',
      displayName: 'Hoàng Văn Em',
      dateOfBirth: '1945-09-15',
      gender: 'MALE',
      room: '202',
      bed: '202-2',
      careLevel: 'ASSISTED',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
  {
    resident: {
      residentId: 'res-demo-006',
      residentCode: 'RES-2026-006',
      displayName: 'Ngô Thị Phương',
      dateOfBirth: '1947-12-05',
      gender: 'FEMALE',
      room: '203',
      bed: '203-1',
      careLevel: 'ASSISTED',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
  {
    resident: {
      residentId: 'res-demo-007',
      residentCode: 'RES-2026-007',
      displayName: 'Vũ Văn Giáp',
      dateOfBirth: '1952-01-30',
      gender: 'MALE',
      room: '301',
      bed: '301-2',
      careLevel: 'INDEPENDENT',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
  {
    resident: {
      residentId: 'res-demo-008',
      residentCode: 'RES-2026-008',
      displayName: 'Đỗ Thị Hoa',
      dateOfBirth: '1940-07-18',
      gender: 'FEMALE',
      room: '302',
      bed: '302-1',
      careLevel: 'DEPENDENT',
      activeStatus: true,
    },
    source: 'V7.4.3_DEVELOPMENT_CONTEXT',
    clinicalRecord: false,
  },
];

const LS_RESIDENTS_KEY = 'taman_resident_contexts_v1';

export function getStoredResidents(): ResidentContextResponse[] {
  try {
    const raw = localStorage.getItem(LS_RESIDENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_RESIDENT_CONTEXTS;
}

export function saveStoredResidents(items: ResidentContextResponse[]) {
  try {
    localStorage.setItem(LS_RESIDENTS_KEY, JSON.stringify(items));
  } catch {}
}

export function farewellResident(
  residentId: string,
  _reason?: string,
): ResidentContextResponse[] {
  const residents = getStoredResidents();
  const target = residents.find((r) => r.resident.residentId === residentId);
  if (target) {
    target.resident.activeStatus = false;
    target.resident.room = null;
    target.resident.bed = null;
    saveStoredResidents(residents);
  }
  return residents;
}

export function updateResidentLocation(
  residentId: string,
  newRoom: string | null,
  newBed: string | null,
): ResidentContextResponse[] {
  const residents = getStoredResidents();
  const target = residents.find((r) => r.resident.residentId === residentId);
  if (target) {
    target.resident.room = newRoom;
    target.resident.bed = newBed;
    saveStoredResidents(residents);
  }
  return residents;
}

export async function listResidents(
  actor?: HumanActorSession | null,
): Promise<ResidentContextResponse[]> {
  try {
    const res = await apiRequest<ResidentContextResponse[]>(
      '/api/residents',
      {
        actor,
      },
    );
    if (res && res.length > 0) return res;
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listResidents:', error);
  }
  return getStoredResidents();
}

export async function getResident(
  residentId: string,
  actor?: HumanActorSession | null,
): Promise<ResidentContextResponse> {
  try {
    return await apiRequest<ResidentContextResponse>(
      `/api/residents/${encodeURIComponent(residentId)}`,
      {
        actor,
      },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for getResident:', error);
    const allResidents = getStoredResidents();
    const found = allResidents.find((r) => r.resident.residentId === residentId);
    if (found) return found;
    return allResidents[0];
  }
}

// Security-sensitive endpoint: never substitute mock/localStorage data for an
// API denial, unavailable server, or missing resident. Caller handles 401/403/404.
export async function getResidentCareView(
  residentId: string,
  actor: HumanActorSession,
): Promise<OperationalCareViewResponse> {
  return apiRequest<OperationalCareViewResponse>(
    `/api/operations/residents/${encodeURIComponent(residentId)}/care-view`,
    { actor },
  );
}
