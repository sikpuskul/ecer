import type {
  PlaceholderMappingEntry,
  TemplateDocumentType,
  TemplateItem,
  TemplateValidationStatus,
  TemplateVersionItem,
} from '../../../shared/schemas/templates';

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  document_type: TemplateDocumentType;
  google_doc_id: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface TemplateVersionRow {
  id: string;
  template_id: string;
  version_number: number;
  snapshot_doc_id: string | null;
  placeholders_json: string;
  mapping_schema_json: string;
  validation_status: TemplateValidationStatus;
  created_at: string;
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function mapVersionRow(row: TemplateVersionRow): TemplateVersionItem {
  return {
    id: row.id,
    templateId: row.template_id,
    versionNumber: row.version_number,
    snapshotDocId: row.snapshot_doc_id,
    placeholders: parseJsonArray<string>(row.placeholders_json),
    mappings: parseJsonArray<PlaceholderMappingEntry>(row.mapping_schema_json),
    validationStatus: row.validation_status,
    createdAt: row.created_at,
  };
}

export async function listTemplatesWithLatestVersion(db: D1Database): Promise<TemplateItem[]> {
  const templates = await db
    .prepare(
      `SELECT id, name, description, document_type, google_doc_id, is_active, created_at, updated_at
       FROM templates
       ORDER BY created_at DESC`,
    )
    .all<TemplateRow>();

  const versions = await db
    .prepare(
      `SELECT tv.id, tv.template_id, tv.version_number, tv.snapshot_doc_id,
              tv.placeholders_json, tv.mapping_schema_json, tv.validation_status, tv.created_at
       FROM template_versions tv
       INNER JOIN (
         SELECT template_id, MAX(version_number) AS max_ver
         FROM template_versions
         GROUP BY template_id
       ) latest ON latest.template_id = tv.template_id AND latest.max_ver = tv.version_number`,
    )
    .all<TemplateVersionRow>();

  const versionMap = new Map<string, TemplateVersionItem>();
  for (const v of versions.results ?? []) {
    versionMap.set(v.template_id, mapVersionRow(v));
  }

  return (templates.results ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    documentType: t.document_type,
    googleDocId: t.google_doc_id,
    isActive: t.is_active === 1,
    latestVersion: versionMap.get(t.id) ?? null,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

export async function findTemplateById(
  db: D1Database,
  id: string,
): Promise<{ template: TemplateItem; versions: TemplateVersionItem[] } | null> {
  const row = await db
    .prepare(
      `SELECT id, name, description, document_type, google_doc_id, is_active, created_at, updated_at
       FROM templates
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(id)
    .first<TemplateRow>();

  if (!row) return null;

  const versionsRes = await db
    .prepare(
      `SELECT id, template_id, version_number, snapshot_doc_id,
              placeholders_json, mapping_schema_json, validation_status, created_at
       FROM template_versions
       WHERE template_id = ?1
       ORDER BY version_number DESC`,
    )
    .bind(id)
    .all<TemplateVersionRow>();

  const versions = (versionsRes.results ?? []).map(mapVersionRow);

  return {
    template: {
      id: row.id,
      name: row.name,
      description: row.description,
      documentType: row.document_type,
      googleDocId: row.google_doc_id,
      isActive: row.is_active === 1,
      latestVersion: versions[0] ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    versions,
  };
}

export async function insertTemplateAndVersion(
  db: D1Database,
  params: {
    templateId: string;
    versionId: string;
    name: string;
    description: string;
    documentType: TemplateDocumentType;
    googleDocId: string;
    placeholders: string[];
    mappings: PlaceholderMappingEntry[];
    validationStatus: TemplateValidationStatus;
    adminId: string;
    nowIso: string;
  },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO templates (id, name, description, document_type, google_doc_id, is_active, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?7)`,
      )
      .bind(
        params.templateId,
        params.name,
        params.description,
        params.documentType,
        params.googleDocId,
        params.adminId,
        params.nowIso,
      ),
    db
      .prepare(
        `INSERT INTO template_versions (id, template_id, version_number, snapshot_doc_id, placeholders_json, mapping_schema_json, validation_status, created_by, created_at)
         VALUES (?1, ?2, 1, NULL, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        params.versionId,
        params.templateId,
        JSON.stringify(params.placeholders),
        JSON.stringify(params.mappings),
        params.validationStatus,
        params.adminId,
        params.nowIso,
      ),
  ]);
}

export async function insertNewTemplateVersion(
  db: D1Database,
  params: {
    versionId: string;
    templateId: string;
    versionNumber: number;
    placeholders: string[];
    mappings: PlaceholderMappingEntry[];
    validationStatus: TemplateValidationStatus;
    adminId: string;
    nowIso: string;
  },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO template_versions (id, template_id, version_number, snapshot_doc_id, placeholders_json, mapping_schema_json, validation_status, created_by, created_at)
         VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        params.versionId,
        params.templateId,
        params.versionNumber,
        JSON.stringify(params.placeholders),
        JSON.stringify(params.mappings),
        params.validationStatus,
        params.adminId,
        params.nowIso,
      ),
    db
      .prepare(`UPDATE templates SET updated_at = ?2 WHERE id = ?1`)
      .bind(params.templateId, params.nowIso),
  ]);
}

export async function updateTemplateMetadataAndMapping(
  db: D1Database,
  params: {
    templateId: string;
    name: string;
    description: string;
    isActive: boolean;
    latestVersionId?: string;
    mappings?: PlaceholderMappingEntry[];
    nowIso: string;
  },
): Promise<void> {
  const statements = [
    db
      .prepare(
        `UPDATE templates
         SET name = ?2, description = ?3, is_active = ?4, updated_at = ?5
         WHERE id = ?1`,
      )
      .bind(
        params.templateId,
        params.name,
        params.description,
        params.isActive ? 1 : 0,
        params.nowIso,
      ),
  ];

  if (params.latestVersionId && params.mappings) {
    statements.push(
      db
        .prepare(
          `UPDATE template_versions
           SET mapping_schema_json = ?2
           WHERE id = ?1`,
        )
        .bind(params.latestVersionId, JSON.stringify(params.mappings)),
    );
  }

  await db.batch(statements);
}

export async function updateTemplateVersionSnapshot(
  db: D1Database,
  params: {
    versionId: string;
    snapshotDocId: string;
    validationStatus: TemplateValidationStatus;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE template_versions
       SET snapshot_doc_id = ?2, validation_status = ?3
       WHERE id = ?1`,
    )
    .bind(params.versionId, params.snapshotDocId, params.validationStatus)
    .run();
}

export async function countTemplateReferences(db: D1Database, templateId: string): Promise<number> {
  const [etRow, docRow] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM event_templates et
         INNER JOIN template_versions tv ON tv.id = et.template_version_id
         WHERE tv.template_id = ?1`,
      )
      .bind(templateId)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM documents d
         INNER JOIN template_versions tv ON tv.id = d.template_version_id
         WHERE tv.template_id = ?1`,
      )
      .bind(templateId)
      .first<{ count: number }>(),
  ]);
  return Number(etRow?.count ?? 0) + Number(docRow?.count ?? 0);
}

export async function deleteTemplateRecords(db: D1Database, templateId: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM template_versions WHERE template_id = ?1`).bind(templateId),
    db.prepare(`DELETE FROM templates WHERE id = ?1`).bind(templateId),
  ]);
}
