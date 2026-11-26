import { Hono } from 'hono';
import { ERROR_CODES } from '../../../shared/constants/api';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  UpdateSettingsSchema,
  type SettingKey,
} from '../../../shared/schemas/admin';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { insertAuditLog } from '../auth/repository';
import {
  createCategoryRecord,
  findCategoryById,
  findCategoryBySlug,
  listCategories,
  listSettings,
  updateCategoryRecord,
  upsertSettings,
} from './repository';

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createSettingsRoutes() {
  const settings = new Hono<AppEnv>();

  settings.use('*', requireAdminAuth);

  settings.get('/', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const data = await listSettings(db);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data, requestId }, 200);
  });

  settings.patch('/', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = UpdateSettingsSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Pengaturan tidak valid.',
        422,
      );
    }

    const entries = Object.entries(parsed.data.settings) as Array<[SettingKey, string]>;
    const nowIso = new Date().toISOString();

    await upsertSettings(db, { entries, updatedBy: admin.id, nowIso });

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'settings.update',
      entityType: 'app_settings',
      entityId: 'global',
      changeSummary: { updatedKeys: entries.map(([k]) => k) },
      requestId,
    });

    const updated = await listSettings(db);
    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  return settings;
}

export function createCategoriesRoutes() {
  const categories = new Hono<AppEnv>();

  categories.use('*', requireAdminAuth);

  categories.get('/', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const items = await listCategories(db);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: items, requestId }, 200);
  });

  categories.post('/', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = CreateCategorySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input kategori tidak valid.',
        422,
      );
    }

    const slug = parsed.data.slug ?? slugifyName(parsed.data.name);
    if (!slug || slug.length < 2) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Slug kategori tidak valid.', 422);
    }

    const existing = await findCategoryBySlug(db, slug);
    if (existing) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Slug kategori sudah digunakan.', 409);
    }

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await createCategoryRecord(db, { id, name: parsed.data.name, slug, nowIso });

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'category.create',
      entityType: 'event_category',
      entityId: id,
      changeSummary: { name: parsed.data.name, slug },
      requestId,
    });

    return c.json(
      {
        success: true as const,
        data: { id, name: parsed.data.name, slug, isActive: true, createdAt: nowIso },
        requestId,
      },
      201,
    );
  });

  categories.patch('/:id', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const id = c.req.param('id');

    const existing = await findCategoryById(db, id);
    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Kategori kegiatan tidak ditemukan.', 404);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = UpdateCategorySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input perubahan kategori tidak valid.',
        422,
      );
    }

    const nextName = parsed.data.name ?? existing.name;
    const nextActive = parsed.data.isActive ?? existing.isActive;

    await updateCategoryRecord(db, { id: existing.id, name: nextName, isActive: nextActive });

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'category.update',
      entityType: 'event_category',
      entityId: existing.id,
      changeSummary: { name: nextName, isActive: nextActive },
      requestId,
    });

    return c.json(
      {
        success: true as const,
        data: { ...existing, name: nextName, isActive: nextActive },
        requestId,
      },
      200,
    );
  });

  return categories;
}
