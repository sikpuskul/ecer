import { Hono } from 'hono';
import { ERROR_CODES, PAGINATION_DEFAULTS } from '../../../shared/constants/api';
import { RevokeDocumentSchema } from '../../../shared/schemas/documents';
import type { AppEnv } from '../../env';
import { GoogleAppsScriptClient } from '../../integrations/google-apps-script/client';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { insertAuditLog } from '../auth/repository';
import {
  findCurrentRevisionForDocument,
  findDocumentRowById,
  getJobsSummaryCounts,
  listDocumentRevisions,
  listGenerationJobs,
} from './repository';
import {
  getAdminDocumentsList,
  processGenerationJob,
  regenerateDocument,
  revokeDocument,
} from './service';

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function createAdminDocumentsRoutes() {
  const docs = new Hono<AppEnv>();

  docs.use('*', requireAdminAuth);

  docs.get('/', async (c) => {
    const requestId = c.get('requestId');
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const documentType = c.req.query('documentType')?.trim() || undefined;
    const status = c.req.query('status')?.trim() || undefined;
    const eventId = c.req.query('eventId')?.trim() || undefined;

    const { items, total } = await getAdminDocumentsList(c.env, {
      page,
      limit,
      documentType,
      status,
      eventId,
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

  docs.get('/:id/revisions', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const doc = await findDocumentRowById(db, c.req.param('id'));
    if (!doc) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Dokumen tidak ditemukan.', 404);
    }
    const revisions = await listDocumentRevisions(db, doc.id);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: revisions, requestId }, 200);
  });

  // PRD §15.2: Admin can download any ready document PDF regardless of public download window
  docs.get('/:id/download', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const doc = await findDocumentRowById(db, c.req.param('id'));
    if (!doc) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Dokumen tidak ditemukan.', 404);
    }
    if (doc.document_status !== 'ready') {
      throw new AppError(
        ERROR_CODES.GENERATION_PENDING,
        'File PDF dokumen belum tersedia untuk diunduh.',
        409,
      );
    }

    const revision = await findCurrentRevisionForDocument(db, doc.id);
    if (!revision) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Revisi PDF aktif tidak ditemukan.', 404);
    }

    if (!c.env.GAS_WEB_APP_URL || !c.env.GAS_SHARED_SECRET) {
      throw new AppError(
        ERROR_CODES.INTEGRATION_UNAVAILABLE,
        'Layanan penyimpanan dokumen sedang tidak tersedia.',
        503,
      );
    }

    const gas = new GoogleAppsScriptClient({
      webAppUrl: c.env.GAS_WEB_APP_URL,
      sharedSecret: c.env.GAS_SHARED_SECRET,
    });
    const pdf = await gas.fetchPdfBytes(
      { driveFileId: revision.driveFileId, expectedFilename: revision.filename },
      requestId,
    );

    const safeFilename = (revision.filename || pdf.filename || 'dokumen.pdf').replace(/"/g, '');
    return new Response(pdf.bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    });
  });

  docs.post('/:id/regenerate', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const result = await regenerateDocument(c.env, {
      documentId: c.req.param('id'),
      adminId: admin.id,
      requestId,
    });

    c.executionCtx.waitUntil(processGenerationJob(c.env, result.jobId, requestId));
    return c.json({ success: true as const, data: result, requestId }, 202);
  });

  docs.post('/:id/revoke', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = RevokeDocumentSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Alasan pencabutan wajib diisi.',
        422,
      );
    }

    await revokeDocument(c.env.DB!, {
      documentId: c.req.param('id'),
      reason: parsed.data.reason,
      adminId: admin.id,
      requestId,
    });

    return c.json({ success: true as const, data: { revoked: true }, requestId }, 200);
  });

  return docs;
}

export function createAdminJobsRoutes() {
  const jobs = new Hono<AppEnv>();

  jobs.use('*', requireAdminAuth);

  jobs.get('/summary', async (c) => {
    const requestId = c.get('requestId');
    const summary = await getJobsSummaryCounts(c.env.DB!);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: summary, requestId }, 200);
  });

  jobs.get('/generation', async (c) => {
    const requestId = c.get('requestId');
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const status = c.req.query('status')?.trim() || undefined;

    const { items, total } = await listGenerationJobs(c.env.DB!, { page, limit, status });
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

  jobs.post('/generation/:id/retry', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const jobId = c.req.param('id');
    const nowIso = new Date().toISOString();

    await db
      .prepare(
        `UPDATE generation_jobs
         SET job_status = 'queued', attempts = 0, next_attempt_at = NULL,
             lease_expires_at = NULL, error_code = NULL, safe_error_message = NULL,
             updated_at = ?2
         WHERE id = ?1 AND job_status IN ('failed', 'retry_wait', 'needs_review')`,
      )
      .bind(jobId, nowIso)
      .run();

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'generation_job.retry',
      entityType: 'generation_job',
      entityId: jobId,
      requestId,
    });

    c.executionCtx.waitUntil(processGenerationJob(c.env, jobId, requestId));
    return c.json({ success: true as const, data: { retried: true }, requestId }, 202);
  });

  jobs.post('/generation/:id/cancel', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const jobId = c.req.param('id');
    const nowIso = new Date().toISOString();

    await db
      .prepare(
        `UPDATE generation_jobs
         SET job_status = 'cancelled', lease_expires_at = NULL, updated_at = ?2
         WHERE id = ?1 AND job_status IN ('queued', 'retry_wait', 'failed', 'needs_review')`,
      )
      .bind(jobId, nowIso)
      .run();

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'generation_job.cancel',
      entityType: 'generation_job',
      entityId: jobId,
      requestId,
    });

    return c.json({ success: true as const, data: { cancelled: true }, requestId }, 200);
  });

  return jobs;
}
