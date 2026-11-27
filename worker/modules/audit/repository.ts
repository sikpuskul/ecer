import type { AuditLogItem } from '../../../shared/schemas/admin';

interface AuditRow {
  id: string;
  admin_id: string | null;
  admin_username: string | null;
  actor_type: 'admin' | 'system' | 'public';
  action: string;
  entity_type: string;
  entity_id: string;
  change_summary_json: string;
  request_id: string;
  created_at: string;
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export async function listAuditLogs(
  db: D1Database,
  params: {
    page: number;
    limit: number;
    action?: string;
    entityType?: string;
  },
): Promise<{ items: AuditLogItem[]; total: number }> {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (params.action) {
    binds.push(params.action);
    conditions.push(`l.action = ?${binds.length}`);
  }
  if (params.entityType) {
    binds.push(params.entityType);
    conditions.push(`l.entity_type = ?${binds.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM audit_logs l ${whereClause}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `SELECT l.id, l.admin_id, a.username AS admin_username, l.actor_type,
              l.action, l.entity_type, l.entity_id, l.change_summary_json,
              l.request_id, l.created_at
       FROM audit_logs l
       LEFT JOIN admins a ON a.id = l.admin_id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, params.limit, offset)
    .all<AuditRow>();

  const items: AuditLogItem[] = (rows.results ?? []).map((row) => ({
    id: row.id,
    adminId: row.admin_id,
    adminUsername: row.admin_username,
    actorType: row.actor_type,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changeSummary: safeParseJson(row.change_summary_json),
    requestId: row.request_id,
    createdAt: row.created_at,
  }));

  return {
    items,
    total: Number(countRow?.total ?? 0),
  };
}
