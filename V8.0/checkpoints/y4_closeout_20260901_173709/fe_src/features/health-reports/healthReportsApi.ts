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

export function listHealthReports(
  actor: HumanActorSession,
) {
  return apiRequest<
    HealthReportRow[] |
    { reports: HealthReportRow[] }
  >(
    '/health-reports',
    { actor },
  ).then((result) =>
    Array.isArray(result)
      ? result
      : result.reports ?? [],
  );
}

export function createHealthReport(
  actor: HumanActorSession,
  input: CreateHealthReportInput,
) {
  return apiRequest<HealthReportRow>(
    '/health-reports',
    {
      actor,
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function generateHealthReport(
  actor: HumanActorSession,
  id: string,
) {
  return apiRequest<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(id)}/generate`,
    {
      actor,
      method: 'POST',
    },
  );
}

export function startHealthReportReview(
  actor: HumanActorSession,
  id: string,
) {
  return apiRequest<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(id)}/start-review`,
    {
      actor,
      method: 'POST',
    },
  );
}

export function approveHealthReport(
  actor: HumanActorSession,
  id: string,
) {
  return apiRequest<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(id)}/approve`,
    {
      actor,
      method: 'POST',
    },
  );
}

export function deliverHealthReport(
  actor: HumanActorSession,
  id: string,
  input: DeliveryInput,
) {
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
