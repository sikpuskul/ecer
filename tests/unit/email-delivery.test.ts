import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@shared/constants/api';
import {
  computeNextJakartaQuotaResetIso,
  maskEmailAddress,
  renderEmailTemplate,
  sanitizeEmailSubject,
} from '@shared/utils/email-template';
import { createApp } from '@worker/app';

describe('Phase 8 — Email Template Rendering, Masking & Route Auth', () => {
  const app = createApp();

  it('renders template placeholders safely and strips CRLF from subjects', () => {
    const rendered = renderEmailTemplate('Yth. {{nama_lengkap}}, nomor {{nomor_dokumen}}.', {
      nama_lengkap: 'Siti Aminah',
      nomor_dokumen: '001/PKM-SMK/XI/2026',
    });
    expect(rendered).toBe('Yth. Siti Aminah, nomor 001/PKM-SMK/XI/2026.');

    const safeSubject = sanitizeEmailSubject('Sertifikat\r\nBcc: attacker@evil.test\nKegiatan');
    expect(safeSubject).not.toContain('\r');
    expect(safeSubject).not.toContain('\n');
    expect(safeSubject).toBe('Sertifikat Bcc: attacker@evil.test Kegiatan');
  });

  it('masks email addresses for safe admin monitor display', () => {
    expect(maskEmailAddress('budisantoso@puskesmas.go.id')).toBe('bu*****@puskesmas.go.id');
    expect(maskEmailAddress('ab@example.com')).toBe('a*@example.com');
    expect(maskEmailAddress('invalid')).toBe('***');
  });

  it('computes next Jakarta 00:10 quota reset timestamp strictly in the future', () => {
    const nowMs = Date.parse('2026-11-27T05:00:00.000Z'); // 12:00 WIB
    const nextIso = computeNextJakartaQuotaResetIso(nowMs);
    expect(Date.parse(nextIso)).toBeGreaterThan(nowMs);
    // 2026-11-28 00:10 WIB = 2026-11-27T17:10:00.000Z
    expect(nextIso).toBe('2026-11-27T17:10:00.000Z');
  });

  it('requires admin auth on email monitor endpoints', async () => {
    const res = await app.request(
      'http://localhost/api/v1/admin/jobs/email/summary',
      { method: 'GET' },
      { APP_ENV: 'test' },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });
});
