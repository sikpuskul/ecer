import { Hono } from 'hono';
import { ERROR_CODES, PAGINATION_DEFAULTS } from '../../../shared/constants/api';
import { PublicRegisterRequestSchema } from '../../../shared/schemas/public';
import {
  getCurrentJakartaMonthYear,
  getJakartaMonthBoundsUtc,
} from '../../../shared/utils/jakarta-date';
import type { AppEnv } from '../../env';
import { AppError } from '../../middleware/error-handler';
import { processGenerationJob } from '../documents/service';
import { listFormVersionsByEvent } from '../forms/repository';
import {
  countMonthlyIssuedCertificates,
  findPublicEventBySlug,
  listAllPublicEventsInMonthForStats,
  listPublicEventsInMonth,
} from '../participants/repository';
import { mapPublicEventCard, registerPublicParticipant } from '../participants/service';
import { listCategories, listSettings } from '../settings/repository';

function parseMonthYear(monthRaw?: string, yearRaw?: string): { month: number; year: number } {
  const current = getCurrentJakartaMonthYear();
  const month = monthRaw ? Number.parseInt(monthRaw, 10) : current.month;
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : current.year;

  return {
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : current.month,
    year: Number.isFinite(year) && year >= 2020 && year <= 2100 ? year : current.year,
  };
}

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function createPublicRoutes() {
  const pub = new Hono<AppEnv>();

  pub.get('/dashboard', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const { month, year } = parseMonthYear(c.req.query('month'), c.req.query('year'));
    const { startUtcIso, endUtcIso } = getJakartaMonthBoundsUtc(month, year);

    const [events, certificatesIssued, categories] = await Promise.all([
      listAllPublicEventsInMonthForStats(db, startUtcIso, endUtcIso),
      countMonthlyIssuedCertificates(db, startUtcIso, endUtcIso),
      listCategories(db),
    ]);

    const cards = events.map(mapPublicEventCard);
    const activeEvents = cards.filter(
      (ev) => ev.eligibility.canRegister || ev.eligibility.canDownload,
    ).length;

    c.header('Cache-Control', 'public, max-age=30');
    return c.json(
      {
        success: true as const,
        data: {
          month,
          year,
          publishedEvents: cards.length,
          activeEvents,
          certificatesIssued,
          categories: categories
            .filter((cat) => cat.isActive)
            .map((cat) => ({ id: cat.id, name: cat.name, slug: cat.slug })),
        },
        requestId,
      },
      200,
    );
  });

  pub.get('/events', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const { month, year } = parseMonthYear(c.req.query('month'), c.req.query('year'));
    const { startUtcIso, endUtcIso } = getJakartaMonthBoundsUtc(month, year);
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const search = c.req.query('search')?.trim() || undefined;
    const categoryId = c.req.query('categoryId')?.trim() || undefined;
    const statusFilter = c.req.query('status')?.trim() || undefined;

    const { rows, total } = await listPublicEventsInMonth(db, {
      startUtcIso,
      endUtcIso,
      search,
      categoryId,
      page,
      limit,
    });

    let items = rows.map(mapPublicEventCard);
    if (statusFilter) {
      items = items.filter((ev) => ev.eligibility.computedState === statusFilter);
    }

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

  pub.get('/events/:slug', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const row = await findPublicEventBySlug(db, c.req.param('slug'));
    if (!row) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        success: true as const,
        data: mapPublicEventCard(row),
        requestId,
      },
      200,
    );
  });

  pub.get('/events/:slug/form', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const row = await findPublicEventBySlug(db, c.req.param('slug'));
    if (!row) {
      throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
    }

    const [formVersions, settings] = await Promise.all([
      listFormVersionsByEvent(db, row.id),
      listSettings(db),
    ]);
    const activeForm = formVersions.find((v) => v.status === 'published') ?? null;

    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        success: true as const,
        data: {
          event: mapPublicEventCard(row),
          formVersionId: activeForm?.id ?? null,
          fields: (activeForm?.fields ?? []).filter((f) => f.isActive),
          privacyNoticeVersion: settings.privacy_notice_version || '1.0',
        },
        requestId,
      },
      200,
    );
  });

  pub.post('/events/:slug/register', async (c) => {
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = PublicRegisterRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Data pengajuan tidak valid.',
        422,
      );
    }

    const { response, generationJobId } = await registerPublicParticipant(c.env, {
      slug: c.req.param('slug'),
      input: parsed.data,
      remoteIp: c.req.header('cf-connecting-ip'),
      requestId,
    });

    if (generationJobId) {
      c.executionCtx.waitUntil(processGenerationJob(c.env, generationJobId, requestId));
    }

    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: response, requestId }, 201);
  });

  return pub;
}
