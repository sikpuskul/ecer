import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { ERROR_CODES } from '../../shared/constants/api';
import type { AppEnv } from '../env';
import { sha256Hex } from '../security/crypto';
import { findActiveSessionByTokenHash, touchSessionActivity } from '../modules/auth/repository';
import { AppError } from './error-handler';

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

export function getSessionCookieName(c: Context<AppEnv>): string {
  const isSecure = c.env.APP_ENV === 'production' || c.req.url.startsWith('https://');
  return isSecure ? '__Host-ecer_session' : 'ecer_session';
}

export function setAdminSessionCookie(c: Context<AppEnv>, rawToken: string): void {
  const isSecure = c.env.APP_ENV === 'production' || c.req.url.startsWith('https://');
  setCookie(c, getSessionCookieName(c), rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000),
  });
}

export function clearAdminSessionCookie(c: Context<AppEnv>): void {
  const isSecure = c.env.APP_ENV === 'production' || c.req.url.startsWith('https://');
  deleteCookie(c, getSessionCookieName(c), {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
  });
}

export const requireAdminAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = c.env.DB;
  if (!db) {
    throw new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      'Database belum dikonfigurasi pada runtime ini.',
      500,
    );
  }

  const rawToken = getCookie(c, getSessionCookieName(c));
  if (!rawToken) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Silakan login terlebih dahulu.', 401);
  }

  const tokenHash = await sha256Hex(rawToken);
  const record = await findActiveSessionByTokenHash(db, tokenHash);
  if (!record || record.is_active !== 1 || record.revoked_at !== null) {
    clearAdminSessionCookie(c);
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Sesi tidak valid atau telah berakhir.', 401);
  }

  const nowMs = Date.now();
  const expiresAtMs = Date.parse(record.expires_at);
  const lastActivityMs = Date.parse(record.last_activity_at);

  if (
    !Number.isFinite(expiresAtMs) ||
    !Number.isFinite(lastActivityMs) ||
    nowMs >= expiresAtMs ||
    nowMs - lastActivityMs > SESSION_IDLE_TIMEOUT_MS
  ) {
    clearAdminSessionCookie(c);
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Sesi telah kedaluwarsa. Silakan login kembali.',
      401,
    );
  }

  await touchSessionActivity(db, record.session_id, new Date(nowMs).toISOString());

  c.set('admin', {
    id: record.admin_id,
    username: record.username,
    displayName: record.display_name,
    sessionId: record.session_id,
  });

  await next();
};
