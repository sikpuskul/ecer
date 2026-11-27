import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@shared/constants/api';
import { AWARD_BULK_MAX_ROWS } from '@shared/schemas/awards';
import { parseAwardsCsv, sanitizeSpreadsheetCell } from '@shared/utils/csv-awards';
import { createApp } from '@worker/app';

describe('Phase 9 — Awards CSV Sanitization, Limits & Route Auth', () => {
  const app = createApp();

  it('neutralizes spreadsheet formula injection characters', () => {
    expect(sanitizeSpreadsheetCell('=CMD("calc")')).toBe('CMD("calc")');
    expect(sanitizeSpreadsheetCell('+1234')).toBe('1234');
    expect(sanitizeSpreadsheetCell('-HYPERLINK("http://evil")')).toBe('HYPERLINK("http://evil")');
    expect(sanitizeSpreadsheetCell('@SUM(A1:A2)')).toBe('SUM(A1:A2)');
    expect(sanitizeSpreadsheetCell('dr. Siti Aminah')).toBe('dr. Siti Aminah');
  });

  it('parses valid CSV with semicolon or comma and sanitizes cells', () => {
    const csv = [
      'nama_lengkap;kategori_penghargaan;instansi;email',
      '"=Budi Santoso";Narasumber;Dinas Kesehatan;budi@example.com',
      'Siti Aminah;Moderator;Puskesmas;',
    ].join('\n');

    const result = parseAwardsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.recipientName).toBe('Budi Santoso');
    expect(result.rows[0]?.awardCategory).toBe('Narasumber');
    expect(result.rows[1]?.email).toBe('');
  });

  it('rejects CSV batches exceeding 100 rows', () => {
    const lines = ['nama_lengkap,kategori_penghargaan'];
    for (let i = 0; i < AWARD_BULK_MAX_ROWS + 1; i += 1) {
      lines.push(`Peserta ${i + 1},Narasumber`);
    }
    const result = parseAwardsCsv(lines.join('\n'));
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('100');
  });

  it('requires admin auth on awards endpoints', async () => {
    const res = await app.request(
      'http://localhost/api/v1/admin/awards',
      { method: 'GET' },
      { APP_ENV: 'test' },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });
});
