import { Hono } from 'hono';
import { buildSafeCsv } from '../../../shared/utils/csv-export';
import { formatJakartaDate, getCurrentJakartaMonthYear } from '../../../shared/utils/jakarta-date';
import type { AppEnv } from '../../env';
import { requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { insertAuditLog } from '../auth/repository';
import {
  cleanupExpiredEphemeralRecords,
  getRetentionDryRunSummary,
  getYearlyReportOverview,
} from './repository';

function parseYear(raw?: string): number {
  const fallback = getCurrentJakartaMonthYear().year;
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 2020 || parsed > 2100) return fallback;
  return parsed;
}

export function createAdminReportsRoutes() {
  const routes = new Hono<AppEnv>();

  routes.use('*', requireAdminAuth);

  routes.get('/overview', async (c) => {
    const requestId = c.get('requestId');
    const year = parseYear(c.req.query('year'));
    const data = await getYearlyReportOverview(c.env.DB!, year);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data, requestId }, 200);
  });

  routes.get('/export.csv', async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');
    const year = parseYear(c.req.query('year'));

    const report = await getYearlyReportOverview(db, year);
    const csv = buildSafeCsv(
      [
        'Kode Kegiatan',
        'Judul Kegiatan',
        'Kategori',
        'Tanggal Mulai (WIB)',
        'Status',
        'Jumlah Peserta',
        'Sertifikat Terbit',
        'Piagam Terbit',
      ],
      report.topEvents.map((ev) => [
        ev.eventCode,
        ev.title,
        ev.categoryName,
        formatJakartaDate(ev.eventStartAt),
        ev.lifecycleStatus,
        ev.participantCount,
        ev.certificateCount,
        ev.awardCount,
      ]),
    );

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'report.export_csv',
      entityType: 'report',
      entityId: String(year),
      changeSummary: { year, rowCount: report.topEvents.length },
      requestId,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="laporan-ecer-${year}.csv"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    });
  });

  routes.get('/retention/dry-run', async (c) => {
    const requestId = c.get('requestId');
    const summary = await getRetentionDryRunSummary(c.env.DB!, 90);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true as const, data: summary, requestId }, 200);
  });

  routes.post('/retention/cleanup', csrfOriginMiddleware, async (c) => {
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    const result = await cleanupExpiredEphemeralRecords(db);

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'retention.cleanup_ephemeral',
      entityType: 'system',
      entityId: 'ephemeral_records',
      changeSummary: {
        deletedSessions: result.deletedSessions,
        deletedDownloadGrants: result.deletedDownloadGrants,
        deletedChallenges: result.deletedChallenges,
        deletedReplays: result.deletedReplays,
      },
      requestId,
    });

    return c.json({ success: true as const, data: result, requestId }, 200);
  });

  return routes;
}
