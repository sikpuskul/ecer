import type { SubmissionStatus } from '../../../shared/schemas/public';
import type { EventRow } from '../events/repository';

export interface ParticipantRow {
  id: string;
  event_id: string;
  form_version_id: string;
  unique_key_hash: string;
  search_key_hash: string;
  encrypted_data: string;
  email_encrypted: string | null;
  recovery_code_hash: string;
  submission_status: SubmissionStatus;
  consent_version: string;
  consented_at: string;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhitelistRow {
  id: string;
  event_id: string;
  whitelist_key_hash: string;
  encrypted_data: string;
  used_by_participant_id: string | null;
  created_at: string;
}

const PUBLIC_EVENT_SELECT = `
  SELECT e.id, e.category_id, c.name AS category_name, e.slug, e.event_code, e.title,
         e.description, e.organizer, e.location, e.flyer_key,
         e.event_start_at, e.event_end_at, e.publish_at,
         e.registration_start_at, e.registration_end_at,
         e.download_start_at, e.download_end_at, e.email_release_at,
         e.quota, e.attendance_mode, e.issuance_mode, e.lifecycle_status,
         e.unique_key_field, e.search_key_field, e.event_pin_hash,
         e.email_config_json, e.retention_config_json, e.created_at, e.updated_at,
         (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id AND p.submission_status NOT IN ('rejected', 'cancelled')) AS participant_count
  FROM events e
  LEFT JOIN event_categories c ON c.id = e.category_id
`;

export async function listPublicEventsInMonth(
  db: D1Database,
  params: {
    startUtcIso: string;
    endUtcIso: string;
    search?: string;
    categoryId?: string;
    page: number;
    limit: number;
  },
): Promise<{ rows: EventRow[]; total: number }> {
  const conditions = [
    `e.lifecycle_status != 'draft'`,
    `e.event_start_at < ?1`,
    `e.event_end_at >= ?2`,
  ];
  const binds: unknown[] = [params.endUtcIso, params.startUtcIso];

  if (params.search) {
    binds.push(`%${params.search}%`);
    conditions.push(`e.title LIKE ?${binds.length}`);
  }
  if (params.categoryId) {
    binds.push(params.categoryId);
    conditions.push(`e.category_id = ?${binds.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM events e ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `${PUBLIC_EVENT_SELECT}
       ${where}
       ORDER BY e.event_start_at DESC
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, params.limit, offset)
    .all<EventRow>();

  return {
    rows: rows.results ?? [],
    total: Number(countRow?.total ?? 0),
  };
}

export async function listAllPublicEventsInMonthForStats(
  db: D1Database,
  startUtcIso: string,
  endUtcIso: string,
): Promise<EventRow[]> {
  const rows = await db
    .prepare(
      `${PUBLIC_EVENT_SELECT}
       WHERE e.lifecycle_status != 'draft'
         AND e.event_start_at < ?1
         AND e.event_end_at >= ?2`,
    )
    .bind(endUtcIso, startUtcIso)
    .all<EventRow>();

  return rows.results ?? [];
}

export async function countMonthlyIssuedCertificates(
  db: D1Database,
  startUtcIso: string,
  endUtcIso: string,
): Promise<number> {
  // PRD §7.3: Count only certificates (NOT awards) with status 'ready' (not revoked) for events in selected month
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM documents d
       INNER JOIN events e ON e.id = d.event_id
       WHERE d.document_type = 'certificate'
         AND d.document_status = 'ready'
         AND e.lifecycle_status != 'draft'
         AND e.event_start_at < ?1
         AND e.event_end_at >= ?2`,
    )
    .bind(endUtcIso, startUtcIso)
    .first<{ count: number }>();

  return Number(row?.count ?? 0);
}

export async function findPublicEventBySlug(
  db: D1Database,
  slug: string,
): Promise<EventRow | null> {
  const row = await db
    .prepare(
      `${PUBLIC_EVENT_SELECT}
       WHERE e.slug = ?1 AND e.lifecycle_status != 'draft'
       LIMIT 1`,
    )
    .bind(slug)
    .first<EventRow>();

  return row ?? null;
}

export async function findUnusedWhitelistEntry(
  db: D1Database,
  eventId: string,
  whitelistKeyHash: string,
): Promise<WhitelistRow | null> {
  const row = await db
    .prepare(
      `SELECT id, event_id, whitelist_key_hash, encrypted_data, used_by_participant_id, created_at
       FROM event_whitelist
       WHERE event_id = ?1 AND whitelist_key_hash = ?2
       LIMIT 1`,
    )
    .bind(eventId, whitelistKeyHash)
    .first<WhitelistRow>();
  return row ?? null;
}

export async function countActiveParticipants(db: D1Database, eventId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM participants
       WHERE event_id = ?1 AND submission_status NOT IN ('rejected', 'cancelled')`,
    )
    .bind(eventId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function insertParticipantAndMarkWhitelist(
  db: D1Database,
  params: {
    id: string;
    eventId: string;
    formVersionId: string;
    uniqueKeyHash: string;
    searchKeyHash: string;
    encryptedData: string;
    emailEncrypted: string | null;
    recoveryCodeHash: string;
    submissionStatus: SubmissionStatus;
    consentVersion: string;
    nowIso: string;
    whitelistId?: string;
  },
): Promise<void> {
  const statements = [
    db
      .prepare(
        `INSERT INTO participants (
          id, event_id, form_version_id, unique_key_hash, search_key_hash,
          encrypted_data, email_encrypted, recovery_code_hash, submission_status,
          consent_version, consented_at, submitted_at, approved_by, approved_at,
          created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5,
          ?6, ?7, ?8, ?9,
          ?10, ?11, ?11, NULL, NULL,
          ?11, ?11
        )`,
      )
      .bind(
        params.id,
        params.eventId,
        params.formVersionId,
        params.uniqueKeyHash,
        params.searchKeyHash,
        params.encryptedData,
        params.emailEncrypted,
        params.recoveryCodeHash,
        params.submissionStatus,
        params.consentVersion,
        params.nowIso,
      ),
  ];

  if (params.whitelistId) {
    statements.push(
      db
        .prepare(
          `UPDATE event_whitelist
           SET used_by_participant_id = ?2
           WHERE id = ?1 AND used_by_participant_id IS NULL`,
        )
        .bind(params.whitelistId, params.id),
    );
  }

  await db.batch(statements);
}

export async function listParticipantsByEvent(
  db: D1Database,
  params: {
    eventId: string;
    status?: string;
    page: number;
    limit: number;
  },
): Promise<{ rows: ParticipantRow[]; total: number }> {
  const conditions = [`event_id = ?1`];
  const binds: unknown[] = [params.eventId];

  if (params.status) {
    binds.push(params.status);
    conditions.push(`submission_status = ?${binds.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM participants ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `SELECT id, event_id, form_version_id, unique_key_hash, search_key_hash,
              encrypted_data, email_encrypted, recovery_code_hash, submission_status,
              consent_version, consented_at, submitted_at, approved_by, approved_at,
              created_at, updated_at
       FROM participants
       ${where}
       ORDER BY submitted_at DESC
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, params.limit, offset)
    .all<ParticipantRow>();

  return {
    rows: rows.results ?? [],
    total: Number(countRow?.total ?? 0),
  };
}

export async function findParticipantById(
  db: D1Database,
  id: string,
): Promise<ParticipantRow | null> {
  const row = await db
    .prepare(
      `SELECT id, event_id, form_version_id, unique_key_hash, search_key_hash,
              encrypted_data, email_encrypted, recovery_code_hash, submission_status,
              consent_version, consented_at, submitted_at, approved_by, approved_at,
              created_at, updated_at
       FROM participants
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(id)
    .first<ParticipantRow>();
  return row ?? null;
}

export async function updateParticipantStatus(
  db: D1Database,
  params: {
    id: string;
    status: SubmissionStatus;
    adminId: string;
    nowIso: string;
  },
): Promise<void> {
  const approvedBy = params.status === 'approved' ? params.adminId : null;
  const approvedAt = params.status === 'approved' ? params.nowIso : null;

  await db
    .prepare(
      `UPDATE participants
       SET submission_status = ?2,
           approved_by = COALESCE(?3, approved_by),
           approved_at = COALESCE(?4, approved_at),
           updated_at = ?5
       WHERE id = ?1`,
    )
    .bind(params.id, params.status, approvedBy, approvedAt, params.nowIso)
    .run();
}

export async function listWhitelistByEvent(
  db: D1Database,
  eventId: string,
): Promise<WhitelistRow[]> {
  const res = await db
    .prepare(
      `SELECT id, event_id, whitelist_key_hash, encrypted_data, used_by_participant_id, created_at
       FROM event_whitelist
       WHERE event_id = ?1
       ORDER BY created_at DESC
       LIMIT 500`,
    )
    .bind(eventId)
    .all<WhitelistRow>();
  return res.results ?? [];
}

export async function insertWhitelistEntries(
  db: D1Database,
  entries: Array<{
    id: string;
    eventId: string;
    keyHash: string;
    encryptedData: string;
    nowIso: string;
  }>,
): Promise<void> {
  if (entries.length === 0) return;
  const statements = entries.map((entry) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO event_whitelist (id, event_id, whitelist_key_hash, encrypted_data, used_by_participant_id, created_at)
         VALUES (?1, ?2, ?3, ?4, NULL, ?5)`,
      )
      .bind(entry.id, entry.eventId, entry.keyHash, entry.encryptedData, entry.nowIso),
  );
  await db.batch(statements);
}
