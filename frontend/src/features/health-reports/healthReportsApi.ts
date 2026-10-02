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

  // Retained temporarily for source compatibility.
  // Backend state transitions are authoritative.
  initialStatus?: HealthReportStatus;
}

export interface DeliveryInput {
  admissionContactId: string;
  deliveryMethod: string;
  notes?: string;
}

async function getHealthReport(
  actor: HumanActorSession,
  id: string,
): Promise<HealthReportRow> {
  return apiRequest<HealthReportRow>(
    `/health-reports/${encodeURIComponent(id)}`,
    { actor },
  );
}

export async function listHealthReports(
  actor: HumanActorSession,
  residentId?: string,
): Promise<HealthReportRow[]> {
  const query =
    residentId
      ? `?residentId=${encodeURIComponent(
          residentId,
        )}`
      : '';

  const result =
    await apiRequest<
      HealthReportRow[] | {
        reports: HealthReportRow[];
      }
    >(
      `/health-reports${query}`,
      { actor },
    );

  return Array.isArray(result)
    ? result
    : result.reports ?? [];
}

export async function createHealthReport(
  actor: HumanActorSession,
  input: CreateHealthReportInput,
): Promise<HealthReportRow> {
  const {
    initialStatus: _ignoredInitialStatus,
    ...serverInput
  } = input;

  void _ignoredInitialStatus;

  return apiRequest<HealthReportRow>(
    '/health-reports',
    {
      actor,
      method: 'POST',
      body: JSON.stringify(serverInput),
    },
  );
}

export async function updateHealthReport(
  actor: HumanActorSession,
  id: string,
  summaryData: string,
  status?: HealthReportStatus,
): Promise<HealthReportRow> {
  // State transitions are intentionally NOT controlled by PUT.
  // Kept only for call-site compatibility during B1 migration.
  void status;

  return apiRequest<HealthReportRow>(
    `/health-reports/${encodeURIComponent(id)}`,
    {
      actor,
      method: 'PUT',
      body: JSON.stringify({
        summary: summaryData,
      }),
    },
  );
}

export async function generateHealthReport(
  actor: HumanActorSession,
  id: string,
): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(id)}/generate`,
    {
      actor,
      method: 'POST',
    },
  );
}

export async function startHealthReportReview(
  actor: HumanActorSession,
  id: string,
): Promise<HealthReportRow> {
  let report =
    await getHealthReport(actor, id);

  if (
    report.status === 'DRAFT' ||
    report.status === 'REVISION_REQUIRED'
  ) {
    await generateHealthReport(
      actor,
      id,
    );

    report =
      await getHealthReport(
        actor,
        id,
      );
  }

  if (report.status === 'GENERATED') {
    return apiRequest<HealthReportRow>(
      `/health-reports/${encodeURIComponent(id)}/start-review`,
      {
        actor,
        method: 'POST',
      },
    );
  }

  if (report.status === 'UNDER_REVIEW') {
    return report;
  }

  throw new Error(
    `Không thể trình duyệt báo cáo ở trạng thái ${report.status}.`,
  );
}

export async function submitHealthReportForReview(
  actor: HumanActorSession,
  id: string,
  summaryData?: string,
): Promise<HealthReportRow> {
  if (summaryData !== undefined) {
    await updateHealthReport(
      actor,
      id,
      summaryData,
    );
  }

  return startHealthReportReview(
    actor,
    id,
  );
}

export async function approveHealthReport(
  actor: HumanActorSession,
  id: string,
  updatedSummaryData?: string,
): Promise<HealthReportRow> {
  if (updatedSummaryData !== undefined) {
    await updateHealthReport(
      actor,
      id,
      updatedSummaryData,
    );
  }

  let report =
    await getHealthReport(
      actor,
      id,
    );

  if (
    report.status === 'DRAFT' ||
    report.status === 'REVISION_REQUIRED'
  ) {
    await generateHealthReport(
      actor,
      id,
    );

    report =
      await getHealthReport(
        actor,
        id,
      );
  }

  if (report.status === 'GENERATED') {
    report =
      await apiRequest<HealthReportRow>(
        `/health-reports/${encodeURIComponent(id)}/start-review`,
        {
          actor,
          method: 'POST',
        },
      );
  }

  if (report.status === 'UNDER_REVIEW') {
    return apiRequest<HealthReportRow>(
      `/health-reports/${encodeURIComponent(id)}/approve`,
      {
        actor,
        method: 'POST',
      },
    );
  }

  if (report.status === 'APPROVED') {
    return report;
  }

  throw new Error(
    `Không thể phê duyệt báo cáo ở trạng thái ${report.status}.`,
  );
}

export async function deliverHealthReport(
  actor: HumanActorSession,
  id: string,
  input: DeliveryInput,
): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(id)}/deliver`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function downloadHealthReportPdf(
  actor: HumanActorSession,
  id: string,
): Promise<Blob> {
  const headers = new Headers();

  headers.set(
    'Accept',
    'application/pdf',
  );
  headers.set(
    'x-actor-id',
    actor.actorId,
  );
  headers.set(
    'x-actor-role',
    actor.actorRole,
  );

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
