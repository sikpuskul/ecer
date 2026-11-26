import type { AdminRow, AuditLogInput, SessionWithAdminRow } from './types';

export async function findAdminByUsername(
  db: D1Database,
  username: string,
): Promise<AdminRow | null> {
  const row = await db
    .prepare(
      `SELECT id, username, display_name, password_hash, password_algorithm,
              is_active, last_login_at, created_at, updated_at
       FROM admins
       WHERE lower(username) = lower(?1)
       LIMIT 1`,
    )
    .bind(username)
    .first<AdminRow>();

  return row ?? null;
}

export async function findAdminById(db: D1Database, adminId: string): Promise<AdminRow | null> {
  const row = await db
    .prepare(
      `SELECT id, username, display_name, password_hash, password_algorithm,
              is_active, last_login_at, created_at, updated_at
       FROM admins
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(adminId)
    .first<AdminRow>();

  return row ?? null;
}

export async function createAdminSession(
  db: D1Database,
  params: {
    id: string;
    adminId: string;
    tokenHash: string;
    expiresAt: string;
    nowIso: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_sessions (id, admin_id, token_hash, expires_at, last_activity_at, revoked_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?5)`,
    )
    .bind(params.id, params.adminId, params.tokenHash, params.expiresAt, params.nowIso)
    .run();
}

export async function updateAdminLastLogin(
  db: D1Database,
  adminId: string,
  nowIso: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE admins
       SET last_login_at = ?2, updated_at = ?2
       WHERE id = ?1`,
    )
    .bind(adminId, nowIso)
    .run();
}

export async function findActiveSessionByTokenHash(
  db: D1Database,
  tokenHash: string,
): Promise<SessionWithAdminRow | null> {
  const row = await db
    .prepare(
      `SELECT s.id AS session_id,
              s.admin_id,
              s.expires_at,
              s.last_activity_at,
              s.revoked_at,
              a.username,
              a.display_name,
              a.is_active,
              a.last_login_at
       FROM admin_sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?1
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<SessionWithAdminRow>();

  return row ?? null;
}

export async function touchSessionActivity(
  db: D1Database,
  sessionId: string,
  nowIso: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE admin_sessions
       SET last_activity_at = ?2
       WHERE id = ?1 AND revoked_at IS NULL`,
    )
    .bind(sessionId, nowIso)
    .run();
}

export async function revokeSessionById(
  db: D1Database,
  sessionId: string,
  nowIso: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE admin_sessions
       SET revoked_at = ?2
       WHERE id = ?1 AND revoked_at IS NULL`,
    )
    .bind(sessionId, nowIso)
    .run();
}

export async function updateAdminPasswordAndRevokeOtherSessions(
  db: D1Database,
  params: {
    adminId: string;
    currentSessionId: string;
    passwordHash: string;
    passwordAlgorithm: string;
    nowIso: string;
  },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE admins
         SET password_hash = ?2, password_algorithm = ?3, updated_at = ?4
         WHERE id = ?1`,
      )
      .bind(params.adminId, params.passwordHash, params.passwordAlgorithm, params.nowIso),
    db
      .prepare(
        `UPDATE admin_sessions
         SET revoked_at = ?3
         WHERE admin_id = ?1 AND id != ?2 AND revoked_at IS NULL`,
      )
      .bind(params.adminId, params.currentSessionId, params.nowIso),
  ]);
}

export async function insertAuditLog(db: D1Database, input: AuditLogInput): Promise<void> {
  const nowIso = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO audit_logs (id, admin_id, actor_type, action, entity_type, entity_id, change_summary_json, request_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      crypto.randomUUID(),
      input.adminId,
      input.actorType,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.changeSummary ?? {}),
      input.requestId,
      nowIso,
    )
    .run();
}
