import { Hono } from 'hono';
import { ERROR_CODES, PAGINATION_DEFAULTS } from '../../../shared/constants/api';
import { CreateEventSchema, UpdateEventSchema } from '../../../shared/schemas/events';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import {
  createEvent,
  deleteDraftEvent,
  duplicateEvent,
  getAdminEventDetail,
  getAdminEventsList,
  publishEvent,
  transitionEventLifecycle,
  updateEvent,
} from './service';

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function createEventsRoutes() {
  const events = new Hono<AppEnv>();

  events.use('*', requireAdminAuth);

  events.get('/', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const search = c.req.query('search')?.trim() || undefined;
    const categoryId = c.req.query('categoryId')?.trim() || undefined;
    const status = c.req.query('status')?.trim() || undefined;

    const { items, total } = await getAdminEventsList(db, {
      page,
      limit,
      search,
      categoryId,
      status,
    });

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

  events.post('/', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = CreateEventSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input kegiatan tidak valid.',
        422,
      );
    }

    const created = await createEvent(db, {
      adminId: admin.id,
      input: parsed.data,
      requestId,
    });

    return c.json({ success: true as const, data: created, requestId }, 201);
  });

  events.get('/:id', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const detail = await getAdminEventDetail(db, c.req.param('id'));
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: detail, requestId }, 200);
  });

  events.patch('/:id', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = UpdateEventSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input perubahan kegiatan tidak valid.',
        422,
      );
    }

    const updated = await updateEvent(db, {
      adminId: admin.id,
      eventId: c.req.param('id'),
      input: parsed.data,
      flyerBucket: c.env.FLYER_BUCKET,
      requestId,
    });

    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  events.delete('/:id', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    await deleteDraftEvent(db, {
      adminId: admin.id,
      eventId: c.req.param('id'),
      flyerBucket: c.env.FLYER_BUCKET,
      requestId,
    });

    return c.json({ success: true as const, data: { deleted: true }, requestId }, 200);
  });

  events.post('/:id/publish', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const published = await publishEvent(db, {
      adminId: admin.id,
      eventId: c.req.param('id'),
      requestId,
    });
    return c.json({ success: true as const, data: published, requestId }, 200);
  });

  events.post('/:id/close', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const updated = await transitionEventLifecycle(db, {
      adminId: admin.id,
      eventId: c.req.param('id'),
      action: 'close',
      requestId,
    });
    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  events.post('/:id/reopen', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const updated = await transitionEventLifecycle(db, {
      adminId: admin.id,
      eventId: c.req.param('id'),
      action: 'reopen',
      requestId,
    });
    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  events.post('/:id/archive', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const updated = await transitionEventLifecycle(db, {
      adminId: admin.id,
      eventId: c.req.param('id'),
      action: 'archive',
      requestId,
    });
    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  events.post('/:id/duplicate', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const duplicated = await duplicateEvent(db, {
      adminId: admin.id,
      eventId: c.req.param('id'),
      requestId,
    });
    return c.json({ success: true as const, data: duplicated, requestId }, 201);
  });

  return events;
}
