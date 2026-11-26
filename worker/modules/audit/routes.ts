import { Hono } from 'hono';
import { PAGINATION_DEFAULTS } from '../../../shared/constants/api';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { listAuditLogs } from './repository';

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function createAuditRoutes() {
  const audit = new Hono<AppEnv>();

  audit.use('*', requireAdminAuth);

  audit.get('/', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const page = parsePositiveInt(c.req.query('page'), PAGINATION_DEFAULTS.PAGE, 10_000);
    const limit = parsePositiveInt(
      c.req.query('limit'),
      PAGINATION_DEFAULTS.LIMIT,
      PAGINATION_DEFAULTS.MAX_LIMIT,
    );
    const action = c.req.query('action')?.trim() || undefined;
    const entityType = c.req.query('entityType')?.trim() || undefined;

    const { items, total } = await listAuditLogs(db, { page, limit, action, entityType });

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

  return audit;
}
