import { API_BASE_PATH } from '@shared/constants/api';
import { HealthResponseSchema, type HealthResponse } from '@shared/schemas/health';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_PATH}/health`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
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
