import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { getAdminDashboardData } from './repository';

export function createDashboardRoutes() {
  const dashboard = new Hono<AppEnv>();

  dashboard.use('*', requireAdminAuth);

  dashboard.get('/', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const data = await getAdminDashboardData(db);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data, requestId }, 200);
  });

  return dashboard;
}
