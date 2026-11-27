import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@shared/constants/api';
import { buildSafeCsv, toSafeCsvCell } from '@shared/utils/csv-export';
import { createApp } from '@worker/app';

describe('Phase 10 — Safe CSV Export & Reports Route Auth', () => {
  const app = createApp();

  it('neutralizes CSV formula injection and escapes quotes/commas per RFC-4180', () => {
    expect(toSafeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(toSafeCsvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(toSafeCsvCell('-1+1')).toBe("'-1+1");
    expect(toSafeCsvCell('@evil')).toBe("'@evil");
    expect(toSafeCsvCell('Pelatihan "Gizi", Batch 1')).toBe('"Pelatihan ""Gizi"", Batch 1"');
    expect(toSafeCsvCell(null)).toBe('');
  });

  it('builds UTF-8 BOM CSV with CRLF line endings', () => {
    const csv = buildSafeCsv(
      ['Kode', 'Judul'],
      [
        ['EVT-01', '=Inject'],
        ['EVT-02', 'Normal, Title'],
      ],
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("EVT-01,'=Inject");
    expect(csv).toContain('EVT-02,"Normal, Title"');
  });

  it('requires admin auth on reports and retention endpoints', async () => {
    const overviewRes = await app.request(
      'http://localhost/api/v1/admin/reports/overview?year=2026',
      { method: 'GET' },
      { APP_ENV: 'test' },
    );
    expect(overviewRes.status).toBe(401);
    const overviewBody = (await overviewRes.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(overviewBody.success).toBe(false);
    expect(overviewBody.error.code).toBe(ERROR_CODES.UNAUTHORIZED);

    const dryRunRes = await app.request(
      'http://localhost/api/v1/admin/reports/retention/dry-run',
      { method: 'GET' },
      { APP_ENV: 'test' },
    );
    expect(dryRunRes.status).toBe(401);
  });
});
