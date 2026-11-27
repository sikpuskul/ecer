import { API_BASE_PATH } from '@shared/constants/api';
import type {
  AdminReportOverview,
  RetentionCleanupResult,
  RetentionDryRunSummary,
} from '@shared/schemas/reports';
import { ApiClientError } from '@/lib/api-client';

interface Envelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

async function req<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
  const response = await fetch(`${API_BASE_PATH}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as Envelope<T> | ErrorEnvelope | null;
  if (!response.ok || !payload || !payload.success) {
    const code = payload && !payload.success ? payload.error.code : 'HTTP_ERROR';
    const message =
      payload && !payload.success
        ? payload.error.message
        : `Permintaan gagal dengan status ${response.status}.`;
    throw new ApiClientError(message, response.status, code);
  }
  return payload;
}

export async function fetchReportOverview(year: number): Promise<AdminReportOverview> {
  const res = await req<AdminReportOverview>(`/admin/reports/overview?year=${year}`);
  return res.data;
}

export async function fetchRetentionDryRun(): Promise<RetentionDryRunSummary> {
  const res = await req<RetentionDryRunSummary>('/admin/reports/retention/dry-run');
  return res.data;
}

export async function runRetentionCleanupApi(): Promise<RetentionCleanupResult> {
  const res = await req<RetentionCleanupResult>('/admin/reports/retention/cleanup', {
    method: 'POST',
  });
  return res.data;
}
