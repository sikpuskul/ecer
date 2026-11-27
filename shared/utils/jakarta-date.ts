const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export function getCurrentJakartaMonthYear(nowMs = Date.now()): { month: number; year: number } {
  const wib = new Date(nowMs + JAKARTA_OFFSET_MS);
  return {
    month: wib.getUTCMonth() + 1,
    year: wib.getUTCFullYear(),
  };
}

/**
 * Navigates months with automatic year rollover (PRD §7.2, AC-02).
 * Example: stepMonth(12, 2026, 1) -> { month: 1, year: 2027 }
 */
export function stepMonth(
  month: number,
  year: number,
  delta: number,
): { month: number; year: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (((zeroBased % 12) + 12) % 12) + 1;
  return { month: nextMonth, year: nextYear };
}

/**
 * Returns UTC ISO bounds [startUtcIso, endUtcIso) corresponding to
 * 00:00:00 WIB on the 1st of the month through 00:00:00 WIB on the 1st of next month.
 */
export function getJakartaMonthBoundsUtc(
  month: number,
  year: number,
): { startUtcIso: string; endUtcIso: string } {
  const startUtcMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - JAKARTA_OFFSET_MS;
  const next = stepMonth(month, year, 1);
  const endUtcMs = Date.UTC(next.year, next.month - 1, 1, 0, 0, 0, 0) - JAKARTA_OFFSET_MS;

  return {
    startUtcIso: new Date(startUtcMs).toISOString(),
    endUtcIso: new Date(endUtcMs).toISOString(),
  };
}

export function formatMonthYearId(month: number, year: number): string {
  const label = INDONESIAN_MONTHS[month - 1] ?? 'Januari';
  return `${label} ${year}`;
}

export function formatJakartaDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' } : {}),
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
