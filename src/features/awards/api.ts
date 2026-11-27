import { API_BASE_PATH } from '@shared/constants/api';
import type {
  AdminAwardItem,
  AwardTemplateOption,
  BulkImportAwardsInput,
  CreateManualAwardInput,
  ImportAwardsFromParticipantsInput,
} from '@shared/schemas/awards';
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

export async function fetchAwardTemplateOptions(): Promise<AwardTemplateOption[]> {
  const res = await req<AwardTemplateOption[]>('/admin/awards/templates');
  return res.data;
}

export async function fetchAdminAwards(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ items: AdminAwardItem[]; meta: { page: number; limit: number; total: number } }> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) qs.set('status', params.status);

  const res = await req<AdminAwardItem[]>(`/admin/awards?${qs.toString()}`);
  return {
    items: res.data,
    meta: res.meta ?? { page: params.page, limit: params.limit, total: res.data.length },
  };
}

export async function createManualAwardApi(
  input: CreateManualAwardInput,
): Promise<{ documentId: string; documentNumber: string; jobId: string }> {
  const res = await req<{ documentId: string; documentNumber: string; jobId: string }>(
    '/admin/awards',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function bulkImportAwardsApi(
  input: BulkImportAwardsInput,
): Promise<{ issuedCount: number; jobIds: string[] }> {
  const res = await req<{ issuedCount: number; jobIds: string[] }>('/admin/awards/bulk-import', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function importAwardsFromParticipantsApi(
  input: ImportAwardsFromParticipantsInput,
): Promise<{ issuedCount: number; skippedCount: number; jobIds: string[] }> {
  const res = await req<{ issuedCount: number; skippedCount: number; jobIds: string[] }>(
    '/admin/awards/import-participants',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}
