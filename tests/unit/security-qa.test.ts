import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@shared/constants/api';
import { createApp } from '@worker/app';

describe('Phase 11 — Security & QA Hardening Matrix', () => {
  const app = createApp();

  const PROTECTED_ADMIN_GET_ENDPOINTS = [
    '/api/v1/admin/dashboard',
    '/api/v1/admin/events',
    '/api/v1/admin/templates',
    '/api/v1/admin/numbering',
    '/api/v1/admin/documents',
    '/api/v1/admin/jobs/summary',
    '/api/v1/admin/jobs/generation',
    '/api/v1/admin/jobs/email/summary',
    '/api/v1/admin/jobs/email',
    '/api/v1/admin/awards',
    '/api/v1/admin/awards/templates',
    '/api/v1/admin/reports/overview?year=2026',
    '/api/v1/admin/reports/retention/dry-run',
    '/api/v1/admin/users',
    '/api/v1/admin/settings',
    '/api/v1/admin/audit-logs',
  ];

  it('blocks unauthenticated access to every protected admin endpoint with 401 UNAUTHORIZED', async () => {
    for (const path of PROTECTED_ADMIN_GET_ENDPOINTS) {
      const res = await app.request(
        `http://localhost${path}`,
        { method: 'GET' },
        { APP_ENV: 'test' },
      );
      expect(res.status, `Expected 401 for ${path}`).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    }
  });

  it('sets strict baseline security headers including HSTS over HTTPS', async () => {
    const res = await app.request(
      'https://ecer.siksumakul.workers.dev/api/v1/health',
      { method: 'GET' },
      { APP_ENV: 'production' },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });

  it('enforces CSRF Origin rejection on state-changing auth logout with foreign Origin', async () => {
    const res = await app.request(
      'https://ecer.siksumakul.workers.dev/api/v1/auth/logout',
      {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example.com',
        },
      },
      { APP_ENV: 'production' },
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });
});
