import { API_BASE_PATH } from '@shared/constants/api';
import type { AdminDocumentItem, GenerationJobItem } from '@shared/schemas/documents';
import type {
  CreateNumberingRuleInput,
  NumberingRuleItem,
  PreviewNumberingInput,
} from '@shared/schemas/numbering';
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
    throw new ApiClientError(
      payload && !payload.success
        ? payload.error.message
        : `Permintaan gagal (${response.status}).`,
      response.status,
      payload && !payload.success ? payload.error.code : 'HTTP_ERROR',
    );
  }
  return payload;
}

export async function fetchNumberingRules(): Promise<NumberingRuleItem[]> {
  return (await req<NumberingRuleItem[]>('/admin/numbering')).data;
}

export async function createNumberingRule(
  input: CreateNumberingRuleInput,
): Promise<NumberingRuleItem> {
  return (
    await req<NumberingRuleItem>('/admin/numbering', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).data;
}

export async function updateNumberingRule(
  id: string,
  input: Partial<CreateNumberingRuleInput> & { isActive?: boolean },
): Promise<NumberingRuleItem> {
  return (
    await req<NumberingRuleItem>(`/admin/numbering/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  ).data;
}

export async function deleteNumberingRule(id: string): Promise<void> {
  await req(`/admin/numbering/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function previewNumberingRule(input: PreviewNumberingInput): Promise<string> {
  const res = await req<{ preview: string }>('/admin/numbering/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data.preview;
}

export async function fetchAdminDocuments(params: {
  page: number;
  limit: number;
  documentType?: string;
  status?: string;
}): Promise<{ items: AdminDocumentItem[]; meta: { page: number; limit: number; total: number } }> {
  const qs = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.documentType) qs.set('documentType', params.documentType);
  if (params.status) qs.set('status', params.status);
  const res = await req<AdminDocumentItem[]>(`/admin/documents?${qs.toString()}`);
  return {
    items: res.data,
    meta: res.meta ?? { page: params.page, limit: params.limit, total: res.data.length },
  };
}

export async function regenerateDocumentApi(id: string): Promise<void> {
  await req(`/admin/documents/${id}/regenerate`, { method: 'POST' });
}

export async function revokeDocumentApi(id: string, reason: string): Promise<void> {
  await req(`/admin/documents/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function fetchGenerationJobs(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ items: GenerationJobItem[]; meta: { page: number; limit: number; total: number } }> {
  const qs = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.status) qs.set('status', params.status);
  const res = await req<GenerationJobItem[]>(`/admin/jobs/generation?${qs.toString()}`);
  return {
    items: res.data,
    meta: res.meta ?? { page: params.page, limit: params.limit, total: res.data.length },
  };
}

export async function retryGenerationJobApi(id: string): Promise<void> {
  await req(`/admin/jobs/generation/${id}/retry`, { method: 'POST' });
}

export async function cancelGenerationJobApi(id: string): Promise<void> {
  await req(`/admin/jobs/generation/${id}/cancel`, { method: 'POST' });
}
