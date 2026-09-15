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

export async function getResidentCareView(
  residentId: string,
  actor: HumanActorSession,
): Promise<OperationalCareViewResponse> {
  try {
    return await apiRequest<OperationalCareViewResponse>(
      `/api/operations/residents/${encodeURIComponent(residentId)}/care-view`,
      {
        actor,
      },
    );
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for getResidentCareView:', error);
    const allResidents = getStoredResidents();
    const foundCtx = allResidents.find(
      (r) => r.resident.residentId.toLowerCase() === residentId.toLowerCase() ||
             r.resident.residentCode.toLowerCase() === residentId.toLowerCase()
    );
    const residentObj = foundCtx?.resident || {
      residentId,
      residentCode: `RES-${residentId.toUpperCase()}`,
      displayName: `Người cao tuổi (${residentId})`,
      dateOfBirth: '1945-01-01',
      gender: 'MALE',
      room: '101',
      bed: '101-1',
      careLevel: 'ASSISTED',
      activeStatus: true,
    };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const time8am = `${todayStr}T08:00:00.000Z`;
    const time11am = `${todayStr}T11:30:00.000Z`;
    const time2pm = `${todayStr}T14:00:00.000Z`;

    // Try reading custom recorded vitals from localStorage if present
    let storedVitals: any = null;
    try {
      const raw = localStorage.getItem(`taman_care_mock_vitals_${residentId}`);
      if (raw) storedVitals = JSON.parse(raw);
    } catch {}

    const sysBP = storedVitals?.sysBP || (residentObj.gender === 'FEMALE' ? 128 : 132);
    const diaBP = storedVitals?.diaBP || 82;
    const hr = storedVitals?.heartRate || 76;
    const temp = storedVitals?.temp || 36.6;
    const spo2 = storedVitals?.spo2 || 98;
    const respRate = storedVitals?.respRate || 18;

    const clinical = [
      {
        clinicalObservationId: `obs-${residentId}-1`,
        observationCode: 'SYS_DIA_BP',
        observationType: 'Huyết áp (Huyết áp tâm thu/tâm trương)',
        textValue: `${sysBP}/${diaBP}`,
        unit: 'mmHg',
        measuredAt: time8am,
        recordedAt: time8am,
        status: sysBP > 140 ? 'ABNORMAL' : 'NORMAL',
        abnormalFlag: sysBP > 140,
        recordedBy: 'STAFF-NUR-001',
        recordedByRole: 'NURSE',
      },
      {
        clinicalObservationId: `obs-${residentId}-2`,
        observationCode: 'HEART_RATE',
        observationType: 'Nhịp tim (Mạch)',
        numericValue: hr,
        unit: 'lần/phút',
        measuredAt: time8am,
        recordedAt: time8am,
        status: 'NORMAL',
        abnormalFlag: false,
        recordedBy: 'STAFF-NUR-001',
        recordedByRole: 'NURSE',
      },
      {
        clinicalObservationId: `obs-${residentId}-3`,
        observationCode: 'BODY_TEMP',
        observationType: 'Thân nhiệt',
        numericValue: temp,
        unit: '°C',
        measuredAt: time8am,
        recordedAt: time8am,
        status: 'NORMAL',
        abnormalFlag: false,
        recordedBy: 'STAFF-NUR-001',
        recordedByRole: 'NURSE',
      },
      {
        clinicalObservationId: `obs-${residentId}-4`,
        observationCode: 'SPO2_LEVEL',
        observationType: 'Nồng độ SpO2',
        numericValue: spo2,
        unit: '%',
        measuredAt: time8am,
        recordedAt: time8am,
        status: spo2 < 95 ? 'ABNORMAL' : 'NORMAL',
        abnormalFlag: spo2 < 95,
        recordedBy: 'STAFF-NUR-001',
        recordedByRole: 'NURSE',
      },
      {
        clinicalObservationId: `obs-${residentId}-5`,
        observationCode: 'RESP_RATE',
        observationType: 'Nhịp thở',
        numericValue: respRate,
        unit: 'lần/phút',
        measuredAt: time8am,
        recordedAt: time8am,
        status: 'NORMAL',
        abnormalFlag: false,
        recordedBy: 'STAFF-NUR-001',
        recordedByRole: 'NURSE',
      },
    ];

    const medicationOrders = [
      {
        medicationOrderId: `ord-${residentId}-1`,
        orderCode: `ORD-${residentId.toUpperCase()}-01`,
        medicationName: 'Amlodipine 5mg',
        genericName: 'Amlodipine besylate',
        dose: '1',
        doseUnit: 'viên',
        dosage: '1 viên / sáng',
        route: 'Uống',
        frequency: '1 lần/ngày (08:00 sáng)',
        instructions: 'Uống sau khi ăn sáng 30 phút. Theo dõi huyết áp trước khi cho uống.',
        prescribedAt: `${todayStr}T00:00:00.000Z`,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        highRisk: false,
        doubleCheckRequired: false,
        status: 'ACTIVE',
        prescriberName: 'BS. Nguyễn Văn Vinh',
      },
      {
        medicationOrderId: `ord-${residentId}-2`,
        orderCode: `ORD-${residentId.toUpperCase()}-02`,
        medicationName: 'Glucosamine Sulfate 500mg',
        genericName: 'Glucosamine',
        dose: '1',
        doseUnit: 'viên',
        dosage: '1 viên / trưa',
        route: 'Uống',
        frequency: '1 lần/ngày (11:30 trưa)',
        instructions: 'Uống cùng bữa ăn trưa để bảo vệ dạ dày & hỗ trợ khớp.',
        prescribedAt: `${todayStr}T00:00:00.000Z`,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        highRisk: false,
        doubleCheckRequired: false,
        status: 'ACTIVE',
        prescriberName: 'BS. Nguyễn Văn Vinh',
      },
      {
        medicationOrderId: `ord-${residentId}-3`,
        orderCode: `ORD-${residentId.toUpperCase()}-03`,
        medicationName: 'Multivitamin Senior',
        genericName: 'Vitamin tổng hợp người cao tuổi',
        dose: '1',
        doseUnit: 'viên',
        dosage: '1 viên / sáng',
        route: 'Uống',
        frequency: '1 lần/ngày',
        instructions: 'Uống buổi sáng sau ăn.',
        prescribedAt: `${todayStr}T00:00:00.000Z`,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        highRisk: false,
        doubleCheckRequired: false,
        status: 'ACTIVE',
        prescriberName: 'BS. Nguyễn Văn Vinh',
      },
    ];

    const medicationAdministrations = [
      {
        medicationAdministrationId: `adm-${residentId}-1`,
        medicationScheduleId: `sch-${residentId}-1`,
        medicationOrderId: `ord-${residentId}-1`,
        administrationCode: `ADM-01`,
        status: 'COMPLETED',
        scheduledAt: time8am,
        administeredAt: time8am,
        assignedTo: 'NURSE-01',
        assignedRole: 'NURSE',
        administrationNote: 'Cụ đã uống đúng liều, tinh thần tỉnh táo, huyết áp ổn định.',
      },
      {
        medicationAdministrationId: `adm-${residentId}-2`,
        medicationScheduleId: `sch-${residentId}-2`,
        medicationOrderId: `ord-${residentId}-2`,
        administrationCode: `ADM-02`,
        status: 'COMPLETED',
        scheduledAt: time11am,
        administeredAt: time11am,
        assignedTo: 'NURSE-01',
        assignedRole: 'NURSE',
        administrationNote: 'Cho uống cùng cơm trưa.',
      },
    ];

    const workQueue = [
      {
        careTaskId: `task-${residentId}-1`,
        carePlanId: `plan-${residentId}`,
        taskCode: 'VITAL_CHECK',
        title: 'Đo sinh hiệu & Kiểm tra huyết áp buổi sáng',
        taskCategory: 'CLINICAL_CARE',
        status: 'COMPLETED',
        priority: 'HIGH',
        scheduledAt: time8am,
        completedAt: time8am,
        assignedTo: 'STAFF-NUR-001',
        assignedRole: 'NURSE',
      },
      {
        careTaskId: `task-${residentId}-2`,
        carePlanId: `plan-${residentId}`,
        taskCode: 'MEAL_ASSIST',
        title: 'Hỗ trợ bữa ăn trưa & Kiểm tra dinh dưỡng',
        taskCategory: 'NUTRITION',
        status: 'COMPLETED',
        priority: 'MEDIUM',
        scheduledAt: time11am,
        completedAt: time11am,
        assignedTo: 'CAREGIVER-01',
        assignedRole: 'CAREGIVER',
      },
      {
        careTaskId: `task-${residentId}-3`,
        carePlanId: `plan-${residentId}`,
        taskCode: 'REHAB_WALK',
        title: 'Hướng dẫn tập đi & Vận động nhẹ phòng 101',
        taskCategory: 'MOBILITY',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        scheduledAt: time2pm,
        assignedTo: 'PHYSIO-01',
        assignedRole: 'PHYSICAL_THERAPIST',
      },
      {
        careTaskId: `task-${residentId}-4`,
        carePlanId: `plan-${residentId}`,
        taskCode: 'HYGIENE_EVENING',
        title: 'Vệ sinh cá nhân & Chuẩn bị ngâm chân thảo dược',
        taskCategory: 'PERSONAL_CARE',
        status: 'PENDING',
        priority: 'LOW',
        scheduledAt: `${todayStr}T17:00:00.000Z`,
        assignedTo: 'CAREGIVER-01',
        assignedRole: 'CAREGIVER',
      },
    ];

    const incidents = [
      {
        incidentId: `inc-${residentId}-1`,
        incidentCode: `INC-2026-08`,
        incidentType: 'SLIP_TRIP_WARNING',
        title: 'Ghi nhận trượt nhẹ tại hành lang tản bộ (đã kiểm tra an toàn)',
        occurredAt: '2026-02-14T09:15:00.000Z',
        discoveredAt: '2026-02-14T09:16:00.000Z',
        location: 'Hành lang Tầng 1',
        status: 'RESOLVED',
        currentSeverity: 'LOW',
        description: 'Cụ trượt sẩy chân nhẹ khi đi lại, điều dưỡng đã hỗ trợ kịp thời, không có chấn thương hay trầy xước.',
        resolutionSummary: 'Đã khám kiểm tra xương khớp & tăng cường tay vịn tại hành lang.',
        assignedTo: 'NURSE-01',
        assignedRole: 'NURSE',
      },
    ];

    return {
      status: 'OK',
      generatedAt: new Date().toISOString(),
      viewMode: 'OPERATIONAL_READ_ONLY',
      resident: residentObj as any,
      carePlan: {
        carePlanId: `plan-${residentId}`,
        title: 'Kế hoạch chăm sóc y tế tổng hợp & Phục hồi chức năng Toàn diện',
        status: 'ACTIVE',
        careLevel: residentObj.careLevel,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        goals: 'Duy trì huyết áp 120-130/80 mmHg, ăn hết suất ăn dinh dưỡng, tập đi 20 phút mỗi ngày.',
        createdBy: 'BS. Nguyễn Văn Vinh',
        approvedBy: 'Giám đốc Y khoa',
      },
      workQueue,
      clinical,
      medication: {
        orders: medicationOrders,
        administrations: medicationAdministrations,
      },
      incidents,
      availability: {
        resident: 'AVAILABLE',
        carePlan: 'AVAILABLE',
        workQueue: 'AVAILABLE',
        clinical: 'AVAILABLE',
        medicationOrders: 'AVAILABLE',
        medicationAdministrations: 'AVAILABLE',
        incidents: 'AVAILABLE',
      },
      freshness: {},
      provenance: {},
      authority: {
        readOnly: true,
        crossDomainMutation: false,
        autonomousClinicalAction: false,
        autonomousMedicationAction: false,
        autonomousIncidentAction: false,
        autonomousCarePlanAction: false,
        autonomousCareTaskAction: false,
      },
      access: {
        actorRole: actor.actorRole,
        scope: 'RESIDENT_SCOPE',
        serverAuthorized: true,
        residentScopeEnforcement: 'CANONICAL_RESIDENT_SCOPE',
        redactionApplied: false,
      },
      limits: {
        perSourceDomain: 50,
      },
    };
  }
}
