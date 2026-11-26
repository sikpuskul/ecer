import { describe, expect, it } from 'vitest';
import { createApp } from '@worker/app';
import { hashPassword } from '@worker/security/password';

interface AdminRecord {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_algorithm: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRecord {
  id: string;
  admin_id: string;
  token_hash: string;
  expires_at: string;
  last_activity_at: string;
  revoked_at: string | null;
  created_at: string;
}

/**
 * Lightweight in-memory D1 test double covering Phase 1 auth repository SQL queries.
 */
function createInMemoryAuthDb(initialAdmins: AdminRecord[]) {
  const admins = new Map<string, AdminRecord>(initialAdmins.map((a) => [a.id, { ...a }]));
  const sessions = new Map<string, SessionRecord>();
  const auditLogs: Array<Record<string, unknown>> = [];

  function executeStatement(sql: string, params: unknown[]) {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (
      normalized.startsWith('SELECT id, username, display_name, password_hash') &&
      normalized.includes('lower(username)')
    ) {
      const target = String(params[0] ?? '').toLowerCase();
      for (const admin of admins.values()) {
        if (admin.username.toLowerCase() === target) return { first: { ...admin } };
      }
      return { first: null };
    }

    if (
      normalized.startsWith('SELECT id, username, display_name, password_hash') &&
      normalized.includes('WHERE id = ?1')
    ) {
      const admin = admins.get(String(params[0] ?? ''));
      return { first: admin ? { ...admin } : null };
    }

    if (normalized.startsWith('INSERT INTO admin_sessions')) {
      const [id, admin_id, token_hash, expires_at, nowIso] = params as string[];
      sessions.set(id!, {
        id: id!,
        admin_id: admin_id!,
        token_hash: token_hash!,
        expires_at: expires_at!,
        last_activity_at: nowIso!,
        revoked_at: null,
        created_at: nowIso!,
      });
      return { first: null };
    }

    if (normalized.startsWith('UPDATE admins SET last_login_at')) {
      const [adminId, nowIso] = params as string[];
      const admin = admins.get(adminId!);
      if (admin) {
        admin.last_login_at = nowIso!;
        admin.updated_at = nowIso!;
      }
      return { first: null };
    }

    if (normalized.startsWith('SELECT s.id AS session_id')) {
      const tokenHash = String(params[0] ?? '');
      for (const s of sessions.values()) {
        if (s.token_hash === tokenHash) {
          const a = admins.get(s.admin_id);
          if (!a) return { first: null };
          return {
            first: {
              session_id: s.id,
              admin_id: s.admin_id,
              expires_at: s.expires_at,
              last_activity_at: s.last_activity_at,
              revoked_at: s.revoked_at,
              username: a.username,
              display_name: a.display_name,
              is_active: a.is_active,
              last_login_at: a.last_login_at,
            },
          };
        }
      }
      return { first: null };
    }

    if (normalized.startsWith('UPDATE admin_sessions SET last_activity_at')) {
      const [sessionId, nowIso] = params as string[];
      const s = sessions.get(sessionId!);
      if (s && s.revoked_at === null) {
        s.last_activity_at = nowIso!;
      }
      return { first: null };
    }

    if (normalized.startsWith('UPDATE admin_sessions SET revoked_at = ?2 WHERE id = ?1')) {
      const [sessionId, nowIso] = params as string[];
      const s = sessions.get(sessionId!);
      if (s && s.revoked_at === null) {
        s.revoked_at = nowIso!;
      }
      return { first: null };
    }

    if (normalized.startsWith('UPDATE admins SET password_hash')) {
      const [adminId, passwordHash, passwordAlgorithm, nowIso] = params as string[];
      const a = admins.get(adminId!);
      if (a) {
        a.password_hash = passwordHash!;
        a.password_algorithm = passwordAlgorithm!;
        a.updated_at = nowIso!;
      }
      return { first: null };
    }

    if (
      normalized.startsWith(
        'UPDATE admin_sessions SET revoked_at = ?3 WHERE admin_id = ?1 AND id != ?2',
      )
    ) {
      const [adminId, currentSessionId, nowIso] = params as string[];
      for (const s of sessions.values()) {
        if (s.admin_id === adminId && s.id !== currentSessionId && s.revoked_at === null) {
          s.revoked_at = nowIso!;
        }
      }
      return { first: null };
    }

    if (normalized.startsWith('INSERT INTO audit_logs')) {
      auditLogs.push({ action: params[3], entityType: params[4], entityId: params[5] });
      return { first: null };
    }

    throw new Error(`Unhandled SQL in test double: ${normalized}`);
  }

  function makePrepared(sql: string, boundParams: unknown[] = []) {
    return {
      _sql: sql,
      _params: boundParams,
      bind(...args: unknown[]) {
        return makePrepared(sql, args);
      },
      async first<T>() {
        return executeStatement(sql, boundParams).first as T | null;
      },
      async run() {
        executeStatement(sql, boundParams);
        return { success: true };
      },
    };
  }

  const db = {
    prepare(sql: string) {
      return makePrepared(sql);
    },
    async batch(statements: Array<{ _sql: string; _params: unknown[] }>) {
      return statements.map((st) => {
        executeStatement(st._sql, st._params);
        return { success: true };
      });
    },
  } as unknown as D1Database;

  return { db, sessions, auditLogs };
}

function extractCookiePair(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0] ?? '';
}

