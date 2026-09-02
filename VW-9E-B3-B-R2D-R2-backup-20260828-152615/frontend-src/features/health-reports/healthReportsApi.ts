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

export interface HealthReportActor {
  actorId: string;
  actorRole: string;
}

export interface CreateHealthReportInput {
  residentId: string;
  reportType: HealthReportType;
  periodStart: string;
  periodEnd: string;
  summary?: string;
}

function apiBase(): string {
  const raw =
    import.meta.env.VITE_API_BASE_URL ??
    '';

  return raw.replace(/\/+$/, '');
}

function headers(
  actor: HealthReportActor,
  json = false,
): HeadersInit {
  const result: Record<string, string> = {
    Accept: 'application/json',
    'x-actor-id': actor.actorId,
    'x-actor-role': actor.actorRole,
  };

  if (json) {
    result['Content-Type'] =
      'application/json';
  }

  return result;
}

async function request<T>(
  path: string,
  actor: HealthReportActor,
  init: RequestInit = {},
): Promise<T> {
  const response =
    await fetch(
      `${apiBase()}${path}`,
      {
        ...init,
        headers: {
          ...headers(
            actor,
            init.body !== undefined,
          ),
          ...(init.headers ?? {}),
        },
      },
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      text ||
      `HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function listHealthReports(
  actor: HealthReportActor,
): Promise<HealthReportRow[]> {
  const result =
    await request<
      HealthReportRow[] |
      { reports: HealthReportRow[] }
    >(
      '/health-reports',
      actor,
    );

  return Array.isArray(result)
    ? result
    : result.reports ?? [];
}

export function createHealthReport(
  actor: HealthReportActor,
  input: CreateHealthReportInput,
) {
  return request<HealthReportRow>(
    '/health-reports',
    actor,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function generateHealthReport(
  actor: HealthReportActor,
  id: string,
) {
  return request<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(
      id,
    )}/generate`,
    actor,
    {
      method: 'POST',
    },
  );
}

export function startHealthReportReview(
  actor: HealthReportActor,
  id: string,
) {
  return request<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(
      id,
    )}/start-review`,
    actor,
    {
      method: 'POST',
    },
  );
}

export function approveHealthReport(
  actor: HealthReportActor,
  id: string,
) {
  return request<Record<string, unknown>>(
    `/health-reports/${encodeURIComponent(
      id,
    )}/approve`,
    actor,
    {
      method: 'POST',
    },
  );
}

export async function downloadHealthReportPdf(
  actor: HealthReportActor,
  id: string,
): Promise<Blob> {
  const response =
    await fetch(
      `${apiBase()}/health-reports/${encodeURIComponent(
        id,
      )}/pdf`,
      {
        headers: {
          ...headers(actor),
          Accept:
            'application/pdf',
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `Không thể tạo PDF (HTTP ${response.status}).`,
    );
  }

  return response.blob();
}
