import { API_BASE_PATH } from '@shared/constants/api';
import type { EmailJobItem, EmailJobsSummary } from '@shared/schemas/email';
import { ApiClientError } from '@/lib/api-client';

interface Envelope<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number };
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

export async function fetchEmailJobsSummary(): Promise<EmailJobsSummary> {
  const res = await req<EmailJobsSummary>('/admin/jobs/email/summary');
  return res.data;
}

export async function fetchEmailJobs(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ items: EmailJobItem[]; meta: { page: number; limit: number; total: number } }> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) qs.set('status', params.status);

  const res = await req<EmailJobItem[]>(`/admin/jobs/email?${qs.toString()}`);
  return {
    items: res.data,
    meta: res.meta ?? { page: params.page, limit: params.limit, total: res.data.length },
  };
}

export async function retryEmailJobApi(jobId: string): Promise<void> {
  await req(`/admin/jobs/email/${encodeURIComponent(jobId)}/retry`, { method: 'POST' });
}

export async function cancelEmailJobApi(jobId: string): Promise<void> {
  await req(`/admin/jobs/email/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
}

export async function resendDocumentEmailApi(documentId: string): Promise<{ jobId: string }> {
  const res = await req<{ jobId: string }>(
    `/admin/documents/${encodeURIComponent(documentId)}/resend-email`,
    { method: 'POST' },
  );
  return res.data;
}
