import type { FormField, FormVersionItem } from '../../../shared/schemas/forms';

interface FormVersionRow {
  id: string;
  event_id: string;
  version_number: number;
  schema_json: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
}

export interface EventTemplateLinkItem {
  id: string;
  eventId: string;
  templateVersionId: string;
  numberingRuleId: string;
  categoryName: string;
  sortOrder: number;
  isActive: boolean;
}

function parseFields(raw: string): FormField[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FormField[]) : [];
  } catch {
    return [];
  }
}

function mapFormRow(row: FormVersionRow): FormVersionItem {
  return {
    id: row.id,
    eventId: row.event_id,
    versionNumber: row.version_number,
    fields: parseFields(row.schema_json),
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listFormVersionsByEvent(
  db: D1Database,
  eventId: string,
): Promise<FormVersionItem[]> {
  const res = await db
    .prepare(
      `SELECT id, event_id, version_number, schema_json, status, created_at
       FROM form_versions
       WHERE event_id = ?1
       ORDER BY version_number DESC`,
    )
    .bind(eventId)
    .all<FormVersionRow>();

  return (res.results ?? []).map(mapFormRow);
}

export async function saveDraftFormVersion(
  db: D1Database,
  params: {
    eventId: string;
    fields: FormField[];
    adminId: string;
    nowIso: string;
  },
): Promise<FormVersionItem> {
  const versions = await listFormVersionsByEvent(db, params.eventId);
  const latest = versions[0];

  // PRD §11.6: Never mutate a published form version; create a new draft version instead
  if (latest && latest.status === 'draft') {
    await db
      .prepare(`UPDATE form_versions SET schema_json = ?2 WHERE id = ?1`)
      .bind(latest.id, JSON.stringify(params.fields))
      .run();
    return { ...latest, fields: params.fields };
  }

  const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO form_versions (id, event_id, version_number, schema_json, status, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6)`,
    )
    .bind(
      id,
      params.eventId,
      nextVersionNumber,
      JSON.stringify(params.fields),
      params.adminId,
      params.nowIso,
    )
    .run();

  return {
    id,
    eventId: params.eventId,
    versionNumber: nextVersionNumber,
    fields: params.fields,
    status: 'draft',
    createdAt: params.nowIso,
  };
}

export async function publishLatestDraftForm(
  db: D1Database,
  eventId: string,
): Promise<FormVersionItem | null> {
  const versions = await listFormVersionsByEvent(db, eventId);
  const draft = versions.find((v) => v.status === 'draft');
  if (!draft) return null;

  await db.batch([
    db
      .prepare(
        `UPDATE form_versions
         SET status = 'archived'
         WHERE event_id = ?1 AND status = 'published'`,
      )
      .bind(eventId),
    db.prepare(`UPDATE form_versions SET status = 'published' WHERE id = ?1`).bind(draft.id),
  ]);

  return { ...draft, status: 'published' };
}

export async function ensureDefaultNumberingRule(
  db: D1Database,
  documentType: 'certificate' | 'award' = 'certificate',
): Promise<string> {
  const existing = await db
    .prepare(`SELECT id FROM numbering_rules WHERE document_type = ?1 AND is_active = 1 LIMIT 1`)
    .bind(documentType)
    .first<{ id: string }>();

  if (existing?.id) return existing.id;

  const id = `rule-default-${documentType}`;
  const nowIso = new Date().toISOString();
  const pattern =
    documentType === 'award'
      ? '{SEQ}/PIAGAM/{ORG_CODE}/{MONTH_ROMAN}/{YEAR}'
      : '{SEQ}/SERT/{ORG_CODE}/{MONTH_ROMAN}/{YEAR}';

  await db
    .prepare(
      `INSERT OR IGNORE INTO numbering_rules (id, name, document_type, format_pattern, sequence_padding, starting_number, reset_strategy, organization_code, is_active, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 3, 1, 'yearly', 'PKM-SMK', 1, ?5, ?5)`,
    )
    .bind(
      id,
      documentType === 'award' ? 'Standar Piagam' : 'Standar Sertifikat',
      documentType,
      pattern,
      nowIso,
    )
    .run();

  return id;
}

export async function listEventTemplateLinks(
  db: D1Database,
  eventId: string,
): Promise<EventTemplateLinkItem[]> {
  const res = await db
    .prepare(
      `SELECT id, event_id, template_version_id, numbering_rule_id, category_name, sort_order, is_active
       FROM event_templates
       WHERE event_id = ?1
       ORDER BY sort_order ASC`,
    )
    .bind(eventId)
    .all<{
      id: string;
      event_id: string;
      template_version_id: string;
      numbering_rule_id: string;
      category_name: string;
      sort_order: number;
      is_active: number;
    }>();

  return (res.results ?? []).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    templateVersionId: r.template_version_id,
    numberingRuleId: r.numbering_rule_id,
    categoryName: r.category_name,
    sortOrder: r.sort_order,
    isActive: r.is_active === 1,
  }));
}

export async function replaceEventTemplateLinks(
  db: D1Database,
  eventId: string,
  links: Array<{
    templateVersionId: string;
    numberingRuleId: string;
    categoryName: string;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<EventTemplateLinkItem[]> {
  const statements = [db.prepare(`DELETE FROM event_templates WHERE event_id = ?1`).bind(eventId)];

  for (const link of links) {
    statements.push(
      db
        .prepare(
          `INSERT INTO event_templates (id, event_id, template_version_id, numbering_rule_id, category_name, eligibility_json, sort_order, is_active)
           VALUES (?1, ?2, ?3, ?4, ?5, '{}', ?6, ?7)`,
        )
        .bind(
          crypto.randomUUID(),
          eventId,
          link.templateVersionId,
          link.numberingRuleId,
          link.categoryName,
          link.sortOrder,
          link.isActive ? 1 : 0,
        ),
    );
  }

  await db.batch(statements);
  return listEventTemplateLinks(db, eventId);
}
