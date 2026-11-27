import { ERROR_CODES } from '../../../shared/constants/api';
import type { AdminDocumentItem } from '../../../shared/schemas/documents';
import type { PlaceholderMappingEntry } from '../../../shared/schemas/templates';
import { formatJakartaDate } from '../../../shared/utils/jakarta-date';
import { buildSafeDocumentFilename } from '../../../shared/utils/numbering';
import type { WorkerEnv } from '../../env';
import {
  GasIntegrationError,
  GoogleAppsScriptClient,
} from '../../integrations/google-apps-script/client';
import { AppError } from '../../middleware/error-handler';
import { decryptSensitiveData, generateOpaqueToken } from '../../security/crypto';
import { generateQrPngBase64 } from '../../utils/qr-png';
import { insertAuditLog } from '../auth/repository';
import { enqueueCertificateEmailIfEnabled, processEmailJob } from '../email/service';
import { allocateNextDocumentNumber, findNumberingRuleById } from '../numbering/repository';
import {
  claimGenerationJobAtomically,
  findClaimableGenerationJobIds,
  findDocumentRowById,
  listAdminDocuments,
  type DocumentRow,
} from './repository';

const LEASE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

function applyTextTransform(value: string, transform?: 'none' | 'uppercase' | 'titlecase'): string {
  if (transform === 'uppercase') return value.toUpperCase();
  if (transform === 'titlecase') {
    return value.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return value;
}

async function decryptRecipientName(encrypted: string, encryptionKey?: string): Promise<string> {
  if (!encryptionKey) return 'Penerima';
  try {
    const raw = await decryptSensitiveData(encrypted, { v1: encryptionKey });
    const data = JSON.parse(raw) as Record<string, unknown>;
    return String(data.nama_lengkap ?? data.nama ?? data.name ?? 'Penerima');
  } catch {
    return 'Penerima';
  }
}

export async function getAdminDocumentsList(
  env: WorkerEnv,
  params: { page: number; limit: number; documentType?: string; status?: string; eventId?: string },
): Promise<{ items: AdminDocumentItem[]; total: number }> {
  const { rows, total } = await listAdminDocuments(env.DB!, params);
  const items: AdminDocumentItem[] = [];

  for (const row of rows) {
    const recipientName = await decryptRecipientName(
      row.recipient_data_encrypted,
      env.DATA_ENCRYPTION_KEY,
    );
    items.push(mapAdminDocument(row, recipientName));
  }

  return { items, total };
}

function mapAdminDocument(row: DocumentRow, recipientName: string): AdminDocumentItem {
  return {
    id: row.id,
    publicId: row.public_id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    participantId: row.participant_id,
    documentType: row.document_type,
    documentNumber: row.document_number,
    verificationCode: row.verification_code,
    recipientName,
    documentStatus: row.document_status,
    revisionCount: Number(row.revision_count ?? 0),
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    createdAt: row.created_at,
  };
}

/**
 * Creates a document + revision 1 + durable generation job idempotently for an approved participant.
 */
export async function queueDocumentForParticipant(
  env: WorkerEnv,
  params: {
    eventId: string;
    eventCode: string;
    participantId: string;
    recipientDataEncrypted: string;
    recipientName: string;
    adminId: string | null;
  },
): Promise<{ documentId: string; jobId: string } | null> {
  const db = env.DB!;

  // Find active certificate event_template for this event
  const link = await db
    .prepare(
      `SELECT et.id AS event_template_id, et.template_version_id, et.numbering_rule_id,
              t.document_type
       FROM event_templates et
       INNER JOIN template_versions tv ON tv.id = et.template_version_id
       INNER JOIN templates t ON t.id = tv.template_id
       WHERE et.event_id = ?1 AND et.is_active = 1 AND t.document_type = 'certificate'
       ORDER BY et.sort_order ASC
       LIMIT 1`,
    )
    .bind(params.eventId)
    .first<{
      event_template_id: string;
      template_version_id: string;
      numbering_rule_id: string;
      document_type: 'certificate' | 'award';
    }>();

  if (!link) return null;

  const issuanceKey = `${params.eventId}:${params.participantId}:${link.event_template_id}`;
  const existing = await db
    .prepare(`SELECT id FROM documents WHERE issuance_key = ?1 LIMIT 1`)
    .bind(issuanceKey)
    .first<{ id: string }>();

  if (existing) {
    const existingJob = await db
      .prepare(
        `SELECT id FROM generation_jobs WHERE document_id = ?1 ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(existing.id)
      .first<{ id: string }>();
    return { documentId: existing.id, jobId: existingJob?.id ?? '' };
  }

  const rule = await findNumberingRuleById(db, link.numbering_rule_id);
  if (!rule) return null;

  const { documentNumber } = await allocateNextDocumentNumber(db, {
    rule,
    eventId: params.eventId,
    eventCode: params.eventCode,
  });

  const documentId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const publicId = generateOpaqueToken(16);
  const verificationCode = generateOpaqueToken(16);
  const filename = buildSafeDocumentFilename({
    documentType: link.document_type,
    recipientName: params.recipientName,
    documentNumber,
  });
  const nowIso = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        `INSERT INTO documents (
          id, public_id, event_id, participant_id, event_template_id, template_version_id,
          numbering_rule_id, document_type, document_number, verification_code, issuance_key,
          recipient_data_encrypted, current_revision_id, document_status,
          issued_at, revoked_at, revoked_reason, created_by, created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6,
          ?7, ?8, ?9, ?10, ?11,
          ?12, NULL, 'queued',
          NULL, NULL, NULL, ?13, ?14, ?14
        )`,
      )
      .bind(
        documentId,
        publicId,
        params.eventId,
        params.participantId,
        link.event_template_id,
        link.template_version_id,
        link.numbering_rule_id,
        link.document_type,
        documentNumber,
        verificationCode,
        issuanceKey,
        params.recipientDataEncrypted,
        params.adminId,
        nowIso,
      ),
    db
      .prepare(
        `INSERT INTO document_revisions (
          id, document_id, revision_number, template_version_id, data_snapshot_encrypted,
          drive_file_id, filename, mime_type, file_size, checksum, revision_status,
          created_by, created_at
        ) VALUES (?1, ?2, 1, ?3, ?4, NULL, ?5, 'application/pdf', 0, NULL, 'queued', ?6, ?7)`,
      )
      .bind(
        revisionId,
        documentId,
        link.template_version_id,
        params.recipientDataEncrypted,
        filename,
        params.adminId,
        nowIso,
      ),
    db
      .prepare(
        `INSERT INTO generation_jobs (
          id, document_id, revision_number, idempotency_key, job_status,
          attempts, max_attempts, next_attempt_at, lease_expires_at, claimed_by,
          error_code, safe_error_message, created_at, updated_at
        ) VALUES (?1, ?2, 1, ?3, 'queued', 0, 5, NULL, NULL, NULL, NULL, NULL, ?4, ?4)`,
      )
      .bind(jobId, documentId, `${documentId}:1`, nowIso),
  ]);

  return { documentId, jobId };
}

/**
 * Claims and executes a single durable generation job via signed Google Apps Script.
 */
export async function processGenerationJob(
  env: WorkerEnv,
  jobId: string,
  requestId: string,
): Promise<{ processed: boolean; status: string }> {
  const db = env.DB!;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const leaseExpiresIso = new Date(nowMs + LEASE_DURATION_MS).toISOString();

  const claimed = await claimGenerationJobAtomically(db, {
    jobId,
    workerId: `worker-${requestId.slice(0, 8)}`,
    nowIso,
    leaseExpiresIso,
  });

  if (!claimed) {
    return { processed: false, status: 'not_claimable' };
  }

  const jobDetail = await db
    .prepare(
      `SELECT j.id AS job_id, j.document_id, j.revision_number, j.attempts, j.max_attempts,
              d.event_id, d.document_type, d.document_number, d.verification_code,
              r.id AS revision_id, r.filename, r.data_snapshot_encrypted,
              tv.snapshot_doc_id, tv.mapping_schema_json, t.google_doc_id,
              e.title AS event_title, e.event_start_at, e.location AS event_location, e.organizer AS event_organizer
       FROM generation_jobs j
       INNER JOIN documents d ON d.id = j.document_id
       INNER JOIN document_revisions r ON r.document_id = j.document_id AND r.revision_number = j.revision_number
       INNER JOIN template_versions tv ON tv.id = r.template_version_id
       INNER JOIN templates t ON t.id = tv.template_id
       INNER JOIN events e ON e.id = d.event_id
       WHERE j.id = ?1
       LIMIT 1`,
    )
    .bind(jobId)
    .first<{
      job_id: string;
      document_id: string;
      revision_number: number;
      attempts: number;
      max_attempts: number;
      event_id: string;
      document_type: 'certificate' | 'award';
      document_number: string;
      verification_code: string;
      revision_id: string;
      filename: string;
      data_snapshot_encrypted: string;
      snapshot_doc_id: string | null;
      mapping_schema_json: string;
      google_doc_id: string;
      event_title: string;
      event_start_at: string;
      event_location: string;
      event_organizer: string;
    }>();

  if (!jobDetail) {
    return { processed: false, status: 'missing_record' };
  }

  try {
    if (!env.GAS_WEB_APP_URL || !env.GAS_SHARED_SECRET || !env.DATA_ENCRYPTION_KEY) {
      throw new GasIntegrationError('Konfigurasi integrasi GAS atau enkripsi belum lengkap.');
    }

    const decryptedJson = await decryptSensitiveData(jobDetail.data_snapshot_encrypted, {
      v1: env.DATA_ENCRYPTION_KEY,
    });
    const recipientData = JSON.parse(decryptedJson) as Record<string, unknown>;
    const mappings = JSON.parse(jobDetail.mapping_schema_json) as PlaceholderMappingEntry[];

    const placeholders: Record<string, string> = {};
    let needsQr = false;

    for (const m of mappings) {
      if (m.source === 'verification_qr') {
        needsQr = true;
        continue;
      }
      let rawVal = '';
      if (m.source === 'static_value') {
        rawVal = m.staticValue ?? '';
      } else if (m.source === 'document_number') {
        rawVal = jobDetail.document_number;
      } else if (m.source === 'system_generated') {
        rawVal = formatJakartaDate(nowIso);
      } else if (m.source === 'event_data') {
        const key = m.sourceKey ?? m.placeholder;
        if (key === 'nama_kegiatan') rawVal = jobDetail.event_title;
        else if (key === 'tanggal_kegiatan') rawVal = formatJakartaDate(jobDetail.event_start_at);
        else if (key === 'lokasi_kegiatan') rawVal = jobDetail.event_location;
        else if (key === 'penyelenggara') rawVal = jobDetail.event_organizer;
      } else {
        const key = m.sourceKey ?? m.placeholder;
        rawVal = String(recipientData[key] ?? '');
      }
      placeholders[m.placeholder] = applyTextTransform(rawVal, m.transform);
    }

    let qrPngBase64: string | undefined;
    if (needsQr) {
      const baseUrl = (env.APP_BASE_URL ?? 'https://ecer.puskesmas.local').replace(/\/$/, '');
      const verifyUrl = `${baseUrl}/verifikasi/${jobDetail.verification_code}`;
      qrPngBase64 = await generateQrPngBase64(verifyUrl);
    }

    const gas = new GoogleAppsScriptClient({
      webAppUrl: env.GAS_WEB_APP_URL,
      sharedSecret: env.GAS_SHARED_SECRET,
    });

    const result = await gas.generateDocument(
      {
        jobId: jobDetail.job_id,
        snapshotDocId: jobDetail.snapshot_doc_id ?? jobDetail.google_doc_id,
        documentType: jobDetail.document_type,
        eventId: jobDetail.event_id,
        year: String(new Date().getFullYear()),
        filename: jobDetail.filename,
        placeholders,
        qrPngBase64,
      },
      requestId,
    );

    const doneIso = new Date().toISOString();

    await db.batch([
      db
        .prepare(
          `UPDATE document_revisions
           SET revision_status = 'superseded'
           WHERE document_id = ?1 AND id != ?2 AND revision_status = 'ready'`,
        )
        .bind(jobDetail.document_id, jobDetail.revision_id),
      db
        .prepare(
          `UPDATE document_revisions
           SET drive_file_id = ?2, filename = ?3, file_size = ?4, checksum = ?5, revision_status = 'ready'
           WHERE id = ?1`,
        )
        .bind(
          jobDetail.revision_id,
          result.driveFileId,
          result.filename,
          result.fileSize,
          result.checksum ?? null,
        ),
      db
        .prepare(
          `UPDATE documents
           SET current_revision_id = ?2, document_status = 'ready',
               issued_at = COALESCE(issued_at, ?3), updated_at = ?3
           WHERE id = ?1 AND document_status != 'revoked'`,
        )
        .bind(jobDetail.document_id, jobDetail.revision_id, doneIso),
      db
        .prepare(
          `UPDATE generation_jobs
           SET job_status = 'succeeded', lease_expires_at = NULL,
               error_code = NULL, safe_error_message = NULL, updated_at = ?2
           WHERE id = ?1`,
        )
        .bind(jobDetail.job_id, doneIso),
    ]);

    // Phase 8: Enqueue automatic certificate email if enabled for this event
    try {
      const emailEnqueued = await enqueueCertificateEmailIfEnabled(env, {
        documentId: jobDetail.document_id,
        revisionId: jobDetail.revision_id,
      });
      if (emailEnqueued.immediate && emailEnqueued.jobId) {
        await processEmailJob(env, emailEnqueued.jobId, requestId);
      }
    } catch {
      // Email enqueue/send failure must never roll back a succeeded PDF generation
    }

    return { processed: true, status: 'succeeded' };
  } catch (err) {
    const failIso = new Date().toISOString();
    const errorCode = err instanceof GasIntegrationError ? err.code : ERROR_CODES.GENERATION_FAILED;
    const safeMsg =
      err instanceof Error ? err.message.slice(0, 240) : 'Gagal menghasilkan PDF dokumen.';

    const canRetry = jobDetail.attempts < jobDetail.max_attempts;
    const backoffMinutes = Math.min(60, 2 ** jobDetail.attempts);
    const nextAttemptIso = canRetry
      ? new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
      : null;
    const nextStatus = canRetry ? 'retry_wait' : 'failed';

    const statements = [
      db
        .prepare(
          `UPDATE generation_jobs
           SET job_status = ?2, next_attempt_at = ?3, lease_expires_at = NULL,
               error_code = ?4, safe_error_message = ?5, updated_at = ?6
           WHERE id = ?1`,
        )
        .bind(jobDetail.job_id, nextStatus, nextAttemptIso, errorCode, safeMsg, failIso),
    ];

    if (!canRetry) {
      statements.push(
        db
          .prepare(`UPDATE document_revisions SET revision_status = 'failed' WHERE id = ?1`)
          .bind(jobDetail.revision_id),
        db
          .prepare(
            `UPDATE documents SET document_status = 'failed', updated_at = ?2
             WHERE id = ?1 AND current_revision_id IS NULL`,
          )
          .bind(jobDetail.document_id, failIso),
      );
    }

    await db.batch(statements);
    return { processed: true, status: nextStatus };
  }
}

export async function processDueGenerationJobsBatch(env: WorkerEnv, maxBatch = 2): Promise<number> {
  if (!env.DB) return 0;
  const nowIso = new Date().toISOString();
  const ids = await findClaimableGenerationJobIds(env.DB, nowIso, maxBatch);
  let count = 0;
  for (const id of ids) {
    const res = await processGenerationJob(env, id, crypto.randomUUID());
    if (res.processed) count += 1;
  }
  return count;
}

/**
 * Regenerates a document while preserving its document_number & verification_code (PRD §14.5, AC-18).
 */
export async function regenerateDocument(
  env: WorkerEnv,
  params: { documentId: string; adminId: string; requestId: string },
): Promise<{ jobId: string; revisionNumber: number }> {
  const db = env.DB!;
  const doc = await findDocumentRowById(db, params.documentId);
  if (!doc) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Dokumen tidak ditemukan.', 404);
  }
  if (doc.document_status === 'revoked') {
    throw new AppError(
      ERROR_CODES.DOCUMENT_REVOKED,
      'Dokumen yang telah dicabut tidak dapat diregenerate.',
      409,
    );
  }

  const maxRevRow = await db
    .prepare(
      `SELECT COALESCE(MAX(revision_number), 0) AS max_rev FROM document_revisions WHERE document_id = ?1`,
    )
    .bind(doc.id)
    .first<{ max_rev: number }>();

  const nextRevision = Number(maxRevRow?.max_rev ?? 0) + 1;
  const revisionId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const recipientName = await decryptRecipientName(
    doc.recipient_data_encrypted,
    env.DATA_ENCRYPTION_KEY,
  );
  const filename = buildSafeDocumentFilename({
    documentType: doc.document_type,
    recipientName,
    documentNumber: doc.document_number,
  });
  const nowIso = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        `INSERT INTO document_revisions (
          id, document_id, revision_number, template_version_id, data_snapshot_encrypted,
          drive_file_id, filename, mime_type, file_size, checksum, revision_status,
          created_by, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, 'application/pdf', 0, NULL, 'queued', ?7, ?8)`,
      )
      .bind(
        revisionId,
        doc.id,
        nextRevision,
        doc.template_version_id,
        doc.recipient_data_encrypted,
        filename,
        params.adminId,
        nowIso,
      ),
    db
      .prepare(
        `INSERT INTO generation_jobs (
          id, document_id, revision_number, idempotency_key, job_status,
          attempts, max_attempts, next_attempt_at, lease_expires_at, claimed_by,
          error_code, safe_error_message, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, 'queued', 0, 5, NULL, NULL, NULL, NULL, NULL, ?5, ?5)`,
      )
      .bind(jobId, doc.id, nextRevision, `${doc.id}:${nextRevision}`, nowIso),
  ]);

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'document.regenerate',
    entityType: 'document',
    entityId: doc.id,
    changeSummary: { revisionNumber: nextRevision },
    requestId: params.requestId,
  });

  return { jobId, revisionNumber: nextRevision };
}

/**
 * Revokes a document and invalidates all active download grants (PRD §15.5, AC-20).
 */
export async function revokeDocument(
  db: D1Database,
  params: { documentId: string; reason: string; adminId: string; requestId: string },
): Promise<void> {
  const doc = await findDocumentRowById(db, params.documentId);
  if (!doc) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Dokumen tidak ditemukan.', 404);
  }

  const nowIso = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `UPDATE documents
         SET document_status = 'revoked', revoked_at = ?2, revoked_reason = ?3, updated_at = ?2
         WHERE id = ?1`,
      )
      .bind(doc.id, nowIso, params.reason),
    db
      .prepare(
        `UPDATE download_grants
         SET revoked_at = ?2
         WHERE document_id = ?1 AND revoked_at IS NULL`,
      )
      .bind(doc.id, nowIso),
  ]);

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'document.revoke',
    entityType: 'document',
    entityId: doc.id,
    changeSummary: { reason: params.reason },
    requestId: params.requestId,
  });
}
