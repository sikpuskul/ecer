import type { AdminUserItem } from '../../../shared/schemas/admin';

interface AdminListRow {
  id: string;
  username: string;
  display_name: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapAdminRow(row: AdminListRow): AdminUserItem {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isActive: row.is_active === 1,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdmins(db: D1Database): Promise<AdminUserItem[]> {
  const result = await db
    .prepare(
      `SELECT id, username, display_name, is_active, last_login_at, created_at, updated_at
       FROM admins
       ORDER BY created_at ASC`,
    )
    .all<AdminListRow>();

  return (result.results ?? []).map(mapAdminRow);
}

export async function countActiveAdmins(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS count FROM admins WHERE is_active = 1`)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function findAdminItemById(db: D1Database, id: string): Promise<AdminUserItem | null> {
  const row = await db
    .prepare(
      `SELECT id, username, display_name, is_active, last_login_at, created_at, updated_at
       FROM admins
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(id)
    .first<AdminListRow>();
  return row ? mapAdminRow(row) : null;
}

export async function createAdminRecord(
  db: D1Database,
  params: {
    id: string;
    username: string;
    displayName: string;
    passwordHash: string;
    passwordAlgorithm: string;
    nowIso: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admins (id, username, display_name, password_hash, password_algorithm, is_active, last_login_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 1, NULL, ?6, ?6)`,
    )
    .bind(
      params.id,
      params.username,
      params.displayName,
      params.passwordHash,
      params.passwordAlgorithm,
      params.nowIso,
    )
    .run();
}

export async function updateAdminRecord(
  db: D1Database,
  params: {
    id: string;
    displayName: string;
    isActive: boolean;
    nowIso: string;
  },
): Promise<void> {
  const statements = [
    db
      .prepare(
        `UPDATE admins
         SET display_name = ?2, is_active = ?3, updated_at = ?4
         WHERE id = ?1`,
      )
      .bind(params.id, params.displayName, params.isActive ? 1 : 0, params.nowIso),
  ];

  if (!params.isActive) {
    statements.push(
      db
        .prepare(
          `UPDATE admin_sessions
           SET revoked_at = ?2
           WHERE admin_id = ?1 AND revoked_at IS NULL`,
        )
        .bind(params.id, params.nowIso),
    );
  }

  await db.batch(statements);
}

export async function resetAdminPasswordAndRevokeAllSessions(
  db: D1Database,
  params: {
    id: string;
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
      .bind(params.id, params.passwordHash, params.passwordAlgorithm, params.nowIso),
    db
      .prepare(
        `UPDATE admin_sessions
         SET revoked_at = ?2
         WHERE admin_id = ?1 AND revoked_at IS NULL`,
      )
      .bind(params.id, params.nowIso),
  ]);
}
