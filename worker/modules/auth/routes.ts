import { Hono } from 'hono';
import { ERROR_CODES } from '../../../shared/constants/api';
import { ChangePasswordRequestSchema, LoginRequestSchema } from '../../../shared/schemas/auth';
import type { AppEnv } from '../../env';
import {
  clearAdminSessionCookie,
  requireAdminAuth,
  setAdminSessionCookie,
} from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { verifyTurnstileToken } from '../../security/turnstile';
import { changeAdminPassword, getAdminProfile, loginAdmin, logoutAdmin } from './service';

export function createAuthRoutes() {
  const auth = new Hono<AppEnv>();

  auth.post('/login', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB;
    if (!db) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        'Database belum dikonfigurasi pada runtime ini.',
        500,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = LoginRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? 'Input login tidak valid.';
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, firstIssue, 422);
    }

    const turnstile = await verifyTurnstileToken({
      secretKey: c.env.TURNSTILE_SECRET_KEY,
      token: parsed.data.turnstileToken,
      remoteIp: c.req.header('cf-connecting-ip'),
      appEnv: c.env.APP_ENV,
    });
    if (!turnstile.ok) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Verifikasi keamanan Turnstile gagal. Silakan coba lagi.',
        422,
      );
    }

    const requestId = c.get('requestId');
    const result = await loginAdmin(db, {
      username: parsed.data.username,
      password: parsed.data.password,
      requestId,
    });

    setAdminSessionCookie(c, result.rawSessionToken);
    c.header('Cache-Control', 'no-store');

    return c.json(
      {
        success: true as const,
        data: {
          admin: result.admin,
        },
        requestId,
      },
      200,
    );
  });

  auth.post('/logout', csrfOriginMiddleware, requireAdminAuth, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    await logoutAdmin(db, {
      adminId: admin.id,
      sessionId: admin.sessionId,
      requestId,
    });

    clearAdminSessionCookie(c);
    c.header('Cache-Control', 'no-store');

    return c.json(
      {
        success: true as const,
        data: { loggedOut: true },
        requestId,
      },
      200,
    );
  });

  auth.get('/me', requireAdminAuth, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    const profile = await getAdminProfile(db, admin.id);
    c.header('Cache-Control', 'no-store');

    return c.json(
      {
        success: true as const,
        data: { admin: profile },
        requestId,
      },
      200,
    );
  });

  auth.post('/change-password', csrfOriginMiddleware, requireAdminAuth, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = ChangePasswordRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? 'Input perubahan password tidak valid.';
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, firstIssue, 422);
    }

    await changeAdminPassword(db, {
      adminId: admin.id,
      currentSessionId: admin.sessionId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      requestId,
    });

    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        success: true as const,
        data: { passwordUpdated: true },
        requestId,
      },
      200,
    );
  });

  return auth;
}
