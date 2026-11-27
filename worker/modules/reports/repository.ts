import type {
  AdminReportOverview,
  CategoryBreakdownItem,
  EventReportRow,
  MonthlyReportPoint,
  RetentionCleanupResult,
  RetentionDryRunSummary,
} from '../../../shared/schemas/reports';

const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

function getJakartaYearBoundsUtc(year: number): { startUtcIso: string; endUtcIso: string } {
  // 1 Jan 00:00 WIB = previous day 17:00 UTC
  const startUtcIso = new Date(Date.UTC(year, 0, 1, -7, 0, 0)).toISOString();
  const endUtcIso = new Date(Date.UTC(year + 1, 0, 1, -7, 0, 0)).toISOString();
  return { startUtcIso, endUtcIso };
}

function getJakartaMonthIndex(iso: string): number {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return -1;
  const wib = new Date(ts + 7 * 60 * 60 * 1000);
  return wib.getUTCMonth(); // 0..11
}

export async function getYearlyReportOverview(
  db: D1Database,
  year: number,
): Promise<AdminReportOverview> {
  const { startUtcIso, endUtcIso } = getJakartaYearBoundsUtc(year);

  const [eventRowsRes, participantRowsRes, docRowsRes, topEventsRes] = await Promise.all([
    db
      .prepare(
        `SELECT e.id, e.event_start_at, c.name AS category_name
         FROM events e
         INNER JOIN event_categories c ON c.id = e.category_id
         WHERE e.event_start_at >= ?1 AND e.event_start_at < ?2`,
      )
      .bind(startUtcIso, endUtcIso)
      .all<{ id: string; event_start_at: string; category_name: string }>(),
    db
      .prepare(
        `SELECT submitted_at FROM participants
         WHERE submitted_at >= ?1 AND submitted_at < ?2
           AND submission_status NOT IN ('rejected', 'cancelled')`,
      )
      .bind(startUtcIso, endUtcIso)
      .all<{ submitted_at: string }>(),
    db
      .prepare(
        `SELECT d.document_type, COALESCE(d.issued_at, d.created_at) AS ref_at,
                c.name AS category_name
         FROM documents d
         INNER JOIN events e ON e.id = d.event_id
         INNER JOIN event_categories c ON c.id = e.category_id
         WHERE d.document_status != 'revoked'
           AND COALESCE(d.issued_at, d.created_at) >= ?1
           AND COALESCE(d.issued_at, d.created_at) < ?2`,
      )
      .bind(startUtcIso, endUtcIso)
      .all<{ document_type: 'certificate' | 'award'; ref_at: string; category_name: string }>(),
    db
      .prepare(
        `SELECT e.id AS event_id, e.event_code, e.title, c.name AS category_name,
                e.event_start_at, e.lifecycle_status,
                (SELECT COUNT(*) FROM participants p
                 WHERE p.event_id = e.id AND p.submission_status NOT IN ('rejected', 'cancelled')) AS participant_count,
                (SELECT COUNT(*) FROM documents d
                 WHERE d.event_id = e.id AND d.document_type = 'certificate' AND d.document_status != 'revoked') AS certificate_count,
                (SELECT COUNT(*) FROM documents d
                 WHERE d.event_id = e.id AND d.document_type = 'award' AND d.document_status != 'revoked') AS award_count
         FROM events e
         INNER JOIN event_categories c ON c.id = e.category_id
         WHERE e.event_start_at >= ?1 AND e.event_start_at < ?2
         ORDER BY participant_count DESC, e.event_start_at DESC
         LIMIT 50`,
      )
      .bind(startUtcIso, endUtcIso)
      .all<{
        event_id: string;
        event_code: string;
        title: string;
        category_name: string;
        event_start_at: string;
        lifecycle_status: string;
        participant_count: number;
        certificate_count: number;
        award_count: number;
      }>(),
  ]);

  const monthlySeries: MonthlyReportPoint[] = MONTH_SHORT_ID.map((label, idx) => ({
    month: idx + 1,
    label,
    events: 0,
    participants: 0,
    certificatesIssued: 0,
    awardsIssued: 0,
  }));

  const categoryMap = new Map<string, CategoryBreakdownItem>();
  const ensureCat = (name: string): CategoryBreakdownItem => {
    let entry = categoryMap.get(name);
    if (!entry) {
      entry = { categoryName: name, eventCount: 0, certificateCount: 0, awardCount: 0 };
      categoryMap.set(name, entry);
    }
    return entry;
  };

  for (const ev of eventRowsRes.results ?? []) {
    const m = getJakartaMonthIndex(ev.event_start_at);
    if (m >= 0 && m < 12) monthlySeries[m]!.events += 1;
    ensureCat(ev.category_name).eventCount += 1;
  }

  for (const p of participantRowsRes.results ?? []) {
    const m = getJakartaMonthIndex(p.submitted_at);
    if (m >= 0 && m < 12) monthlySeries[m]!.participants += 1;
  }

  let totalCerts = 0;
  let totalAwards = 0;
  for (const doc of docRowsRes.results ?? []) {
    const m = getJakartaMonthIndex(doc.ref_at);
    const cat = ensureCat(doc.category_name);
    if (doc.document_type === 'award') {
      totalAwards += 1;
      if (m >= 0 && m < 12) monthlySeries[m]!.awardsIssued += 1;
      cat.awardCount += 1;
    } else {
      totalCerts += 1;
      if (m >= 0 && m < 12) monthlySeries[m]!.certificatesIssued += 1;
      cat.certificateCount += 1;
    }
  }

  const topEvents: EventReportRow[] = (topEventsRes.results ?? []).map((r) => ({
    eventId: r.event_id,
    eventCode: r.event_code,
    title: r.title,
    categoryName: r.category_name,
    eventStartAt: r.event_start_at,
    lifecycleStatus: r.lifecycle_status,
    participantCount: Number(r.participant_count ?? 0),
    certificateCount: Number(r.certificate_count ?? 0),
    awardCount: Number(r.award_count ?? 0),
  }));

  const categoryBreakdown = Array.from(categoryMap.values()).sort(
    (a, b) => b.eventCount - a.eventCount || b.certificateCount - a.certificateCount,
  );

  return {
    year,
    totals: {
      events: (eventRowsRes.results ?? []).length,
      participants: (participantRowsRes.results ?? []).length,
      certificatesIssued: totalCerts,
      awardsIssued: totalAwards,
    },
    monthlySeries,
    categoryBreakdown,
    topEvents,
  };
}

