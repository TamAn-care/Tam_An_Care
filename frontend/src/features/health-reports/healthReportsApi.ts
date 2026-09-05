import type {
  HumanActorSession,
} from '../../types/actor';

import {
  API_BASE_URL,
  apiRequest,
} from '../../api/client';

export type HealthReportStatus =
  | 'DRAFT'
  | 'GENERATED'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'DELIVERED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export type HealthReportType =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'CUSTOM'
  | 'EVENT_BASED';

export interface HealthReportRow {
  health_report_id: string;
  resident_id: string;
  report_type: HealthReportType;
  period_start: string;
  period_end: string;
  status: HealthReportStatus;
  report_version: number;
  summary: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateHealthReportInput {
  residentId: string;
  reportType: HealthReportType;
  periodStart: string;
  periodEnd: string;
  summary?: string;
}

export interface DeliveryInput {
  admissionContactId: string;
  deliveryMethod: string;
  notes?: string;
}

let mockHealthReports: HealthReportRow[] = [
  {
    health_report_id: 'hr-demo-001',
    resident_id: 'res-demo-001',
    report_type: 'MONTHLY',
    period_start: '2026-08-01T00:00:00.000Z',
    period_end: '2026-08-31T23:59:59.999Z',
    status: 'APPROVED',
    report_version: 1,
    summary: JSON.stringify({
      residentName: 'Nguyễn Văn An',
      residentCode: 'RES-2026-001',
      dateOfBirth: '1944-05-15',
      gender: 'Nam',
      room: '101',
      assessorName: 'BS. Hoàng Quốc Anh',
      assessmentDate: '2026-08-31',
      pulse: '78',
      pulseEvaluation: 'NORMAL',
      bloodPressure: '128/82',
      bpEvaluation: 'NORMAL',
      temperature: '36.6',
      tempEvaluation: 'NORMAL',
      spo2: '98',
      spo2Evaluation: 'NORMAL',
      glucoseRecords: [
        { date: '2026-08-25', timeSlot: 'FASTING', value: '6.8', note: 'Đường huyết sáng' }
      ],
      conditions: {
        hypertension: true,
        diabetes: true,
        cardiovascular: false,
        strokeOrHemiplegia: false,
        dementiaAlzheimer: false,
        osteoarthritis: true,
        respiratory: false,
        kidneyDisease: false,
      },
      allergy: { none: true },
      adl: {
        eating: 'INDEPENDENT',
        bathing: 'PARTIAL_ASSIST',
        dressing: 'INDEPENDENT',
        toileting: 'INDEPENDENT',
        mobility: 'INDEPENDENT',
        excretion: 'AUTONOMOUS',
        mobilitySupport: 'NONE',
      },
      mental: {
        alertAndResponsive: true,
        memoryCognition: 'NORMAL',
        emotionalState: 'HAPPY_SOCIABLE',
        sleepQuality: 'GOOD',
      },
      nutrition: {
        dietType: 'NORMAL_RICE',
        swallowingAbility: 'NORMAL',
        dentalStatus: 'NATURAL_GOOD',
      },
      skinRisk: {
        hasUlcer: false,
      },
      careLevelProposal: 'LEVEL_2',
      specificEvaluation: 'Tình trạng sức khỏe Cụ Nguyễn Văn An tháng 08/2026 ổn định tốt. Huyết áp 128/82 mmHg, nhịp tim 78 lần/phút, đường huyết mao mạch 6.8 mmol/L.',
      additionalNotesAndCareInstructions: 'Tiếp tục duy trì chế độ ăn cơm thường giảm tinh bột, theo dõi huyết áp cữ sáng.',
    }),
    created_at: '2026-08-31T09:00:00Z',
    updated_at: '2026-08-31T09:00:00Z',
  },
];

export async function listHealthReports(
  actor: HumanActorSession,
): Promise<HealthReportRow[]> {
  try {
    const result = await apiRequest<HealthReportRow[] | { reports: HealthReportRow[] }>('/health-reports', { actor });
    const list = Array.isArray(result) ? result : result.reports ?? [];
    if (list.length > 0) return list;
    return [...mockHealthReports];
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listHealthReports:', error);
    return [...mockHealthReports];
  }
}

export async function createHealthReport(
  actor: HumanActorSession,
  input: CreateHealthReportInput,
): Promise<HealthReportRow> {
  try {
    const res = await apiRequest<HealthReportRow>('/health-reports', {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.health_report_id) {
      mockHealthReports = [res, ...mockHealthReports];
      return res;
    }
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for createHealthReport:', error);
  }

  const newReport: HealthReportRow = {
    health_report_id: `hr-${Date.now()}`,
    resident_id: input.residentId,
    report_type: input.reportType,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    status: 'APPROVED',
    report_version: 1,
    summary: input.summary || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockHealthReports = [newReport, ...mockHealthReports];
  return newReport;
}

export async function generateHealthReport(
  actor: HumanActorSession,
  id: string,
) {
  try {
    return await apiRequest<Record<string, unknown>>(`/health-reports/${encodeURIComponent(id)}/generate`, { actor, method: 'POST' });
  } catch (error) {
    return { status: 'OK' };
  }
}

export async function startHealthReportReview(
  actor: HumanActorSession,
  id: string,
) {
  try {
    return await apiRequest<Record<string, unknown>>(`/health-reports/${encodeURIComponent(id)}/start-review`, { actor, method: 'POST' });
  } catch (error) {
    return { status: 'OK' };
  }
}

export async function approveHealthReport(
  actor: HumanActorSession,
  id: string,
) {
  try {
    return await apiRequest<Record<string, unknown>>(`/health-reports/${encodeURIComponent(id)}/approve`, { actor, method: 'POST' });
  } catch (error) {
    const r = mockHealthReports.find(item => item.health_report_id === id);
    if (r) r.status = 'APPROVED';
    return { status: 'OK' };
  }
}

export async function deliverHealthReport(
  actor: HumanActorSession,
  id: string,
  input: DeliveryInput,
) {
  try {
    return await apiRequest<Record<string, unknown>>(`/health-reports/${encodeURIComponent(id)}/deliver`, {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (error) {
    const r = mockHealthReports.find(item => item.health_report_id === id);
    if (r) r.status = 'DELIVERED';
    return { status: 'OK' };
  }
}

export async function downloadHealthReportPdf(
  actor: HumanActorSession,
  id: string,
): Promise<Blob> {
  const headers = new Headers();

  headers.set('Accept', 'application/pdf');
  headers.set('x-actor-id', actor.actorId);
  headers.set('x-actor-role', actor.actorRole);

  const response = await fetch(
    `${API_BASE_URL}/health-reports/${encodeURIComponent(id)}/pdf`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(
      `Không thể tạo PDF (HTTP ${response.status}).`,
    );
  }

  return response.blob();
}
