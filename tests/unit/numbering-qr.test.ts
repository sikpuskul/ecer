import { describe, expect, it } from 'vitest';
import {
  buildCounterScopeKey,
  buildSafeDocumentFilename,
  formatDocumentNumber,
  toRomanMonth,
} from '@shared/utils/numbering';
import { generateQrPngBytes } from '@worker/utils/qr-png';

describe('Phase 6 — Document Numbering Engine & Filename Sanitizer', () => {
  it('converts all 12 months to Roman numerals accurately', () => {
    expect(toRomanMonth(1)).toBe('I');
    expect(toRomanMonth(4)).toBe('IV');
    expect(toRomanMonth(9)).toBe('IX');
    expect(toRomanMonth(11)).toBe('XI');
    expect(toRomanMonth(12)).toBe('XII');
    expect(() => toRomanMonth(0)).toThrow();
    expect(() => toRomanMonth(13)).toThrow();
  });

  it('formats certificate and award numbers with all supported tokens', () => {
    const certNum = formatDocumentNumber({
      formatPattern: '{SEQ}/{DOC_TYPE}/{ORG_CODE}/{MONTH_ROMAN}/{YEAR}',
      sequenceNumber: 7,
      sequencePadding: 3,
      documentType: 'certificate',
      eventCode: 'KDR-01',
      organizationCode: 'PKM-SMK',
      month: 11,
      year: 2026,
    });
    expect(certNum).toBe('007/SERT/PKM-SMK/XI/2026');

    const awardNum = formatDocumentNumber({
      formatPattern: '{SEQ}/{DOC_TYPE}/{EVENT_CODE}/{MONTH}/{YEAR}',
      sequenceNumber: 12,
      sequencePadding: 4,
      documentType: 'award',
      eventCode: 'AWD-02',
      organizationCode: 'PKM-SMK',
      month: 2,
      year: 2027,
    });
    expect(awardNum).toBe('0012/PIAGAM/AWD-02/02/2027');
  });

  it('computes deterministic counter scope keys per reset strategy', () => {
    expect(
      buildCounterScopeKey({ resetStrategy: 'never', month: 11, year: 2026, eventId: 'ev1' }),
    ).toBe('global');
    expect(
      buildCounterScopeKey({ resetStrategy: 'yearly', month: 11, year: 2026, eventId: 'ev1' }),
    ).toBe('year:2026');
    expect(
      buildCounterScopeKey({ resetStrategy: 'monthly', month: 2, year: 2026, eventId: 'ev1' }),
    ).toBe('month:2026-02');
    expect(
      buildCounterScopeKey({ resetStrategy: 'per_event', month: 11, year: 2026, eventId: 'ev1' }),
    ).toBe('event:ev1');
  });

  it('sanitizes PDF filenames cleanly for certificates and awards', () => {
    expect(
      buildSafeDocumentFilename({
        documentType: 'certificate',
        recipientName: 'dr. Siti Aminah, S.Ked / ../',
        documentNumber: '001/SERT/PKM-SMK/XI/2026',
      }),
    ).toBe('Sertifikat_dr_Siti_Aminah_SKed_001_SERT_PKM-SMK_XI_2026.pdf');

    expect(
      buildSafeDocumentFilename({
        documentType: 'award',
        recipientName: 'Kader Terbaik',
        documentNumber: '001/PIAGAM/PKM-SMK/XI/2026',
      }),
    ).toBe('Piagam_Kader_Terbaik_001_PIAGAM_PKM-SMK_XI_2026.pdf');
  });

  it('generates valid PNG bytes locally for verification QR URLs', async () => {
    const png = await generateQrPngBytes('https://ecer.puskesmas.go.id/verifikasi/abc123xyz');
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.byteLength).toBeGreaterThan(100);
    expect(png.byteLength).toBeLessThan(20_000);
  });
});
