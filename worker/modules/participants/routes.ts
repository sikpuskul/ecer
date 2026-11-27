import { Hono } from 'hono';
import { ERROR_CODES, PAGINATION_DEFAULTS } from '../../../shared/constants/api';
import { AddWhitelistSchema } from '../../../shared/schemas/public';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { findEventRowById } from '../events/repository';
import {
  addAdminWhitelistEntries,
  getAdminParticipants,
  getAdminWhitelist,
  transitionParticipantStatus,
} from './service';

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function createAdminParticipantsRoutes() {
  const routes = new Hono<AppEnv>();

  routes.use('*', requireAdminAuth);

  routes.get('/events/:id/participants', async (c) => {
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const status = c.req.query('status')?.trim() || undefined;

    const event = await findEventRowById(c.env.DB!, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    const { items, total } = await getAdminParticipants(c.env, { eventId, status, page, limit });
    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        success: true as const,
        data: items,
        meta: { page, limit, total },
        requestId,
      },
      200,
    );
  });

  routes.post('/participants/:id/approve', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    await transitionParticipantStatus(c.env.DB!, {
      participantId: c.req.param('id'),
      targetStatus: 'approved',
      adminId: admin.id,
      requestId,
    });
    return c.json({ success: true as const, data: { status: 'approved' }, requestId }, 200);
  });

  routes.post('/participants/:id/reject', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    await transitionParticipantStatus(c.env.DB!, {
      participantId: c.req.param('id'),
      targetStatus: 'rejected',
      adminId: admin.id,
      requestId,
    });
    return c.json({ success: true as const, data: { status: 'rejected' }, requestId }, 200);
  });

  routes.post('/participants/:id/cancel', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    await transitionParticipantStatus(c.env.DB!, {
      participantId: c.req.param('id'),
      targetStatus: 'cancelled',
      adminId: admin.id,
      requestId,
    });
    return c.json({ success: true as const, data: { status: 'cancelled' }, requestId }, 200);
  });

  routes.get('/events/:id/whitelist', async (c) => {
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');
    const event = await findEventRowById(c.env.DB!, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    const items = await getAdminWhitelist(c.env, eventId);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: items, requestId }, 200);
  });

  routes.post('/events/:id/whitelist', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');

    const event = await findEventRowById(c.env.DB!, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = AddWhitelistSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Data whitelist tidak valid.',
        422,
      );
    }

    const result = await addAdminWhitelistEntries(c.env, {
      eventId,
      entries: parsed.data.entries,
      adminId: admin.id,
      requestId,
    });

    return c.json({ success: true as const, data: result, requestId }, 201);
  });

  return routes;
}
