import type { AwardTemplateOption } from '../../../shared/schemas/awards';
import type { DocumentRow } from '../documents/repository';

export async function listAwardEventTemplates(
  db: D1Database,
  eventId?: string,
): Promise<AwardTemplateOption[]> {
  const where = eventId
    ? `WHERE et.is_active = 1 AND t.document_type = 'award' AND et.event_id = ?1`
    : `WHERE et.is_active = 1 AND t.document_type = 'award'`;

  const stmt = db.prepare(
    `SELECT et.id AS event_template_id, et.event_id, e.title AS event_title, e.event_code,
            t.name AS template_name, et.template_version_id, et.numbering_rule_id
     FROM event_templates et
     INNER JOIN events e ON e.id = et.event_id
     INNER JOIN template_versions tv ON tv.id = et.template_version_id
     INNER JOIN templates t ON t.id = tv.template_id
     ${where}
     ORDER BY e.event_start_at DESC, et.sort_order ASC`,
  );

  const res = eventId
    ? await stmt.bind(eventId).all<{
        event_template_id: string;
        event_id: string;
        event_title: string;
        event_code: string;
        template_name: string;
        template_version_id: string;
        numbering_rule_id: string;
      }>()
    : await stmt.all<{
        event_template_id: string;
        event_id: string;
        event_title: string;
        event_code: string;
        template_name: string;
        template_version_id: string;
        numbering_rule_id: string;
      }>();

  return (res.results ?? []).map((r) => ({
    eventTemplateId: r.event_template_id,
    eventId: r.event_id,
    eventTitle: r.event_title,
    eventCode: r.event_code,
    templateName: r.template_name,
    templateVersionId: r.template_version_id,
    numberingRuleId: r.numbering_rule_id,
  }));
}

export async function findAwardEventTemplateById(
  db: D1Database,
  eventId: string,
  eventTemplateId: string,
): Promise<AwardTemplateOption | null> {
  const r = await db
    .prepare(
      `SELECT et.id AS event_template_id, et.event_id, e.title AS event_title, e.event_code,
              t.name AS template_name, et.template_version_id, et.numbering_rule_id
       FROM event_templates et
       INNER JOIN events e ON e.id = et.event_id
       INNER JOIN template_versions tv ON tv.id = et.template_version_id
       INNER JOIN templates t ON t.id = tv.template_id
       WHERE et.id = ?1 AND et.event_id = ?2 AND et.is_active = 1 AND t.document_type = 'award'
       LIMIT 1`,
    )
    .bind(eventTemplateId, eventId)
    .first<{
      event_template_id: string;
      event_id: string;
      event_title: string;
      event_code: string;
      template_name: string;
      template_version_id: string;
      numbering_rule_id: string;
    }>();

  if (!r) return null;
  return {
    eventTemplateId: r.event_template_id,
    eventId: r.event_id,
    eventTitle: r.event_title,
    eventCode: r.event_code,
    templateName: r.template_name,
    templateVersionId: r.template_version_id,
    numberingRuleId: r.numbering_rule_id,
  };
}

export async function listAdminAwardRows(
  db: D1Database,
  params: { page: number; limit: number; eventId?: string; status?: string },
): Promise<{ rows: DocumentRow[]; total: number }> {
  const conditions: string[] = [`d.document_type = 'award'`];
  const binds: unknown[] = [];

  if (params.eventId) {
    binds.push(params.eventId);
    conditions.push(`d.event_id = ?${binds.length}`);
  }
  if (params.status) {
    binds.push(params.status);
    conditions.push(`d.document_status = ?${binds.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM documents d ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `SELECT d.id, d.public_id, d.event_id, e.title AS event_title,
              d.participant_id, d.event_template_id, d.template_version_id,
              d.numbering_rule_id, d.document_type, d.document_number,
              d.verification_code, d.issuance_key, d.recipient_data_encrypted,
              d.current_revision_id, d.document_status, d.issued_at,
              d.revoked_at, d.revoked_reason,
              (SELECT COUNT(*) FROM document_revisions r WHERE r.document_id = d.id) AS revision_count,
              d.created_at, d.updated_at
       FROM documents d
       INNER JOIN events e ON e.id = d.event_id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, params.limit, offset)
    .all<DocumentRow>();

  return {
    rows: rows.results ?? [],
    total: Number(countRow?.total ?? 0),
  };
}

export async function findParticipantsByIdsForEvent(
  db: D1Database,
  eventId: string,
  participantIds: string[],
): Promise<Array<{ id: string; encrypted_data: string }>> {
  if (participantIds.length === 0) return [];
  const placeholders = participantIds.map((_, idx) => `?${idx + 2}`).join(', ');
  const res = await db
    .prepare(
      `SELECT id, encrypted_data FROM participants
       WHERE event_id = ?1 AND id IN (${placeholders})`,
    )
    .bind(eventId, ...participantIds)
    .all<{ id: string; encrypted_data: string }>();

  return res.results ?? [];
}
