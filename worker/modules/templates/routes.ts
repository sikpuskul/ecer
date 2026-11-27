import { Hono } from 'hono';
import { ERROR_CODES } from '../../../shared/constants/api';
import { ImportTemplateSchema, UpdateTemplateSchema } from '../../../shared/schemas/templates';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import {
  deleteTemplate,
  getTemplateDetail,
  importTemplateFromGoogleDocs,
  listTemplates,
  refreshTemplateFromSource,
  testGenerateTemplate,
  updateTemplate,
  validateAndSnapshotTemplate,
} from './service';

export function createTemplatesRoutes() {
  const templates = new Hono<AppEnv>();

  templates.use('*', requireAdminAuth);

  templates.get('/', async (c) => {
    const requestId = c.get('requestId');
    const items = await listTemplates(c.env.DB!);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: items, requestId }, 200);
  });

  templates.post('/import', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = ImportTemplateSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input import template tidak valid.',
        422,
      );
    }

    const result = await importTemplateFromGoogleDocs(c.env, {
      adminId: admin.id,
      input: parsed.data,
      requestId,
    });

    return c.json({ success: true as const, data: result, requestId }, 201);
  });

  templates.get('/:id', async (c) => {
    const requestId = c.get('requestId');
    const detail = await getTemplateDetail(c.env.DB!, c.req.param('id'));
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: detail, requestId }, 200);
  });

  templates.patch('/:id', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = UpdateTemplateSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input pembaruan template tidak valid.',
        422,
      );
    }

    const updated = await updateTemplate(c.env.DB!, {
      adminId: admin.id,
      templateId: c.req.param('id'),
      input: parsed.data,
      requestId,
    });

    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  templates.delete('/:id', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    await deleteTemplate(c.env.DB!, {
      adminId: admin.id,
      templateId: c.req.param('id'),
      requestId,
    });
    return c.json({ success: true as const, data: { deleted: true }, requestId }, 200);
  });

  templates.post('/:id/refresh', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const refreshed = await refreshTemplateFromSource(c.env, {
      adminId: admin.id,
      templateId: c.req.param('id'),
      requestId,
    });
    return c.json({ success: true as const, data: refreshed, requestId }, 200);
  });

  templates.post('/:id/validate', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const validated = await validateAndSnapshotTemplate(c.env, {
      adminId: admin.id,
      templateId: c.req.param('id'),
      requestId,
    });
    return c.json({ success: true as const, data: validated, requestId }, 200);
  });

  templates.post('/:id/test-generate', csrfOriginMiddleware, async (c) => {
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const preview = await testGenerateTemplate(c.env, {
      adminId: admin.id,
      templateId: c.req.param('id'),
      requestId,
    });
    return c.json({ success: true as const, data: preview, requestId }, 200);
  });

  templates.get('/:id/versions', async (c) => {
    const requestId = c.get('requestId');
    const detail = await getTemplateDetail(c.env.DB!, c.req.param('id'));
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: detail.versions, requestId }, 200);
  });

  return templates;
}