describe('Phase 1 — Admin Session Authentication & CSRF Protection', () => {
  it('supports login, /auth/me, CSRF protection, change-password session revocation, and logout', async () => {
    const initialPassword = 'rahasia-admin-puskesmas-2026';
    const hashed = await hashPassword(initialPassword);
    const nowIso = new Date().toISOString();

    const { db, sessions, auditLogs } = createInMemoryAuthDb([
      {
        id: 'admin-1',
        username: 'admin_pkm',
        display_name: 'Admin Puskesmas',
        password_hash: hashed.hash,
        password_algorithm: hashed.algorithm,
        is_active: 1,
        last_login_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    const app = createApp();
    const env = {
      DB: db,
      APP_ENV: 'test',
      APP_BASE_URL: 'http://localhost:5173',
    };

    // 1. Login with invalid Origin rejected (CSRF)
    const csrfRes = await app.request(
      'http://localhost:5173/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example.com',
        },
        body: JSON.stringify({ username: 'admin_pkm', password: initialPassword }),
      },
      env,
    );
    expect(csrfRes.status).toBe(403);

    // 2. Login #1 succeeds & sets HttpOnly cookie
    const loginRes1 = await app.request(
      'http://localhost:5173/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ username: 'admin_pkm', password: initialPassword }),
      },
      env,
    );
    expect(loginRes1.status).toBe(200);
    const setCookie1 = loginRes1.headers.get('set-cookie');
    expect(setCookie1).toContain('HttpOnly');
    expect(setCookie1).toContain('SameSite=Lax');
    const cookie1 = extractCookiePair(setCookie1);

    // 3. Login #2 creates a second active session
    const loginRes2 = await app.request(
      'http://localhost:5173/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ username: 'admin_pkm', password: initialPassword }),
      },
      env,
    );
    const cookie2 = extractCookiePair(loginRes2.headers.get('set-cookie'));
    expect(sessions.size).toBe(2);

    // 4. GET /auth/me works with cookie2
    const meRes = await app.request(
      'http://localhost:5173/api/v1/auth/me',
      {
        method: 'GET',
        headers: { Cookie: cookie2 },
      },
      env,
    );
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as { data: { admin: { username: string } } };
    expect(meJson.data.admin.username).toBe('admin_pkm');

    // 5. Change password via session #2 revokes session #1
    const newPassword = 'frasa-baru-admin-puskesmas-2027';
    const changeRes = await app.request(
      'http://localhost:5173/api/v1/auth/change-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: cookie2,
        },
        body: JSON.stringify({ currentPassword: initialPassword, newPassword }),
      },
      env,
    );
    expect(changeRes.status).toBe(200);

    // Session #1 must now be unauthorized
    const meRevokedRes = await app.request(
      'http://localhost:5173/api/v1/auth/me',
      {
        method: 'GET',
        headers: { Cookie: cookie1 },
      },
      env,
    );
    expect(meRevokedRes.status).toBe(401);

    // 6. Logout revokes session #2
    const logoutRes = await app.request(
      'http://localhost:5173/api/v1/auth/logout',
      {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          Cookie: cookie2,
        },
      },
      env,
    );
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await app.request(
      'http://localhost:5173/api/v1/auth/me',
      {
        method: 'GET',
        headers: { Cookie: cookie2 },
      },
      env,
    );
    expect(meAfterLogout.status).toBe(401);
    expect(auditLogs.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects idle-expired admin sessions (>30 minutes)', async () => {
    const initialPassword = 'rahasia-admin-puskesmas-2026';
    const hashed = await hashPassword(initialPassword);
    const nowIso = new Date().toISOString();

    const { db, sessions } = createInMemoryAuthDb([
      {
        id: 'admin-idle',
        username: 'admin_idle',
        display_name: 'Admin Idle',
        password_hash: hashed.hash,
        password_algorithm: hashed.algorithm,
        is_active: 1,
        last_login_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    const app = createApp();
    const env = { DB: db, APP_ENV: 'test', APP_BASE_URL: 'http://localhost:5173' };

    const loginRes = await app.request(
      'http://localhost:5173/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ username: 'admin_idle', password: initialPassword }),
      },
      env,
    );
    const cookie = extractCookiePair(loginRes.headers.get('set-cookie'));

    // Simulate 31 minutes of inactivity
    for (const s of sessions.values()) {
      s.last_activity_at = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    }

    const meRes = await app.request(
      'http://localhost:5173/api/v1/auth/me',
      { method: 'GET', headers: { Cookie: cookie } },
      env,
    );
    expect(meRes.status).toBe(401);
  });
});
