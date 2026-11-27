/**
 * Pure email template renderer & PII masking helpers for ECER Phase 8.
 */

export function sanitizeEmailSubject(subject: string): string {
  return subject
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function renderEmailTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    return variables[key] ?? '';
  });
}

export function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return '***';
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return '***';
  if (local.length <= 2) {
    return `${local[0] ?? '*'}*@${domain}`;
  }
  const hiddenLen = Math.min(local.length - 2, 5);
  return `${local.slice(0, 2)}${'*'.repeat(hiddenLen)}@${domain}`;
}

/**
 * Computes next 00:10 Asia/Jakarta (UTC+7) in UTC ISO string for deferred_quota resumption.
 */
export function computeNextJakartaQuotaResetIso(nowMs: number = Date.now()): string {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wibDate = new Date(nowMs + WIB_OFFSET_MS);
  const nextWibMidnightUtcMs =
    Date.UTC(wibDate.getUTCFullYear(), wibDate.getUTCMonth(), wibDate.getUTCDate() + 1, 0, 10, 0) -
    WIB_OFFSET_MS;
  return new Date(nextWibMidnightUtcMs).toISOString();
}
