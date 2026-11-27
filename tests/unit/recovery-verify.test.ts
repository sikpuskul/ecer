import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@shared/constants/api';
import { maskRecipientName } from '@shared/utils/masking';
import { createApp } from '@worker/app';

describe('Phase 7 — Masking, Recovery Security & Public Verification', () => {
  const app = createApp();

  it('masks multi-word recipient names while preserving initials and short titles', () => {
    expect(maskRecipientName('Siti Aminah')).toBe('Si** Am****');
    expect(maskRecipientName('dr. Budi Santoso')).toBe('dr. Bu** Sa*****');
    expect(maskRecipientName('A')).toBe('A*');
    expect(maskRecipientName('Al')).toBe('A*');
    expect(maskRecipientName('   ')).toBe('***');
  });

  it('blocks unauthenticated public PDF download and preview without grant cookie (AC-15)', async () => {
    const dlRes = await app.request(
      'http://localhost/api/v1/public/documents/doc-public-123/download',
      { method: 'GET' },
      { APP_ENV: 'test' },
    );
    expect(dlRes.status).toBe(401);
    const dlBody = (await dlRes.json()) as { success: boolean; error: { code: string } };
    expect(dlBody.success).toBe(false);
    expect(dlBody.error.code).toBe(ERROR_CODES.UNAUTHORIZED);

    const pvRes = await app.request(
      'http://localhost/api/v1/public/documents/doc-public-123/preview',
      { method: 'GET' },
      { APP_ENV: 'test' },
    );
    expect(pvRes.status).toBe(401);
  });

  it('returns NOT_FOUND with X-Robots-Tag noindex, nofollow for invalid short verification code', async () => {
    const res = await app.request(
      'http://localhost/api/v1/public/verify/short',
      { method: 'GET' },
      { APP_ENV: 'test' },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const body = (await res.json()) as {
      success: boolean;
      data: { state: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.state).toBe('NOT_FOUND');
  });

  it('returns generic anti-enumeration message on public search endpoint', async () => {
    const res = await app.request(
      'http://localhost/api/v1/public/events/kegiatan-uji/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchKey: '3507010101900001' }),
      },
      { APP_ENV: 'test' },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { message: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('kode pemulihan');
  });
});
