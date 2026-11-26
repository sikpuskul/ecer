import { Hono } from 'hono';
import { ERROR_CODES } from '../../../shared/constants/api';
import {
  CreateAdminUserSchema,
  ResetAdminPasswordSchema,
  UpdateAdminUserSchema,
} from '../../../shared/schemas/admin';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { createAdminUser, getAdminUsers, resetAdminUserPassword, updateAdminUser } from './service';

export function createUsersRoutes() {
  const users = new Hono<AppEnv>();

  users.use('*', requireAdminAuth);

  users.get('/', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const items = await getAdminUsers(db);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: items, requestId }, 200);
  });

  users.post('/', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = CreateAdminUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input administrator tidak valid.',
        422,
      );
    }

    const created = await createAdminUser(db, {
      actorAdminId: admin.id,
      input: parsed.data,
      requestId,
    });

    return c.json({ success: true as const, data: created, requestId }, 201);
  });

  users.patch('/:id', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const targetId = c.req.param('id');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = UpdateAdminUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input perubahan administrator tidak valid.',
        422,
      );
    }

    const updated = await updateAdminUser(db, {
      actorAdminId: admin.id,
      targetId,
      input: parsed.data,
      requestId,
    });

    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  users.post('/:id/reset-password', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const targetId = c.req.param('id');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = ResetAdminPasswordSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Password baru tidak valid.',
        422,
      );
    }

    await resetAdminUserPassword(db, {
      actorAdminId: admin.id,
      targetId,
      newPassword: parsed.data.newPassword,
      requestId,
    });

    return c.json({ success: true as const, data: { passwordReset: true }, requestId }, 200);
  });

  return users;
}
