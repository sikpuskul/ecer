import { Hono } from 'hono';
import { ERROR_CODES } from '../../../shared/constants/api';
import { LinkEventTemplatesSchema, SaveEventFormSchema } from '../../../shared/schemas/forms';
import { isSafeAdminRegex } from '../../../shared/utils/form-validator';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { insertAuditLog } from '../auth/repository';
import { findEventRowById } from '../events/repository';
import {
  ensureDefaultNumberingRule,
  listEventTemplateLinks,
  listFormVersionsByEvent,
  publishLatestDraftForm,
  replaceEventTemplateLinks,
  saveDraftFormVersion,
} from './repository';

export function createEventFormsRoutes() {
  const routes = new Hono<AppEnv>();

  routes.use('*', requireAdminAuth);

  routes.get('/:id/form', async (c) => {
    const db = c.env.DB!;
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');

    const event = await findEventRowById(db, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    const versions = await listFormVersionsByEvent(db, eventId);
    const draft = versions.find((v) => v.status === 'draft') ?? null;
    const published = versions.find((v) => v.status === 'published') ?? null;

    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        success: true as const,
        data: {
          eventId,
          eventTitle: event.title,
          draft,
          published,
          versions,
        },
        requestId,
      },
      200,
    );
  });

  routes.put('/:id/form', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');

    const event = await findEventRowById(db, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = SaveEventFormSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Skema formulir tidak valid.',
        422,
      );
    }

    // ReDoS safety check on admin-defined regex patterns (PRD §11.5)
    for (const field of parsed.data.fields) {
      if (field.pattern && !isSafeAdminRegex(field.pattern)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          `Pola regex pada field "${field.label}" tidak valid atau berisiko ReDoS.`,
          422,
        );
      }
    }

    const saved = await saveDraftFormVersion(db, {
      eventId,
      fields: parsed.data.fields,
      adminId: admin.id,
      nowIso: new Date().toISOString(),
    });

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'event_form.save_draft',
      entityType: 'form_version',
      entityId: saved.id,
      changeSummary: {
        eventId,
        versionNumber: saved.versionNumber,
        fieldCount: saved.fields.length,
      },
      requestId,
    });

    return c.json({ success: true as const, data: saved, requestId }, 200);
  });

  routes.post('/:id/form/publish', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');

    const event = await findEventRowById(db, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    const published = await publishLatestDraftForm(db, eventId);
    if (!published) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Tidak ada draft formulir yang perlu dipublikasikan.',
        409,
      );
    }

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'event_form.publish',
      entityType: 'form_version',
      entityId: published.id,
      changeSummary: { eventId, versionNumber: published.versionNumber },
      requestId,
    });

    return c.json({ success: true as const, data: published, requestId }, 200);
  });

  routes.get('/:id/templates', async (c) => {
    const db = c.env.DB!;
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');

    const event = await findEventRowById(db, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    const links = await listEventTemplateLinks(db, eventId);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: links, requestId }, 200);
  });

  routes.put('/:id/templates', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const eventId = c.req.param('id');
    const requestId = c.get('requestId');

    const event = await findEventRowById(db, eventId);
    if (!event) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = LinkEventTemplatesSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Konfigurasi template kegiatan tidak valid.',
        422,
      );
    }

    const defaultRuleId = await ensureDefaultNumberingRule(db, 'certificate');
    const links = await replaceEventTemplateLinks(
      db,
      eventId,
      parsed.data.templates.map((t) => ({
        templateVersionId: t.templateVersionId,
        numberingRuleId: t.numberingRuleId ?? defaultRuleId,
        categoryName: t.categoryName,
        sortOrder: t.sortOrder,
        isActive: t.isActive,
      })),
    );

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'event_templates.update',
      entityType: 'event',
      entityId: eventId,
      changeSummary: { linkedCount: links.length },
      requestId,
    });

    return c.json({ success: true as const, data: links, requestId }, 200);
  });

  return routes;
}
