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

interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  is_active: number;
  created_at: string;
}

interface AuditRecord {
  id: string;
  admin_id: string | null;
  actor_type: 'admin' | 'system' | 'public';
  action: string;
  entity_type: string;
  entity_id: string;
  change_summary_json: string;
  request_id: string;
  created_at: string;
}

function createCoreAdminDb(initialAdmins: AdminRecord[]) {
  const admins = new Map<string, AdminRecord>(initialAdmins.map((a) => [a.id, { ...a }]));
  const sessions = new Map<string, SessionRecord>();
  const categories = new Map<string, CategoryRecord>([
    [
      'cat-pelatihan',
      {
        id: 'cat-pelatihan',
        name: 'Pelatihan',
        slug: 'pelatihan',
        is_active: 1,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  ]);
  const settings = new Map<string, string>([
    ['organization_name', 'Puskesmas Sumbermanjing Kulon'],
    ['organization_code', 'PKM-SMK'],
  ]);
  const auditLogs: AuditRecord[] = [];

  function runSql(sql: string, params: unknown[]) {
    const q = sql.replace(/\s+/g, ' ').trim();

    if (
      q.startsWith('SELECT id, username, display_name, password_hash') &&
      q.includes('lower(username)')
    ) {
      const target = String(params[0] ?? '').toLowerCase();
      for (const a of admins.values()) {
        if (a.username.toLowerCase() === target) return { first: { ...a }, results: [] };
      }
      return { first: null, results: [] };
    }

    if (
      q.startsWith('SELECT id, username, display_name, is_active') &&
      q.includes('ORDER BY created_at')
    ) {
      return { first: null, results: Array.from(admins.values()) };
    }

    if (
      q.startsWith('SELECT id, username, display_name, is_active') &&
      q.includes('WHERE id = ?1')
    ) {
      const a = admins.get(String(params[0] ?? ''));
      return { first: a ? { ...a } : null, results: [] };
    }

    if (q.startsWith('SELECT COUNT(*) AS count FROM admins WHERE is_active = 1')) {
      const count = Array.from(admins.values()).filter((a) => a.is_active === 1).length;
      return { first: { count }, results: [] };
    }

    if (q.startsWith('INSERT INTO admins')) {
      const [id, username, display_name, password_hash, password_algorithm, nowIso] =
        params as string[];
      admins.set(id!, {
        id: id!,
        username: username!,
        display_name: display_name!,
        password_hash: password_hash!,
        password_algorithm: password_algorithm!,
        is_active: 1,
        last_login_at: null,
        created_at: nowIso!,
        updated_at: nowIso!,
      });
      return { first: null, results: [] };
    }

    if (q.startsWith('UPDATE admins SET display_name')) {
      const [id, display_name, is_active, nowIso] = params as [string, string, number, string];
      const a = admins.get(id);
      if (a) {
        a.display_name = display_name;
        a.is_active = is_active;
        a.updated_at = nowIso;
      }
      return { first: null, results: [] };
    }

    if (q.startsWith('UPDATE admins SET last_login_at')) {
      const [id, nowIso] = params as [string, string];
      const a = admins.get(id);
      if (a) a.last_login_at = nowIso;
      return { first: null, results: [] };
    }

    if (q.startsWith('UPDATE admins SET password_hash')) {
      const [id, hash, alg, nowIso] = params as [string, string, string, string];
      const a = admins.get(id);
      if (a) {
        a.password_hash = hash;
        a.password_algorithm = alg;
        a.updated_at = nowIso;
      }
      return { first: null, results: [] };
    }

    if (q.startsWith('INSERT INTO admin_sessions')) {
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
      return { first: null, results: [] };
    }

    if (q.startsWith('SELECT s.id AS session_id')) {
      const tokenHash = String(params[0] ?? '');
      for (const s of sessions.values()) {
        if (s.token_hash === tokenHash) {
          const a = admins.get(s.admin_id);
          if (!a) return { first: null, results: [] };
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
            results: [],
          };
        }
      }
      return { first: null, results: [] };
    }

    if (q.startsWith('UPDATE admin_sessions SET last_activity_at')) {
      const [id, nowIso] = params as [string, string];
      const s = sessions.get(id);
      if (s && s.revoked_at === null) s.last_activity_at = nowIso;
      return { first: null, results: [] };
    }

    if (q.startsWith('UPDATE admin_sessions SET revoked_at = ?2 WHERE admin_id = ?1')) {
      const [adminId, nowIso] = params as [string, string];
      for (const s of sessions.values()) {
        if (s.admin_id === adminId && s.revoked_at === null) s.revoked_at = nowIso;
      }
      return { first: null, results: [] };
    }

    if (q.startsWith('SELECT setting_key, setting_value FROM app_settings')) {
      return {
        first: null,
        results: Array.from(settings.entries()).map(([setting_key, setting_value]) => ({
          setting_key,
          setting_value,
        })),
      };
    }

    if (q.startsWith('INSERT INTO app_settings')) {
      const [key, value] = params as [string, string];
      settings.set(key, value);
      return { first: null, results: [] };
    }

    if (
      q.startsWith('SELECT id, name, slug, is_active, created_at FROM event_categories ORDER BY')
    ) {
      return { first: null, results: Array.from(categories.values()) };
    }

    if (
      q.startsWith('SELECT id, name, slug, is_active, created_at FROM event_categories WHERE slug')
    ) {
      const slug = String(params[0] ?? '');
      for (const c of categories.values()) {
        if (c.slug === slug) return { first: { ...c }, results: [] };
      }
      return { first: null, results: [] };
    }

    if (
      q.startsWith('SELECT id, name, slug, is_active, created_at FROM event_categories WHERE id')
    ) {
      const c = categories.get(String(params[0] ?? ''));
      return { first: c ? { ...c } : null, results: [] };
    }

    if (q.startsWith('INSERT INTO event_categories')) {
      const [id, name, slug, nowIso] = params as [string, string, string, string];
      categories.set(id, { id, name, slug, is_active: 1, created_at: nowIso });
      return { first: null, results: [] };
    }

    if (q.startsWith('UPDATE event_categories')) {
      const [id, name, is_active] = params as [string, string, number];
      const c = categories.get(id);
      if (c) {
        c.name = name;
        c.is_active = is_active;
      }
      return { first: null, results: [] };
    }

    if (q.startsWith('INSERT INTO audit_logs')) {
      const [
        id,
        admin_id,
        actor_type,
        action,
        entity_type,
        entity_id,
        summary,
        request_id,
        created_at,
      ] = params as [
        string,
        string | null,
        'admin' | 'system' | 'public',
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      auditLogs.unshift({
        id,
        admin_id,
        actor_type,
        action,
        entity_type,
        entity_id,
        change_summary_json: summary,
        request_id,
        created_at,
      });
      return { first: null, results: [] };
    }

    if (q.startsWith('SELECT COUNT(*) AS total FROM audit_logs')) {
      return { first: { total: auditLogs.length }, results: [] };
    }

    if (q.startsWith('SELECT l.id, l.admin_id')) {
      return {
        first: null,
        results: auditLogs.map((l) => ({
          ...l,
          admin_username: l.admin_id ? (admins.get(l.admin_id)?.username ?? null) : null,
        })),
      };
    }

    if (q.startsWith('SELECT COUNT(*) AS count FROM event_categories')) {
      return {
        first: { count: Array.from(categories.values()).filter((c) => c.is_active === 1).length },
        results: [],
      };
    }

    if (q.startsWith('SELECT COUNT(*) AS count FROM')) {
      return { first: { count: 0 }, results: [] };
    }

    throw new Error(`Unhandled SQL in core-admin test double: ${q}`);
  }

  function makePrepared(sql: string, boundParams: unknown[] = []) {
    return {
      _sql: sql,
      _params: boundParams,
      bind(...args: unknown[]) {
        return makePrepared(sql, args);
      },
      async first<T>() {
        return runSql(sql, boundParams).first as T | null;
      },
      async all<T>() {
        return { results: runSql(sql, boundParams).results as T[] };
      },
      async run() {
        runSql(sql, boundParams);
        return { success: true };
      },
    };
  }

  return {
    db: {
      prepare(sql: string) {
        return makePrepared(sql);
      },
      async batch(statements: Array<{ _sql: string; _params: unknown[] }>) {
        return statements.map((st) => {
          runSql(st._sql, st._params);
          return { success: true };
        });
      },
    } as unknown as D1Database,
    auditLogs,
  };
}

describe('Phase 2 — Core Admin APIs (Users, Categories, Settings, Audit, Dashboard)', () => {
  it('enforces auth, prevents disabling last active admin, manages categories/settings, and logs audits', async () => {
    const pass = 'rahasia-admin-utama-2026';
    const hashed = await hashPassword(pass);
    const nowIso = new Date().toISOString();

    const { db } = createCoreAdminDb([
      {
        id: 'admin-root',
        username: 'admin_utama',
        display_name: 'Admin Utama',
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

    // Unauthenticated rejected
    const unauth = await app.request('http://localhost:5173/api/v1/admin/users', {}, env);
    expect(unauth.status).toBe(401);

    // Login
    const loginRes = await app.request(
      'http://localhost:5173/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ username: 'admin_utama', password: pass }),
      },
      env,
    );
    const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    // Cannot deactivate last active admin (409)
    const disableLast = await app.request(
      'http://localhost:5173/api/v1/admin/users/admin-root',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: cookie,
        },
        body: JSON.stringify({ isActive: false }),
      },
      env,
    );
    expect(disableLast.status).toBe(409);

    // Create second admin
    const createAdmin = await app.request(
      'http://localhost:5173/api/v1/admin/users',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: cookie,
        },
        body: JSON.stringify({
          username: 'admin_kedua',
          displayName: 'Admin Kedua',
          password: 'password-admin-kedua-2026',
        }),
      },
      env,
    );
    expect(createAdmin.status).toBe(201);

    // Update settings
    const updateSettings = await app.request(
      'http://localhost:5173/api/v1/admin/settings',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: cookie,
        },
        body: JSON.stringify({
          settings: { organization_code: 'PKM-SMK-NEW' },
        }),
      },
      env,
    );
    expect(updateSettings.status).toBe(200);

    // Create category + reject duplicate slug
    const createCat = await app.request(
      'http://localhost:5173/api/v1/admin/categories',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: cookie,
        },
        body: JSON.stringify({ name: 'Penyuluhan Gizi' }),
      },
      env,
    );
    expect(createCat.status).toBe(201);

    const dupCat = await app.request(
      'http://localhost:5173/api/v1/admin/categories',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: cookie,
        },
        body: JSON.stringify({ name: 'Pelatihan' }),
      },
      env,
    );
    expect(dupCat.status).toBe(409);

    // Dashboard & audit logs
    const dashRes = await app.request(
      'http://localhost:5173/api/v1/admin/dashboard',
      { headers: { Cookie: cookie } },
      env,
    );
    expect(dashRes.status).toBe(200);
    const dashJson = (await dashRes.json()) as {
      data: { summary: { activeAdmins: number; activeCategories: number } };
    };
    expect(dashJson.data.summary.activeAdmins).toBe(2);
    expect(dashJson.data.summary.activeCategories).toBe(2);

    const auditRes = await app.request(
      'http://localhost:5173/api/v1/admin/audit-logs?page=1&limit=10',
      { headers: { Cookie: cookie } },
      env,
    );
    expect(auditRes.status).toBe(200);
    const auditJson = (await auditRes.json()) as { data: unknown[]; meta: { total: number } };
    expect(auditJson.meta.total).toBeGreaterThanOrEqual(4);
  });
});
