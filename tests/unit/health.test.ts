import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@shared/constants/api';
import { ApiErrorBodySchema, HealthResponseSchema } from '@shared/schemas/health';
import { createApp } from '@worker/app';

describe('Phase 0 Foundation — Health Check & API Contract', () => {
  const app = createApp();

  it('returns 200 with valid health envelope and baseline security headers', async () => {
    const res = await app.request(
      'http://localhost/api/v1/health',
      { method: 'GET' },
      {
        APP_ENV: 'test',
        APP_TIMEZONE: 'Asia/Jakarta',
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const json: unknown = await res.json();
    const parsed = HealthResponseSchema.safeParse(json);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.status).toBe('ok');
      expect(parsed.data.data.service).toBe('ecer-api');
      expect(parsed.data.data.environment).toBe('test');
      expect(parsed.data.data.timezone).toBe('Asia/Jakarta');
      expect(parsed.data.requestId).toBe(res.headers.get('X-Request-Id'));
    }
  });

  it('returns standard JSON 404 for unknown /api/* routes instead of HTML fallback', async () => {
    const res = await app.request('http://localhost/api/v1/tidak-ada', { method: 'GET' }, {});

    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('application/json');

    const json: unknown = await res.json();
    const parsed = ApiErrorBodySchema.safeParse(json);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe(ERROR_CODES.NOT_FOUND);
    }
  });

  it('rejects malformed health payloads in shared Zod schema', () => {
    const invalid = HealthResponseSchema.safeParse({
      success: true,
      data: {
        status: 'degraded',
      },
    });

    expect(invalid.success).toBe(false);
  });
});
