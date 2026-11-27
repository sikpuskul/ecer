import { API_BASE_PATH } from '@shared/constants/api';
import type { AdminEventItem, CreateEventInput, UpdateEventInput } from '@shared/schemas/events';
import { ApiClientError } from '@/lib/api-client';

interface Envelope<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number };
  requestId: string;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

async function eventRequest<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_PATH}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
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

export async function fetchAdminEvents(params: {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  status?: string;
}): Promise<{ items: AdminEventItem[]; meta: { page: number; limit: number; total: number } }> {
  const qs = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.search) qs.set('search', params.search);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.status) qs.set('status', params.status);

  const res = await eventRequest<AdminEventItem[]>(`/admin/events?${qs.toString()}`);
  return {
    items: res.data,
    meta: res.meta ?? { page: params.page, limit: params.limit, total: res.data.length },
  };
}

export async function fetchAdminEvent(id: string): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>(`/admin/events/${id}`);
  return res.data;
}

export async function createAdminEvent(input: CreateEventInput): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>('/admin/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateAdminEvent(
  id: string,
  input: UpdateEventInput,
): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>(`/admin/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteAdminEvent(id: string): Promise<void> {
  await eventRequest<{ deleted: boolean }>(`/admin/events/${id}`, { method: 'DELETE' });
}

export async function publishAdminEvent(id: string): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>(`/admin/events/${id}/publish`, { method: 'POST' });
  return res.data;
}

export async function closeAdminEvent(id: string): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>(`/admin/events/${id}/close`, { method: 'POST' });
  return res.data;
}

export async function reopenAdminEvent(id: string): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>(`/admin/events/${id}/reopen`, { method: 'POST' });
  return res.data;
}

export async function archiveAdminEvent(id: string): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>(`/admin/events/${id}/archive`, { method: 'POST' });
  return res.data;
}

export async function duplicateAdminEvent(id: string): Promise<AdminEventItem> {
  const res = await eventRequest<AdminEventItem>(`/admin/events/${id}/duplicate`, {
    method: 'POST',
  });
  return res.data;
}

export async function uploadEventFlyer(
  file: File,
  eventId?: string,
): Promise<{ flyerKey: string; flyerUrl: string; mimeType: string; sizeBytes: number }> {
  const form = new FormData();
  form.append('file', file);
  if (eventId) form.append('eventId', eventId);

  const res = await eventRequest<{
    flyerKey: string;
    flyerUrl: string;
    mimeType: string;
    sizeBytes: number;
  }>('/admin/storage/flyer', {
    method: 'POST',
    body: form,
  });
  return res.data;
}
