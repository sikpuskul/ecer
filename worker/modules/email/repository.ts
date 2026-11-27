import type { EmailJobStatus } from '../../../shared/schemas/email';

export interface EmailJobRow {
  id: string;
  document_id: string;
  revision_id: string;
  document_number: string;
  event_title: string;
  recipient_email_encrypted: string;
  email_template_json: string;
  idempotency_key: string;
  job_status: EmailJobStatus;
  attempts: number;
  next_attempt_at: string | null;
  lease_expires_at: string | null;
  sent_at: string | null;
  error_code: string | null;
  safe_error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailJobExecutionDetail {
  job_id: string;
  document_id: string;
  revision_id: string;
  recipient_email_encrypted: string;
  email_template_json: string;
  attempts: number;
  document_status: string;
  drive_file_id: string | null;
}

export async function insertEmailJobIdempotent(
  db: D1Database,
  params: {
    id: string;
    documentId: string;
    revisionId: string;
    recipientEmailEncrypted: string;
    emailTemplateJson: string;
    idempotencyKey: string;
    nextAttemptAt: string | null;
    nowIso: string;
  },
): Promise<{ inserted: boolean; jobId: string }> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO email_jobs (
         id, document_id, revision_id, recipient_email_encrypted, email_template_json,
         idempotency_key, job_status, attempts, next_attempt_at, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'queued', 0, ?7, ?8, ?8)`,
    )
    .bind(
      params.id,
      params.documentId,
      params.revisionId,
      params.recipientEmailEncrypted,
      params.emailTemplateJson,
      params.idempotencyKey,
      params.nextAttemptAt,
      params.nowIso,
    )
    .run();

  return {
    inserted: (res.meta.changes ?? 0) > 0,
    jobId: params.id,
  };
}

export async function claimEmailJobAtomically(
  db: D1Database,
  params: { jobId: string; nowIso: string; leaseExpiresIso: string },
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE email_jobs
       SET job_status = 'processing',
           attempts = attempts + 1,
           lease_expires_at = ?3,
           updated_at = ?2
       WHERE id = ?1
         AND (
           (job_status IN ('queued', 'retry_wait', 'deferred_quota')
            AND (next_attempt_at IS NULL OR next_attempt_at <= ?2))
           OR (job_status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?2)
         )`,
    )
    .bind(params.jobId, params.nowIso, params.leaseExpiresIso)
    .run();

  return (res.meta.changes ?? 0) > 0;
}

export async function getEmailJobExecutionDetail(
  db: D1Database,
  jobId: string,
): Promise<EmailJobExecutionDetail | null> {
  return db
    .prepare(
      `SELECT ej.id AS job_id, ej.document_id, ej.revision_id,
              ej.recipient_email_encrypted, ej.email_template_json, ej.attempts,
              d.document_status, r.drive_file_id
       FROM email_jobs ej
       INNER JOIN documents d ON d.id = ej.document_id
       INNER JOIN document_revisions r ON r.id = ej.revision_id
       WHERE ej.id = ?1
       LIMIT 1`,
    )
    .bind(jobId)
    .first<EmailJobExecutionDetail>();
}

export async function markEmailJobSent(
  db: D1Database,
  jobId: string,
  sentAtIso: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE email_jobs
       SET job_status = 'sent', sent_at = ?2, lease_expires_at = NULL,
           error_code = NULL, safe_error_message = NULL, updated_at = ?2
       WHERE id = ?1`,
    )
    .bind(jobId, sentAtIso)
    .run();
}

export async function markEmailJobStatus(
  db: D1Database,
  params: {
    jobId: string;
    status: EmailJobStatus;
    nextAttemptAt: string | null;
    errorCode: string | null;
    safeErrorMessage: string | null;
    nowIso: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE email_jobs
       SET job_status = ?2, next_attempt_at = ?3, lease_expires_at = NULL,
           error_code = ?4, safe_error_message = ?5, updated_at = ?6
       WHERE id = ?1`,
    )
    .bind(
      params.jobId,
      params.status,
      params.nextAttemptAt,
      params.errorCode,
      params.safeErrorMessage,
      params.nowIso,
    )
    .run();
}

export async function resetEmailJobForRetry(
  db: D1Database,
  jobId: string,
  nowIso: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE email_jobs
       SET job_status = 'queued', attempts = 0, next_attempt_at = NULL,
           lease_expires_at = NULL, error_code = NULL, safe_error_message = NULL,
           updated_at = ?2
       WHERE id = ?1 AND job_status IN ('failed', 'retry_wait', 'deferred_quota', 'needs_review')`,
    )
    .bind(jobId, nowIso)
    .run();

  return (res.meta.changes ?? 0) > 0;
}

export async function cancelPendingEmailJob(
  db: D1Database,
  jobId: string,
  nowIso: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE email_jobs
       SET job_status = 'cancelled', lease_expires_at = NULL, updated_at = ?2
       WHERE id = ?1 AND job_status IN ('queued', 'retry_wait', 'deferred_quota', 'failed', 'needs_review')`,
    )
    .bind(jobId, nowIso)
    .run();

  return (res.meta.changes ?? 0) > 0;
}

export async function findDueEmailJobIds(
  db: D1Database,
  nowIso: string,
  limit: number,
): Promise<string[]> {
  const res = await db
    .prepare(
      `SELECT id FROM email_jobs
       WHERE (
         (job_status IN ('queued', 'retry_wait', 'deferred_quota')
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?1))
         OR (job_status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?1)
       )
       ORDER BY created_at ASC
       LIMIT ?2`,
    )
    .bind(nowIso, limit)
    .all<{ id: string }>();

  return (res.results ?? []).map((r) => r.id);
}

export async function listEmailJobs(
  db: D1Database,
  params: { page: number; limit: number; status?: string },
): Promise<{ rows: EmailJobRow[]; total: number }> {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (params.status) {
    binds.push(params.status);
    conditions.push(`ej.job_status = ?${binds.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.limit;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM email_jobs ej ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await db
    .prepare(
      `SELECT ej.id, ej.document_id, ej.revision_id, d.document_number,
              e.title AS event_title, ej.recipient_email_encrypted, ej.email_template_json,
              ej.idempotency_key, ej.job_status, ej.attempts, ej.next_attempt_at,
              ej.lease_expires_at, ej.sent_at, ej.error_code, ej.safe_error_message,
              ej.created_at, ej.updated_at
       FROM email_jobs ej
       INNER JOIN documents d ON d.id = ej.document_id
       INNER JOIN events e ON e.id = d.event_id
       ${where}
       ORDER BY ej.created_at DESC
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, params.limit, offset)
    .all<EmailJobRow>();

  return {
    rows: rows.results ?? [],
    total: Number(countRow?.total ?? 0),
  };
}

export async function getEmailJobsStatusCounts(
  db: D1Database,
): Promise<Record<EmailJobStatus, number>> {
  const res = await db
    .prepare(`SELECT job_status, COUNT(*) AS cnt FROM email_jobs GROUP BY job_status`)
    .all<{ job_status: EmailJobStatus; cnt: number }>();

  const counts: Record<EmailJobStatus, number> = {
    queued: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    deferred_quota: 0,
    retry_wait: 0,
    needs_review: 0,
    cancelled: 0,
  };

  for (const row of res.results ?? []) {
    if (row.job_status in counts) {
      counts[row.job_status] = Number(row.cnt ?? 0);
    }
  }
  return counts;
}
