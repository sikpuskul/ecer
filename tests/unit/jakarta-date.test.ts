import { describe, expect, it } from 'vitest';
import {
  formatMonthYearId,
  getCurrentJakartaMonthYear,
  getJakartaMonthBoundsUtc,
  stepMonth,
} from '@shared/utils/jakarta-date';
import { generateRecoveryCode } from '@worker/modules/participants/service';

describe('Phase 5 — Asia/Jakarta Month Navigation & Recovery Code', () => {
  it('rolls over December 2026 -> January 2027 and January 2027 -> December 2026 (AC-02)', () => {
    expect(stepMonth(12, 2026, 1)).toEqual({ month: 1, year: 2027 });
    expect(stepMonth(1, 2027, -1)).toEqual({ month: 12, year: 2026 });
    expect(formatMonthYearId(12, 2026)).toBe('Desember 2026');
    expect(formatMonthYearId(1, 2027)).toBe('Januari 2027');
  });

  it('computes exact UTC month bounds for Asia/Jakarta (+07:00)', () => {
    const bounds = getJakartaMonthBoundsUtc(11, 2026);
    // 2026-11-01 00:00:00 WIB == 2026-10-31 17:00:00 UTC
    expect(bounds.startUtcIso).toBe('2026-10-31T17:00:00.000Z');
    // 2026-12-01 00:00:00 WIB == 2026-11-30 17:00:00 UTC
    expect(bounds.endUtcIso).toBe('2026-11-30T17:00:00.000Z');

    // 2026-11-30 18:00:00 UTC is already 2026-12-01 01:00:00 WIB
    expect(getCurrentJakartaMonthYear(Date.parse('2026-11-30T18:00:00.000Z'))).toEqual({
      month: 12,
      year: 2026,
    });
  });

  it('generates unique 128-bit formatted recovery codes', () => {
    const c1 = generateRecoveryCode();
    const c2 = generateRecoveryCode();
    expect(c1).toMatch(/^ECER-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
    expect(c1).not.toBe(c2);
  });
});
