import { API_BASE_PATH } from '@shared/constants/api';
import type {
  AdminDashboardSummary,
  AdminUserItem,
  AuditLogItem,
  CreateAdminUserInput,
  CreateCategoryInput,
  EventCategoryItem,
  SettingKey,
  UpdateAdminUserInput,
  UpdateCategoryInput,
} from '@shared/schemas/admin';
import type { AdminProfile, LoginRequest } from '@shared/schemas/auth';
import { HealthResponseSchema, type HealthResponse } from '@shared/schemas/health';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
  requestId: string;
}

interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiSuccessEnvelope<T>> {
  const response = await fetch(`${API_BASE_PATH}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    ApiSuccessEnvelope<T> | ApiErrorEnvelope | null;

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

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_PATH}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Layanan backend mengembalikan status ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const parsed = HealthResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Format respons health check tidak sesuai kontrak API.');
  }
  return parsed.data;
}

export interface PublicRuntimeConfig {
  appName: string;
  organizationName: string;
  timezone: string;
  turnstileSiteKey: string | null;
}

export async function fetchPublicConfig(): Promise<PublicRuntimeConfig> {
  const res = await apiRequest<PublicRuntimeConfig>('/public/config');
  return res.data;
}

export async function loginAdminApi(input: LoginRequest): Promise<AdminProfile> {
  const res = await apiRequest<{ admin: AdminProfile }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data.admin;
}

export async function logoutAdminApi(): Promise<void> {
  await apiRequest<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' });
}

export async function fetchCurrentAdmin(): Promise<AdminProfile> {
  const res = await apiRequest<{ admin: AdminProfile }>('/auth/me');
  return res.data.admin;
}

export async function fetchAdminDashboard(): Promise<{
  summary: AdminDashboardSummary;
  recentActivities: AuditLogItem[];
}> {
  const res = await apiRequest<{
    summary: AdminDashboardSummary;
    recentActivities: AuditLogItem[];
  }>('/admin/dashboard');
  return res.data;
}

export async function fetchAdminUsers(): Promise<AdminUserItem[]> {
  const res = await apiRequest<AdminUserItem[]>('/admin/users');
  return res.data;
}

export async function createAdminUserApi(input: CreateAdminUserInput): Promise<AdminUserItem> {
  const res = await apiRequest<AdminUserItem>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateAdminUserApi(
  id: string,
  input: UpdateAdminUserInput,
): Promise<AdminUserItem> {
  const res = await apiRequest<AdminUserItem>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function resetAdminPasswordApi(id: string, newPassword: string): Promise<void> {
  await apiRequest<{ passwordReset: boolean }>(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

export async function fetchAdminSettings(): Promise<Record<SettingKey, string>> {
  const res = await apiRequest<Record<SettingKey, string>>('/admin/settings');
  return res.data;
}

export async function updateAdminSettingsApi(
  settings: Partial<Record<SettingKey, string>>,
): Promise<Record<SettingKey, string>> {
  const res = await apiRequest<Record<SettingKey, string>>('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
  });
  return res.data;
}

export async function fetchAdminCategories(): Promise<EventCategoryItem[]> {
  const res = await apiRequest<EventCategoryItem[]>('/admin/categories');
  return res.data;
}

export async function createAdminCategoryApi(
  input: CreateCategoryInput,
): Promise<EventCategoryItem> {
  const res = await apiRequest<EventCategoryItem>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateAdminCategoryApi(
  id: string,
  input: UpdateCategoryInput,
): Promise<EventCategoryItem> {
  const res = await apiRequest<EventCategoryItem>(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function fetchAuditLogs(params: {
  page: number;
  limit: number;
  entityType?: string;
}): Promise<{
  items: AuditLogItem[];
  meta: { page: number; limit: number; total: number };
}> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.entityType) {
    qs.set('entityType', params.entityType);
  }
  const res = await apiRequest<AuditLogItem[]>(`/admin/audit-logs?${qs.toString()}`);
  return {
    items: res.data,
    meta: res.meta ?? { page: params.page, limit: params.limit, total: res.data.length },
  };
}
