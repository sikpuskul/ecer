import {
  ALLOWED_SETTING_KEYS,
  type EventCategoryItem,
  type SettingKey,
} from '../../../shared/schemas/admin';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  is_active: number;
  created_at: string;
}

interface SettingRow {
  setting_key: string;
  setting_value: string;
}

const ALLOWED_KEY_SET = new Set<string>(ALLOWED_SETTING_KEYS);

export async function listSettings(db: D1Database): Promise<Record<SettingKey, string>> {
  const result = await db
    .prepare(`SELECT setting_key, setting_value FROM app_settings`)
    .all<SettingRow>();

  const out: Record<SettingKey, string> = {
    organization_name: 'Puskesmas Sumbermanjing Kulon',
    organization_code: 'PKM-SMK',
    contact_email: '',
    contact_phone: '',
    public_verification_mask_name: 'true',
    privacy_notice_version: '1.0',
  };

  for (const row of result.results ?? []) {
    if (ALLOWED_KEY_SET.has(row.setting_key)) {
      out[row.setting_key as SettingKey] = row.setting_value;
    }
  }

  return out;
}

export async function upsertSettings(
  db: D1Database,
  params: {
    entries: Array<[SettingKey, string]>;
    updatedBy: string;
    nowIso: string;
  },
): Promise<void> {
  if (params.entries.length === 0) return;

  const statements = params.entries.map(([key, value]) =>
    db
      .prepare(
        `INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`,
      )
      .bind(key, value, params.updatedBy, params.nowIso),
  );

  await db.batch(statements);
}

export async function listCategories(db: D1Database): Promise<EventCategoryItem[]> {
  const result = await db
    .prepare(
      `SELECT id, name, slug, is_active, created_at
       FROM event_categories
       ORDER BY name ASC`,
    )
    .all<CategoryRow>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  }));
}

export async function findCategoryBySlug(
  db: D1Database,
  slug: string,
): Promise<EventCategoryItem | null> {
  const row = await db
    .prepare(
      `SELECT id, name, slug, is_active, created_at
       FROM event_categories
       WHERE slug = ?1
       LIMIT 1`,
    )
    .bind(slug)
    .first<CategoryRow>();

  return row
    ? {
        id: row.id,
        name: row.name,
        slug: row.slug,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
      }
    : null;
}

export async function findCategoryById(
  db: D1Database,
  id: string,
): Promise<EventCategoryItem | null> {
  const row = await db
    .prepare(
      `SELECT id, name, slug, is_active, created_at
       FROM event_categories
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(id)
    .first<CategoryRow>();

  return row
    ? {
        id: row.id,
        name: row.name,
        slug: row.slug,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
      }
    : null;
}

export async function createCategoryRecord(
  db: D1Database,
  params: { id: string; name: string; slug: string; nowIso: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO event_categories (id, name, slug, is_active, created_at)
       VALUES (?1, ?2, ?3, 1, ?4)`,
    )
    .bind(params.id, params.name, params.slug, params.nowIso)
    .run();
}

export async function updateCategoryRecord(
  db: D1Database,
  params: { id: string; name: string; isActive: boolean },
): Promise<void> {
  await db
    .prepare(
      `UPDATE event_categories
       SET name = ?2, is_active = ?3
       WHERE id = ?1`,
    )
    .bind(params.id, params.name, params.isActive ? 1 : 0)
    .run();
}
