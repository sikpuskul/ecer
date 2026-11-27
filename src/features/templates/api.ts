import { API_BASE_PATH } from '@shared/constants/api';
import type { FormField, FormVersionItem } from '@shared/schemas/forms';
import type {
  ImportTemplateInput,
  TemplateItem,
  TemplateVersionItem,
  UpdateTemplateInput,
} from '@shared/schemas/templates';
import { ApiClientError } from '@/lib/api-client';

interface Envelope<T> {
  success: true;
  data: T;
  requestId: string;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  return payload.data;
}

export function fetchAdminTemplates(): Promise<TemplateItem[]> {
  return req<TemplateItem[]>('/admin/templates');
}

export function importAdminTemplate(input: ImportTemplateInput): Promise<{
  template: TemplateItem;
  versions: TemplateVersionItem[];
  warnings: string[];
}> {
  return req('/admin/templates/import', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAdminTemplateDetail(id: string): Promise<{
  template: TemplateItem;
  versions: TemplateVersionItem[];
}> {
  return req(`/admin/templates/${id}`);
}

export function updateAdminTemplate(
  id: string,
  input: UpdateTemplateInput,
): Promise<{ template: TemplateItem; versions: TemplateVersionItem[] }> {
  return req(`/admin/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteAdminTemplate(id: string): Promise<{ deleted: boolean }> {
  return req(`/admin/templates/${id}`, { method: 'DELETE' });
}

export function refreshAdminTemplate(id: string): Promise<{
  template: TemplateItem;
  versions: TemplateVersionItem[];
  warnings: string[];
}> {
  return req(`/admin/templates/${id}/refresh`, { method: 'POST' });
}

export function validateAdminTemplate(id: string): Promise<{
  template: TemplateItem;
  versions: TemplateVersionItem[];
}> {
  return req(`/admin/templates/${id}/validate`, { method: 'POST' });
}

export function testGenerateAdminTemplate(id: string): Promise<{
  filename: string;
  fileSize: number;
  mimeType: string;
  isPreview: boolean;
}> {
  return req(`/admin/templates/${id}/test-generate`, { method: 'POST' });
}

export function fetchEventForm(eventId: string): Promise<{
  eventId: string;
  eventTitle: string;
  draft: FormVersionItem | null;
  published: FormVersionItem | null;
  versions: FormVersionItem[];
}> {
  return req(`/admin/events/${eventId}/form`);
}

export function saveEventFormDraft(eventId: string, fields: FormField[]): Promise<FormVersionItem> {
  return req(`/admin/events/${eventId}/form`, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
  });
}

export function publishEventForm(eventId: string): Promise<FormVersionItem> {
  return req(`/admin/events/${eventId}/form/publish`, { method: 'POST' });
}

export interface EventTemplateLinkItem {
  id: string;
  eventId: string;
  templateVersionId: string;
  numberingRuleId: string;
  categoryName: string;
  sortOrder: number;
  isActive: boolean;
}

export function fetchEventTemplateLinks(eventId: string): Promise<EventTemplateLinkItem[]> {
  return req(`/admin/events/${eventId}/templates`);
}

export function saveEventTemplateLinks(
  eventId: string,
  templates: Array<{
    templateVersionId: string;
    numberingRuleId?: string;
    categoryName: string;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<EventTemplateLinkItem[]> {
  return req(`/admin/events/${eventId}/templates`, {
    method: 'PUT',
    body: JSON.stringify({ templates }),
  });
}