export async function getRetentionDryRunSummary(
  db: D1Database,
  supersededRetentionDays = 90,
): Promise<RetentionDryRunSummary> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const supersededCutoffIso = new Date(
    nowMs - supersededRetentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [sessions, grants, challenges, replays, superseded] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM admin_sessions
         WHERE expires_at <= ?1 OR revoked_at IS NOT NULL`,
      )
      .bind(nowIso)
      .first<{ cnt: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM download_grants
         WHERE expires_at <= ?1 OR revoked_at IS NOT NULL`,
      )
      .bind(nowIso)
      .first<{ cnt: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM verification_challenges
         WHERE expires_at <= ?1 OR consumed_at IS NOT NULL`,
      )
      .bind(nowIso)
      .first<{ cnt: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS cnt FROM integration_replays WHERE expires_at <= ?1`)
      .bind(nowIso)
      .first<{ cnt: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM document_revisions
         WHERE revision_status = 'superseded' AND created_at <= ?1`,
      )
      .bind(supersededCutoffIso)
      .first<{ cnt: number }>(),
  ]);

  return {
    checkedAt: nowIso,
    supersededRetentionDays,
    expiredSessions: Number(sessions?.cnt ?? 0),
    expiredDownloadGrants: Number(grants?.cnt ?? 0),
    expiredChallenges: Number(challenges?.cnt ?? 0),
    expiredReplays: Number(replays?.cnt ?? 0),
    oldSupersededRevisions: Number(superseded?.cnt ?? 0),
  };
}

/**
 * Safely deletes ONLY expired ephemeral security/session/replay records.
 * Never deletes business documents, participants, or Google Drive PDFs.
 */
export async function cleanupExpiredEphemeralRecords(
  db: D1Database,
): Promise<RetentionCleanupResult> {
  const nowIso = new Date().toISOString();

  const [sRes, gRes, cRes, rRes] = await Promise.all([
    db
      .prepare(`DELETE FROM admin_sessions WHERE expires_at <= ?1 OR revoked_at IS NOT NULL`)
      .bind(nowIso)
      .run(),
    db
      .prepare(`DELETE FROM download_grants WHERE expires_at <= ?1 OR revoked_at IS NOT NULL`)
      .bind(nowIso)
      .run(),
    db
      .prepare(
        `DELETE FROM verification_challenges WHERE expires_at <= ?1 OR consumed_at IS NOT NULL`,
      )
      .bind(nowIso)
      .run(),
    db.prepare(`DELETE FROM integration_replays WHERE expires_at <= ?1`).bind(nowIso).run(),
  ]);

  return {
    cleanedAt: nowIso,
    deletedSessions: Number(sRes.meta.changes ?? 0),
    deletedDownloadGrants: Number(gRes.meta.changes ?? 0),
    deletedChallenges: Number(cRes.meta.changes ?? 0),
    deletedReplays: Number(rRes.meta.changes ?? 0),
  };
}
