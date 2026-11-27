import type {
  DocumentRevisionItem,
  DocumentStatus,
  GenerationJobItem,
  GenerationJobStatus,
} from '../../../shared/schemas/documents';
import type { TemplateDocumentType } from '../../../shared/schemas/templates';

export interface DocumentRow {
  id: string;
  public_id: string;
  event_id: string;
  event_title: string;
  participant_id: string | null;
  event_template_id: string;
  template_version_id: string;
  numbering_rule_id: string;
  document_type: TemplateDocumentType;
  document_number: string;
  verification_code: string;
  issuance_key: string;
  recipient_data_encrypted: string;
  current_revision_id: string | null;
  document_status: DocumentStatus;
  issued_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  revision_count: number;
  created_at: string;
  updated_at: string;
}

export interface GenerationJobRow {
  id: string;
  document_id: string;
  document_number: string;
  revision_number: number;
  idempotency_key: string;
  job_status: GenerationJobStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  lease_expires_at: string | null;
  claimed_by: string | null;
  error_code: string | null;
  safe_error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAdminDocuments(
  db: D1Database,
  params: {
    page: number;
    limit: number;
    documentType?: string;
    status?: string;
    eventId?: string;
  },
): Promise<{ rows: DocumentRow[]; total: number }> {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (params.documentType) {
    binds.push(params.documentType);
    conditions.push(`d.document_type = ?${binds.length}`);
  }
  if (params.status) {
    binds.push(params.status);
    conditions.push(`d.document_status = ?${binds.length}`);
  }
  if (params.eventId) {
    binds.push(params.eventId);
    conditions.push(`d.event_id = ?${binds.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM documents d ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `SELECT d.id, d.public_id, d.event_id, e.title AS event_title, d.participant_id,
              d.event_template_id, d.template_version_id, d.numbering_rule_id,
              d.document_type, d.document_number, d.verification_code, d.issuance_key,
              d.recipient_data_encrypted, d.current_revision_id, d.document_status,
              d.issued_at, d.revoked_at, d.revoked_reason, d.created_at, d.updated_at,
              (SELECT COUNT(*) FROM document_revisions r WHERE r.document_id = d.id) AS revision_count
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

export async function findDocumentRowById(db: D1Database, id: string): Promise<DocumentRow | null> {
  const row = await db
    .prepare(
      `SELECT d.id, d.public_id, d.event_id, e.title AS event_title, d.participant_id,
              d.event_template_id, d.template_version_id, d.numbering_rule_id,
              d.document_type, d.document_number, d.verification_code, d.issuance_key,
              d.recipient_data_encrypted, d.current_revision_id, d.document_status,
              d.issued_at, d.revoked_at, d.revoked_reason, d.created_at, d.updated_at,
              (SELECT COUNT(*) FROM document_revisions r WHERE r.document_id = d.id) AS revision_count
       FROM documents d
       INNER JOIN events e ON e.id = d.event_id
       WHERE d.id = ?1
       LIMIT 1`,
    )
    .bind(id)
    .first<DocumentRow>();
  return row ?? null;
}

export async function listDocumentRevisions(
  db: D1Database,
  documentId: string,
): Promise<DocumentRevisionItem[]> {
  const res = await db
    .prepare(
      `SELECT id, document_id, revision_number, filename, file_size, revision_status, created_at
       FROM document_revisions
       WHERE document_id = ?1
       ORDER BY revision_number DESC`,
    )
    .bind(documentId)
    .all<{
      id: string;
      document_id: string;
      revision_number: number;
      filename: string;
      file_size: number;
      revision_status: string;
      created_at: string;
    }>();

  return (res.results ?? []).map((r) => ({
    id: r.id,
    documentId: r.document_id,
    revisionNumber: r.revision_number,
    filename: r.filename,
    fileSize: r.file_size,
    revisionStatus: r.revision_status,
    createdAt: r.created_at,
  }));
}

export async function findCurrentRevisionForDocument(
  db: D1Database,
  documentId: string,
): Promise<{ driveFileId: string; filename: string } | null> {
  const row = await db
    .prepare(
      `SELECT r.drive_file_id, r.filename
       FROM documents d
       JOIN document_revisions r ON r.id = d.current_revision_id
       WHERE d.id = ?1`,
    )
    .bind(documentId)
    .first<{ drive_file_id: string | null; filename: string | null }>();

  if (!row || !row.drive_file_id) return null;
  return {
    driveFileId: row.drive_file_id,
    filename: row.filename ?? 'sertifikat.pdf',
  };
}

export async function listGenerationJobs(
  db: D1Database,
  params: { page: number; limit: number; status?: string },
): Promise<{ items: GenerationJobItem[]; total: number }> {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (params.status) {
    binds.push(params.status);
    conditions.push(`j.job_status = ?${binds.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM generation_jobs j ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `SELECT j.id, j.document_id, d.document_number, j.revision_number, j.idempotency_key,
              j.job_status, j.attempts, j.max_attempts, j.next_attempt_at, j.lease_expires_at,
              j.claimed_by, j.error_code, j.safe_error_message, j.created_at, j.updated_at
       FROM generation_jobs j
       INNER JOIN documents d ON d.id = j.document_id
       ${where}
       ORDER BY j.created_at DESC
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, params.limit, offset)
    .all<GenerationJobRow>();

  return {
    items: (rows.results ?? []).map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentNumber: r.document_number,
      revisionNumber: r.revision_number,
      jobStatus: r.job_status,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      nextAttemptAt: r.next_attempt_at,
      errorCode: r.error_code,
      safeErrorMessage: r.safe_error_message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    total: Number(countRow?.total ?? 0),
  };
}

export async function findClaimableGenerationJobIds(
  db: D1Database,
  nowIso: string,
  limit = 2,
): Promise<string[]> {
  const res = await db
    .prepare(
      `SELECT id
       FROM generation_jobs
       WHERE (job_status IN ('queued', 'retry_wait') AND (next_attempt_at IS NULL OR next_attempt_at <= ?1))
          OR (job_status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?1)
       ORDER BY created_at ASC
       LIMIT ?2`,
    )
    .bind(nowIso, limit)
    .all<{ id: string }>();
  return (res.results ?? []).map((r) => r.id);
}

export async function claimGenerationJobAtomically(
  db: D1Database,
  params: { jobId: string; workerId: string; nowIso: string; leaseExpiresIso: string },
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE generation_jobs
       SET job_status = 'processing',
           claimed_by = ?2,
           lease_expires_at = ?3,
           attempts = attempts + 1,
           updated_at = ?4
       WHERE id = ?1
         AND (
           job_status IN ('queued', 'retry_wait')
           OR (job_status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?4)
         )`,
    )
    .bind(params.jobId, params.workerId, params.leaseExpiresIso, params.nowIso)
    .run();

  return (res.meta?.changes ?? 0) > 0;
}

export async function getJobsSummaryCounts(db: D1Database): Promise<{
  generation: Record<string, number>;
  email: Record<string, number>;
}> {
  const [genRows, emailRows] = await Promise.all([
    db
      .prepare(`SELECT job_status, COUNT(*) AS count FROM generation_jobs GROUP BY job_status`)
      .all<{ job_status: string; count: number }>(),
    db
      .prepare(`SELECT job_status, COUNT(*) AS count FROM email_jobs GROUP BY job_status`)
      .all<{ job_status: string; count: number }>(),
  ]);

  const generation: Record<string, number> = {};
  for (const r of genRows.results ?? []) generation[r.job_status] = Number(r.count);

  const email: Record<string, number> = {};
  for (const r of emailRows.results ?? []) email[r.job_status] = Number(r.count);

  return { generation, email };
}
