import { Hono } from 'hono';
import { ERROR_CODES, PAGINATION_DEFAULTS } from '../../../shared/constants/api';
import { ResendDocumentEmailSchema } from '../../../shared/schemas/email';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { insertAuditLog } from '../auth/repository';
import { cancelPendingEmailJob, resetEmailJobForRetry } from './repository';
import {
  getAdminEmailJobsList,
  getAdminEmailJobsSummary,
  manualResendDocumentEmail,
  processEmailJob,
} from './service';

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function createAdminEmailRoutes() {
  const routes = new Hono<AppEnv>();

  routes.use('*', requireAdminAuth);

  routes.get('/jobs/email/summary', async (c) => {
    const requestId = c.get('requestId');
    const summary = await getAdminEmailJobsSummary(c.env, requestId);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: summary, requestId }, 200);
  });

  routes.get('/jobs/email', async (c) => {
    const requestId = c.get('requestId');
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const status = c.req.query('status')?.trim() || undefined;

    const { items, total } = await getAdminEmailJobsList(c.env, { page, limit, status });
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

  routes.post('/jobs/email/:id/retry', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const jobId = c.req.param('id');

    const updated = await resetEmailJobForRetry(db, jobId, new Date().toISOString());
    if (!updated) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Email job tidak ditemukan atau tidak dalam status yang dapat diulang.',
        409,
      );
    }

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'email_job.retry',
      entityType: 'email_job',
      entityId: jobId,
      requestId,
    });

    c.executionCtx.waitUntil(processEmailJob(c.env, jobId, requestId));
    return c.json({ success: true as const, data: { retried: true }, requestId }, 202);
  });

  routes.post('/jobs/email/:id/cancel', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const jobId = c.req.param('id');

    const cancelled = await cancelPendingEmailJob(db, jobId, new Date().toISOString());
    if (!cancelled) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Email job tidak ditemukan atau sudah selesai diproses.',
        409,
      );
    }

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'email_job.cancel',
      entityType: 'email_job',
      entityId: jobId,
      requestId,
    });

    return c.json({ success: true as const, data: { cancelled: true }, requestId }, 200);
  });

  routes.post('/documents/:id/resend-email', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown = {};
    try {
      const text = await c.req.text();
      if (text.trim()) {
        rawBody = JSON.parse(text);
      }
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = ResendDocumentEmailSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Parameter kirim ulang email tidak valid.',
        422,
      );
    }

    const result = await manualResendDocumentEmail(c.env, {
      documentId: c.req.param('id'),
      adminId: admin.id,
      requestId,
      overrideSubject: parsed.data.overrideSubject,
      overrideBody: parsed.data.overrideBody,
    });

    c.executionCtx.waitUntil(processEmailJob(c.env, result.jobId, requestId));
    return c.json({ success: true as const, data: result, requestId }, 202);
  });

  return routes;
}
