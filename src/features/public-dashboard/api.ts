import { API_BASE_PATH } from '@shared/constants/api';
import type {
  AddWhitelistInput,
  AdminParticipantItem,
  AdminWhitelistItem,
  PublicDashboardStats,
  PublicEventCard,
  PublicEventFormResponse,
  PublicRegisterRequest,
  PublicRegisterResponse,
} from '@shared/schemas/public';
import type { PublicVerificationResult, RecoveredDocumentItem } from '@shared/schemas/recovery';
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

export async function fetchPublicDashboard(
  month: number,
  year: number,
): Promise<PublicDashboardStats> {
  const res = await req<PublicDashboardStats>(`/public/dashboard?month=${month}&year=${year}`);
  return res.data;
}

export async function fetchPublicEvents(params: {
  month: number;
  year: number;
  search?: string;
  categoryId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: PublicEventCard[]; meta: { page: number; limit: number; total: number } }> {
  const qs = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 12),
  });
  if (params.search) qs.set('search', params.search);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.status) qs.set('status', params.status);

  const res = await req<PublicEventCard[]>(`/public/events?${qs.toString()}`);
  return {
    items: res.data,
    meta: res.meta ?? { page: 1, limit: 12, total: res.data.length },
  };
}

export async function fetchPublicEventDetail(slug: string): Promise<PublicEventCard> {
  const res = await req<PublicEventCard>(`/public/events/${encodeURIComponent(slug)}`);
  return res.data;
}

export async function fetchPublicEventForm(slug: string): Promise<PublicEventFormResponse> {
  const res = await req<PublicEventFormResponse>(`/public/events/${encodeURIComponent(slug)}/form`);
  return res.data;
}

export async function verifyRecoveryApi(input: {
  slug: string;
  searchKey: string;
  method: 'recovery_code' | 'email_otp';
  code: string;
  turnstileToken?: string;
}): Promise<{ documents: RecoveredDocumentItem[]; grantExpiresInSeconds: number }> {
  const res = await req<{ documents: RecoveredDocumentItem[]; grantExpiresInSeconds: number }>(
    '/public/recovery/verify',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function resendOtpApi(input: {
  slug: string;
  searchKey: string;
  turnstileToken?: string;
}): Promise<{ message: string }> {
  const res = await req<{ message: string }>('/public/recovery/resend', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function fetchPublicVerification(
  verificationCode: string,
): Promise<PublicVerificationResult> {
  const res = await req<PublicVerificationResult>(
    `/public/verify/${encodeURIComponent(verificationCode)}`,
  );
  return res.data;
}

export async function registerPublicParticipantApi(
  slug: string,
  input: PublicRegisterRequest,
): Promise<PublicRegisterResponse> {
  const res = await req<PublicRegisterResponse>(
    `/public/events/${encodeURIComponent(slug)}/register`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function fetchAdminParticipants(params: {
  eventId: string;
  status?: string;
  page: number;
  limit: number;
}): Promise<{
  items: AdminParticipantItem[];
  meta: { page: number; limit: number; total: number };
}> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) qs.set('status', params.status);

  const res = await req<AdminParticipantItem[]>(
    `/admin/events/${params.eventId}/participants?${qs.toString()}`,
  );
  return {
    items: res.data,
    meta: res.meta ?? { page: params.page, limit: params.limit, total: res.data.length },
  };
}

export async function updateAdminParticipantAction(
  participantId: string,
  action: 'approve' | 'reject' | 'cancel',
): Promise<void> {
  await req(`/admin/participants/${participantId}/${action}`, { method: 'POST' });
}

export async function fetchAdminWhitelist(eventId: string): Promise<AdminWhitelistItem[]> {
  const res = await req<AdminWhitelistItem[]>(`/admin/events/${eventId}/whitelist`);
  return res.data;
}

export async function addAdminWhitelist(
  eventId: string,
  input: AddWhitelistInput,
): Promise<{ addedCount: number }> {
  const res = await req<{ addedCount: number }>(`/admin/events/${eventId}/whitelist`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}
