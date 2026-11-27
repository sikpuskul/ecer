import { Hono } from 'hono';
import { ERROR_CODES, PAGINATION_DEFAULTS } from '../../../shared/constants/api';
import {
  BulkImportAwardsSchema,
  CreateManualAwardSchema,
  ImportAwardsFromParticipantsSchema,
} from '../../../shared/schemas/awards';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { processGenerationJob } from '../documents/service';
import { listAwardEventTemplates } from './repository';
import {
  bulkImportAwards,
  getAdminAwardsList,
  importAwardsFromParticipants,
  issueManualAward,
} from './service';

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function createAdminAwardsRoutes() {
  const routes = new Hono<AppEnv>();

  routes.use('*', requireAdminAuth);

  routes.get('/templates', async (c) => {
    const requestId = c.get('requestId');
    const eventId = c.req.query('eventId')?.trim() || undefined;
    const options = await listAwardEventTemplates(c.env.DB!, eventId);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: options, requestId }, 200);
  });

  routes.get('/', async (c) => {
    const requestId = c.get('requestId');
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const eventId = c.req.query('eventId')?.trim() || undefined;
    const status = c.req.query('status')?.trim() || undefined;

    const { items, total } = await getAdminAwardsList(c.env, { page, limit, eventId, status });
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

  routes.post('/', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = CreateManualAwardSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Data piagam tidak valid.',
        422,
      );
    }

    const result = await issueManualAward(c.env, {
      input: parsed.data,
      adminId: admin.id,
      requestId,
    });

    if (result.jobId) {
      c.executionCtx.waitUntil(processGenerationJob(c.env, result.jobId, requestId));
    }

    return c.json({ success: true as const, data: result, requestId }, 201);
  });

  routes.post('/bulk-import', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = BulkImportAwardsSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Data bulk import piagam tidak valid.',
        422,
      );
    }

    const result = await bulkImportAwards(c.env, {
      eventId: parsed.data.eventId,
      eventTemplateId: parsed.data.eventTemplateId,
      rows: parsed.data.rows,
      adminId: admin.id,
      requestId,
    });

    // Kick off first 2 jobs immediately; remaining jobs are processed by Cron
    for (const jobId of result.jobIds.slice(0, 2)) {
      c.executionCtx.waitUntil(processGenerationJob(c.env, jobId, requestId));
    }

    return c.json({ success: true as const, data: result, requestId }, 202);
  });

  routes.post('/import-participants', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = ImportAwardsFromParticipantsSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Data import peserta tidak valid.',
        422,
      );
    }

    const result = await importAwardsFromParticipants(c.env, {
      input: parsed.data,
      adminId: admin.id,
      requestId,
    });

    for (const jobId of result.jobIds.slice(0, 2)) {
      c.executionCtx.waitUntil(processGenerationJob(c.env, jobId, requestId));
    }

    return c.json({ success: true as const, data: result, requestId }, 202);
  });

  return routes;
}
