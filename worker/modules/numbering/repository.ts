import type { NumberingRuleItem, ResetStrategy } from '../../../shared/schemas/numbering';
import type { TemplateDocumentType } from '../../../shared/schemas/templates';
import { buildCounterScopeKey, formatDocumentNumber } from '../../../shared/utils/numbering';
import { getCurrentJakartaMonthYear } from '../../../shared/utils/jakarta-date';

interface NumberingRuleRow {
  id: string;
  name: string;
  document_type: TemplateDocumentType;
  format_pattern: string;
  sequence_padding: number;
  starting_number: number;
  reset_strategy: ResetStrategy;
  organization_code: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRuleRow(row: NumberingRuleRow): NumberingRuleItem {
  return {
    id: row.id,
    name: row.name,
    documentType: row.document_type,
    formatPattern: row.format_pattern,
    sequencePadding: row.sequence_padding,
    startingNumber: row.starting_number,
    resetStrategy: row.reset_strategy,
    organizationCode: row.organization_code,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listNumberingRules(db: D1Database): Promise<NumberingRuleItem[]> {
  const res = await db
    .prepare(
      `SELECT id, name, document_type, format_pattern, sequence_padding, starting_number,
              reset_strategy, organization_code, is_active, created_at, updated_at
       FROM numbering_rules
       ORDER BY created_at DESC`,
    )
    .all<NumberingRuleRow>();
  return (res.results ?? []).map(mapRuleRow);
}

export async function findNumberingRuleById(
  db: D1Database,
  id: string,
): Promise<NumberingRuleItem | null> {
  const row = await db
    .prepare(
      `SELECT id, name, document_type, format_pattern, sequence_padding, starting_number,
              reset_strategy, organization_code, is_active, created_at, updated_at
       FROM numbering_rules
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(id)
    .first<NumberingRuleRow>();
  return row ? mapRuleRow(row) : null;
}

export async function insertNumberingRule(
  db: D1Database,
  params: {
    id: string;
    name: string;
    documentType: TemplateDocumentType;
    formatPattern: string;
    sequencePadding: number;
    startingNumber: number;
    resetStrategy: ResetStrategy;
    organizationCode: string;
    nowIso: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO numbering_rules (
        id, name, document_type, format_pattern, sequence_padding, starting_number,
        reset_strategy, organization_code, is_active, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?9)`,
    )
    .bind(
      params.id,
      params.name,
      params.documentType,
      params.formatPattern,
      params.sequencePadding,
      params.startingNumber,
      params.resetStrategy,
      params.organizationCode,
      params.nowIso,
    )
    .run();
}

export async function updateNumberingRuleRecord(
  db: D1Database,
  params: {
    id: string;
    name: string;
    formatPattern: string;
    sequencePadding: number;
    startingNumber: number;
    resetStrategy: ResetStrategy;
    organizationCode: string;
    isActive: boolean;
    nowIso: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE numbering_rules
       SET name = ?2, format_pattern = ?3, sequence_padding = ?4,
           starting_number = ?5, reset_strategy = ?6, organization_code = ?7,
           is_active = ?8, updated_at = ?9
       WHERE id = ?1`,
    )
    .bind(
      params.id,
      params.name,
      params.formatPattern,
      params.sequencePadding,
      params.startingNumber,
      params.resetStrategy,
      params.organizationCode,
      params.isActive ? 1 : 0,
      params.nowIso,
    )
    .run();
}

export async function isNumberingRuleInUse(db: D1Database, id: string): Promise<boolean> {
  const [tplRef, docRef] = await Promise.all([
    db
      .prepare(`SELECT 1 AS used FROM event_templates WHERE numbering_rule_id = ?1 LIMIT 1`)
      .bind(id)
      .first<{ used: number }>(),
    db
      .prepare(`SELECT 1 AS used FROM documents WHERE numbering_rule_id = ?1 LIMIT 1`)
      .bind(id)
      .first<{ used: number }>(),
  ]);
  return Boolean(tplRef || docRef);
}

export async function deleteNumberingRuleRecord(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM numbering_counters WHERE rule_id = ?1`).bind(id),
    db.prepare(`DELETE FROM numbering_rules WHERE id = ?1`).bind(id),
  ]);
}

/**
 * Atomically allocates the next document number using SQLite UPSERT ... RETURNING (PRD §14.4).
 * Never uses SELECT MAX + 1 and never reuses allocated numbers.
 */
export async function allocateNextDocumentNumber(
  db: D1Database,
  params: {
    rule: NumberingRuleItem;
    eventId: string;
    eventCode: string;
    nowMs?: number;
  },
): Promise<{ sequenceNumber: number; documentNumber: string }> {
  const { month, year } = getCurrentJakartaMonthYear(params.nowMs);
  const scopeKey = buildCounterScopeKey({
    resetStrategy: params.rule.resetStrategy,
    month,
    year,
    eventId: params.eventId,
  });
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();

  const row = await db
    .prepare(
      `INSERT INTO numbering_counters (id, rule_id, scope_key, current_value, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(rule_id, scope_key) DO UPDATE SET
         current_value = current_value + 1,
         updated_at = excluded.updated_at
       RETURNING current_value`,
    )
    .bind(crypto.randomUUID(), params.rule.id, scopeKey, params.rule.startingNumber, nowIso)
    .first<{ current_value: number }>();

  const sequenceNumber = Number(row?.current_value ?? params.rule.startingNumber);
  const documentNumber = formatDocumentNumber({
    formatPattern: params.rule.formatPattern,
    sequenceNumber,
    sequencePadding: params.rule.sequencePadding,
    documentType: params.rule.documentType,
    eventCode: params.eventCode,
    organizationCode: params.rule.organizationCode,
    month,
    year,
  });

  return { sequenceNumber, documentNumber };
}
