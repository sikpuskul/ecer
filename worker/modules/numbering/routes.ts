import { Hono } from 'hono';
import { ERROR_CODES } from '../../../shared/constants/api';
import {
  CreateNumberingRuleSchema,
  PreviewNumberingSchema,
  UpdateNumberingRuleSchema,
} from '../../../shared/schemas/numbering';
import { getCurrentJakartaMonthYear } from '../../../shared/utils/jakarta-date';
import { formatDocumentNumber } from '../../../shared/utils/numbering';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { insertAuditLog } from '../auth/repository';
import {
  findNumberingRuleById,
  insertNumberingRule,
  listNumberingRules,
  updateNumberingRuleRecord,
} from './repository';

export function createNumberingRoutes() {
  const numbering = new Hono<AppEnv>();

  numbering.use('*', requireAdminAuth);

  numbering.get('/', async (c) => {
    const requestId = c.get('requestId');
    const items = await listNumberingRules(c.env.DB!);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: items, requestId }, 200);
  });

  numbering.post('/', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = CreateNumberingRuleSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Aturan penomoran tidak valid.',
        422,
      );
    }

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    await insertNumberingRule(db, {
      id,
      ...parsed.data,
      nowIso,
    });

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'numbering_rule.create',
      entityType: 'numbering_rule',
      entityId: id,
      changeSummary: { name: parsed.data.name, pattern: parsed.data.formatPattern },
      requestId,
    });

    const created = await findNumberingRuleById(db, id);
    return c.json({ success: true as const, data: created, requestId }, 201);
  });

  numbering.patch('/:id', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const id = c.req.param('id');

    const existing = await findNumberingRuleById(db, id);
    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Aturan penomoran tidak ditemukan.', 404);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = UpdateNumberingRuleSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Input pembaruan penomoran tidak valid.',
        422,
      );
    }

    const nowIso = new Date().toISOString();
    await updateNumberingRuleRecord(db, {
      id: existing.id,
      name: parsed.data.name ?? existing.name,
      formatPattern: parsed.data.formatPattern ?? existing.formatPattern,
      sequencePadding: parsed.data.sequencePadding ?? existing.sequencePadding,
      startingNumber: parsed.data.startingNumber ?? existing.startingNumber,
      resetStrategy: parsed.data.resetStrategy ?? existing.resetStrategy,
      organizationCode: parsed.data.organizationCode ?? existing.organizationCode,
      isActive: parsed.data.isActive ?? existing.isActive,
      nowIso,
    });

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'numbering_rule.update',
      entityType: 'numbering_rule',
      entityId: existing.id,
      requestId,
    });

    const updated = await findNumberingRuleById(db, existing.id);
    return c.json({ success: true as const, data: updated, requestId }, 200);
  });

  numbering.post('/preview', csrfOriginMiddleware, async (c) => {
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = PreviewNumberingSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Parameter preview tidak valid.',
        422,
      );
    }

    const now = getCurrentJakartaMonthYear();
    const preview = formatDocumentNumber({
      formatPattern: parsed.data.formatPattern,
      sequenceNumber: parsed.data.sequenceNumber,
      sequencePadding: parsed.data.sequencePadding,
      documentType: parsed.data.documentType,
      eventCode: parsed.data.eventCode,
      organizationCode: parsed.data.organizationCode,
      month: parsed.data.month ?? now.month,
      year: parsed.data.year ?? now.year,
    });

    return c.json({ success: true as const, data: { preview }, requestId }, 200);
  });

  return numbering;
}
