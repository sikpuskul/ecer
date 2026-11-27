import type { AdminDashboardSummary, AuditLogItem } from '../../../shared/schemas/admin';
import { listAuditLogs } from '../audit/repository';

async function safeCount(db: D1Database, sql: string): Promise<number> {
  try {
    const row = await db.prepare(sql).first<{ count: number }>();
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function getAdminDashboardData(db: D1Database): Promise<{
  summary: AdminDashboardSummary;
  recentActivities: AuditLogItem[];
}> {
  const [
    totalEvents,
    activeEvents,
    totalParticipants,
    pendingApprovals,
    certificatesIssued,
    awardsIssued,
    failedGenerationJobs,
    pendingOrFailedEmails,
    activeAdmins,
    activeCategories,
    recentAudit,
  ] = await Promise.all([
    safeCount(db, `SELECT COUNT(*) AS count FROM events`),
    safeCount(db, `SELECT COUNT(*) AS count FROM events WHERE lifecycle_status = 'published'`),
    safeCount(db, `SELECT COUNT(*) AS count FROM participants`),
    safeCount(
      db,
      `SELECT COUNT(*) AS count FROM participants WHERE submission_status = 'pending_review'`,
    ),
    safeCount(
      db,
      `SELECT COUNT(*) AS count FROM documents WHERE document_type = 'certificate' AND document_status = 'ready'`,
    ),
    safeCount(
      db,
      `SELECT COUNT(*) AS count FROM documents WHERE document_type = 'award' AND document_status = 'ready'`,
    ),
    safeCount(
      db,
      `SELECT COUNT(*) AS count FROM generation_jobs WHERE job_status IN ('failed', 'needs_review')`,
    ),
    safeCount(
      db,
      `SELECT COUNT(*) AS count FROM email_jobs WHERE job_status IN ('queued', 'retry_wait', 'deferred_quota', 'failed', 'needs_review')`,
    ),
    safeCount(db, `SELECT COUNT(*) AS count FROM admins WHERE is_active = 1`),
    safeCount(db, `SELECT COUNT(*) AS count FROM event_categories WHERE is_active = 1`),
    listAuditLogs(db, { page: 1, limit: 8 }),
  ]);

  return {
    summary: {
      totalEvents,
      activeEvents,
      totalParticipants,
      pendingApprovals,
      certificatesIssued,
      awardsIssued,
      failedGenerationJobs,
      pendingOrFailedEmails,
      activeAdmins,
      activeCategories,
    },
    recentActivities: recentAudit.items,
  };
}
