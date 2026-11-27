import {
  EventEmailConfigSchema,
  EventRetentionConfigSchema,
  type AdminEventItem,
  type AttendanceMode,
  type EventLifecycleStatus,
  type IssuanceMode,
} from '../../../shared/schemas/events';
import { computeEventEligibility } from '../../../shared/utils/event-status';

export interface EventRow {
  id: string;
  category_id: string;
  category_name: string | null;
  slug: string;
  event_code: string;
  title: string;
  description: string;
  organizer: string;
  location: string;
  flyer_key: string | null;
  event_start_at: string;
  event_end_at: string;
  publish_at: string | null;
  registration_start_at: string | null;
  registration_end_at: string | null;
  download_start_at: string | null;
  download_end_at: string | null;
  email_release_at: string | null;
  quota: number | null;
  participant_count: number;
  attendance_mode: AttendanceMode;
  issuance_mode: IssuanceMode;
  lifecycle_status: EventLifecycleStatus;
  unique_key_field: string;
  search_key_field: string;
  event_pin_hash: string | null;
  email_config_json: string;
  retention_config_json: string;
  created_at: string;
  updated_at: string;
}

function parseJsonWithSchema<T>(raw: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...fallback, ...(parsed as Record<string, unknown>) };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function mapEventRow(row: EventRow): AdminEventItem {
  const defaultEmail = EventEmailConfigSchema.parse({});
  const defaultRetention = EventRetentionConfigSchema.parse({});
  const participantCount = Number(row.participant_count ?? 0);

  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? 'Lainnya',
    slug: row.slug,
    eventCode: row.event_code,
    title: row.title,
    description: row.description,
    organizer: row.organizer,
    location: row.location,
    flyerKey: row.flyer_key,
    flyerUrl: row.flyer_key ? `/api/v1/public/assets/${row.flyer_key}` : null,
    eventStartAt: row.event_start_at,
    eventEndAt: row.event_end_at,
    publishAt: row.publish_at,
    registrationStartAt: row.registration_start_at,
    registrationEndAt: row.registration_end_at,
    downloadStartAt: row.download_start_at,
    downloadEndAt: row.download_end_at,
    emailReleaseAt: row.email_release_at,
    quota: row.quota,
    participantCount,
    attendanceMode: row.attendance_mode,
    issuanceMode: row.issuance_mode,
    lifecycleStatus: row.lifecycle_status,
    uniqueKeyField: row.unique_key_field,
    searchKeyField: row.search_key_field,
    hasEventPin: Boolean(row.event_pin_hash),
    emailConfig: parseJsonWithSchema(row.email_config_json, defaultEmail),
    retentionConfig: parseJsonWithSchema(row.retention_config_json, defaultRetention),
    eligibility: computeEventEligibility({
      lifecycleStatus: row.lifecycle_status,
      registrationStartAt: row.registration_start_at,
      registrationEndAt: row.registration_end_at,
      downloadStartAt: row.download_start_at,
      downloadEndAt: row.download_end_at,
      quota: row.quota,
      participantCount,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EVENT_SELECT_SQL = `
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

export async function listEvents(
  db: D1Database,
  params: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    status?: string;
  },
): Promise<{ items: AdminEventItem[]; total: number }> {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (params.search) {
    binds.push(`%${params.search}%`);
    conditions.push(`(e.title LIKE ?${binds.length} OR e.event_code LIKE ?${binds.length})`);
  }
  if (params.categoryId) {
    binds.push(params.categoryId);
    conditions.push(`e.category_id = ?${binds.length}`);
  }
  if (params.status) {
    binds.push(params.status);
    conditions.push(`e.lifecycle_status = ?${binds.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM events e ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `${EVENT_SELECT_SQL}
       ${where}
       ORDER BY e.event_start_at DESC, e.created_at DESC
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, params.limit, offset)
    .all<EventRow>();

  return {
    items: (rows.results ?? []).map(mapEventRow),
    total: Number(countRow?.total ?? 0),
  };
}

export async function findEventRowById(db: D1Database, id: string): Promise<EventRow | null> {
  const row = await db
    .prepare(`${EVENT_SELECT_SQL} WHERE e.id = ?1 LIMIT 1`)
    .bind(id)
    .first<EventRow>();
  return row ?? null;
}

export async function findEventBySlugOrCode(
  db: D1Database,
  slug: string,
  eventCode: string,
  excludeId?: string,
): Promise<{ id: string; slug: string; event_code: string } | null> {
  const sql = excludeId
    ? `SELECT id, slug, event_code FROM events WHERE (slug = ?1 OR event_code = ?2) AND id != ?3 LIMIT 1`
    : `SELECT id, slug, event_code FROM events WHERE slug = ?1 OR event_code = ?2 LIMIT 1`;

  const stmt = excludeId
    ? db.prepare(sql).bind(slug, eventCode, excludeId)
    : db.prepare(sql).bind(slug, eventCode);

  const row = await stmt.first<{ id: string; slug: string; event_code: string }>();
  return row ?? null;
}

export async function insertEventRecord(
  db: D1Database,
  params: {
    id: string;
    categoryId: string;
    slug: string;
    eventCode: string;
    title: string;
    description: string;
    organizer: string;
    location: string;
    flyerKey: string | null;
    eventStartAt: string;
    eventEndAt: string;
    registrationStartAt: string | null;
    registrationEndAt: string | null;
    downloadStartAt: string | null;
    downloadEndAt: string | null;
    emailReleaseAt: string | null;
    quota: number | null;
    attendanceMode: AttendanceMode;
    issuanceMode: IssuanceMode;
    uniqueKeyField: string;
    searchKeyField: string;
    eventPinHash: string | null;
    emailConfigJson: string;
    retentionConfigJson: string;
    adminId: string;
    nowIso: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO events (
        id, category_id, slug, event_code, title, description, organizer, location, flyer_key,
        event_start_at, event_end_at, publish_at, registration_start_at, registration_end_at,
        download_start_at, download_end_at, email_release_at, quota,
        attendance_mode, issuance_mode, lifecycle_status, unique_key_field, search_key_field,
        event_pin_hash, email_config_json, retention_config_json,
        created_by, updated_by, created_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
        ?10, ?11, NULL, ?12, ?13,
        ?14, ?15, ?16, ?17,
        ?18, ?19, 'draft', ?20, ?21,
        ?22, ?23, ?24,
        ?25, ?25, ?26, ?26
      )`,
    )
    .bind(
      params.id,
      params.categoryId,
      params.slug,
      params.eventCode,
      params.title,
      params.description,
      params.organizer,
      params.location,
      params.flyerKey,
      params.eventStartAt,
      params.eventEndAt,
      params.registrationStartAt,
      params.registrationEndAt,
      params.downloadStartAt,
      params.downloadEndAt,
      params.emailReleaseAt,
      params.quota,
      params.attendanceMode,
      params.issuanceMode,
      params.uniqueKeyField,
      params.searchKeyField,
      params.eventPinHash,
      params.emailConfigJson,
      params.retentionConfigJson,
      params.adminId,
      params.nowIso,
    )
    .run();
}

export async function updateEventRecord(
  db: D1Database,
  params: {
    id: string;
    categoryId: string;
    slug: string;
    eventCode: string;
    title: string;
    description: string;
    organizer: string;
    location: string;
    flyerKey: string | null;
    eventStartAt: string;
    eventEndAt: string;
    registrationStartAt: string | null;
    registrationEndAt: string | null;
    downloadStartAt: string | null;
    downloadEndAt: string | null;
    emailReleaseAt: string | null;
    quota: number | null;
    attendanceMode: AttendanceMode;
    issuanceMode: IssuanceMode;
    uniqueKeyField: string;
    searchKeyField: string;
    eventPinHash: string | null;
    emailConfigJson: string;
    retentionConfigJson: string;
    adminId: string;
    nowIso: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE events SET
        category_id = ?2, slug = ?3, event_code = ?4, title = ?5,
        description = ?6, organizer = ?7, location = ?8, flyer_key = ?9,
        event_start_at = ?10, event_end_at = ?11,
        registration_start_at = ?12, registration_end_at = ?13,
        download_start_at = ?14, download_end_at = ?15, email_release_at = ?16,
        quota = ?17, attendance_mode = ?18, issuance_mode = ?19,
        unique_key_field = ?20, search_key_field = ?21, event_pin_hash = ?22,
        email_config_json = ?23, retention_config_json = ?24,
        updated_by = ?25, updated_at = ?26
      WHERE id = ?1`,
    )
    .bind(
      params.id,
      params.categoryId,
      params.slug,
      params.eventCode,
      params.title,
      params.description,
      params.organizer,
      params.location,
      params.flyerKey,
      params.eventStartAt,
      params.eventEndAt,
      params.registrationStartAt,
      params.registrationEndAt,
      params.downloadStartAt,
      params.downloadEndAt,
      params.emailReleaseAt,
      params.quota,
      params.attendanceMode,
      params.issuanceMode,
      params.uniqueKeyField,
      params.searchKeyField,
      params.eventPinHash,
      params.emailConfigJson,
      params.retentionConfigJson,
      params.adminId,
      params.nowIso,
    )
    .run();
}

export async function updateEventLifecycle(
  db: D1Database,
  params: {
    id: string;
    lifecycleStatus: EventLifecycleStatus;
    publishAt?: string | null;
    adminId: string;
    nowIso: string;
  },
): Promise<void> {
  if (params.publishAt !== undefined) {
    await db
      .prepare(
        `UPDATE events
         SET lifecycle_status = ?2, publish_at = ?3, updated_by = ?4, updated_at = ?5
         WHERE id = ?1`,
      )
      .bind(params.id, params.lifecycleStatus, params.publishAt, params.adminId, params.nowIso)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE events
         SET lifecycle_status = ?2, updated_by = ?3, updated_at = ?4
         WHERE id = ?1`,
      )
      .bind(params.id, params.lifecycleStatus, params.adminId, params.nowIso)
      .run();
  }
}

export async function countEventParticipantsAndDocuments(
  db: D1Database,
  eventId: string,
): Promise<{ participants: number; documents: number }> {
  const [pRow, dRow] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS count FROM participants WHERE event_id = ?1`)
      .bind(eventId)
      .first<{ count: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS count FROM documents WHERE event_id = ?1`)
      .bind(eventId)
      .first<{ count: number }>(),
  ]);
  return {
    participants: Number(pRow?.count ?? 0),
    documents: Number(dRow?.count ?? 0),
  };
}

export async function countEventsUsingFlyerKey(
  db: D1Database,
  flyerKey: string,
  excludeEventId: string,
): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS count FROM events WHERE flyer_key = ?1 AND id != ?2`)
    .bind(flyerKey, excludeEventId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function deleteEventRecord(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM events WHERE id = ?1`).bind(id).run();
}
