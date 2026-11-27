import { ERROR_CODES } from '../../../shared/constants/api';
import type { EmailJobItem, EmailJobsSummary } from '../../../shared/schemas/email';
import { EventEmailConfigSchema } from '../../../shared/schemas/events';
import {
  computeNextJakartaQuotaResetIso,
  maskEmailAddress,
  renderEmailTemplate,
  sanitizeEmailSubject,
} from '../../../shared/utils/email-template';
import { formatJakartaDate } from '../../../shared/utils/jakarta-date';
import type { WorkerEnv } from '../../env';
import {
  GasIntegrationError,
  GoogleAppsScriptClient,
} from '../../integrations/google-apps-script/client';
import { AppError } from '../../middleware/error-handler';
import { decryptSensitiveData, encryptSensitiveData } from '../../security/crypto';
import { insertAuditLog } from '../auth/repository';
import {
  claimEmailJobAtomically,
  findDueEmailJobIds,
  getEmailJobExecutionDetail,
  getEmailJobsStatusCounts,
  insertEmailJobIdempotent,
  listEmailJobs,
  markEmailJobSent,
  markEmailJobStatus,
} from './repository';

const EMAIL_LEASE_MS = 2 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 5;

interface EmailTemplateSnapshot {
  subject: string;
  body: string;
}

function parseEmailTemplateSnapshot(raw: string): EmailTemplateSnapshot {
  try {
    const parsed = JSON.parse(raw) as Partial<EmailTemplateSnapshot>;
    return {
      subject: typeof parsed.subject === 'string' ? parsed.subject : 'Sertifikat Kegiatan ECER',
      body: typeof parsed.body === 'string' ? parsed.body : '',
    };
  } catch {
    return { subject: 'Sertifikat Kegiatan ECER', body: '' };
  }
}

function extractRecipientEmail(data: Record<string, unknown>): string | null {
  for (const key of ['email', 'alamat_email', 'email_peserta']) {
    const val = data[key];
    if (typeof val === 'string' && val.includes('@')) {
      return val.trim().toLowerCase();
    }
  }
  return null;
}

function extractRecipientName(data: Record<string, unknown>): string {
  for (const key of ['nama_lengkap', 'nama', 'full_name', 'name']) {
    const val = data[key];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return 'Peserta';
}

export async function enqueueCertificateEmailIfEnabled(
  env: WorkerEnv,
  params: {
    documentId: string;
    revisionId: string;
    manualOverride?: { subject?: string; body?: string; manualKey?: string };
  },
): Promise<{ enqueued: boolean; jobId?: string; immediate: boolean }> {
  const db = env.DB!;
  if (!env.DATA_ENCRYPTION_KEY) {
    return { enqueued: false, immediate: false };
  }

  const row = await db
    .prepare(
      `SELECT d.id AS document_id, d.document_number, d.verification_code, d.document_status,
              d.recipient_data_encrypted, d.participant_id,
              p.email_encrypted AS participant_email_encrypted,
              e.title AS event_title, e.event_start_at, e.organizer, e.email_config_json,
              e.email_release_at, e.download_start_at
       FROM documents d
       INNER JOIN events e ON e.id = d.event_id
       LEFT JOIN participants p ON p.id = d.participant_id
       WHERE d.id = ?1
       LIMIT 1`,
    )
    .bind(params.documentId)
    .first<{
      document_id: string;
      document_number: string;
      verification_code: string;
      document_status: string;
      recipient_data_encrypted: string;
      participant_id: string | null;
      participant_email_encrypted: string | null;
      event_title: string;
      event_start_at: string;
      organizer: string;
      email_config_json: string;
      email_release_at: string | null;
      download_start_at: string | null;
    }>();

  if (!row || row.document_status === 'revoked') {
    return { enqueued: false, immediate: false };
  }

  let parsedConfig = EventEmailConfigSchema.parse({});
  try {
    parsedConfig = EventEmailConfigSchema.parse(JSON.parse(row.email_config_json || '{}'));
  } catch {
    parsedConfig = EventEmailConfigSchema.parse({});
  }

  if (!params.manualOverride && !parsedConfig.autoSend) {
    return { enqueued: false, immediate: false };
  }

  const recipientDataJson = await decryptSensitiveData(row.recipient_data_encrypted, {
    v1: env.DATA_ENCRYPTION_KEY,
  });
  const recipientData = JSON.parse(recipientDataJson) as Record<string, unknown>;

  let recipientEmailEncrypted = row.participant_email_encrypted;
  if (!recipientEmailEncrypted) {
    const rawEmail = extractRecipientEmail(recipientData);
    if (!rawEmail) {
      return { enqueued: false, immediate: false };
    }
    recipientEmailEncrypted = await encryptSensitiveData(rawEmail, env.DATA_ENCRYPTION_KEY, 'v1');
  }

  const baseUrl = (env.APP_BASE_URL ?? 'https://ecer.siksumakul.workers.dev').replace(/\/+$/, '');
  const vars: Record<string, string> = {
    nama_lengkap: extractRecipientName(recipientData),
    nama_kegiatan: row.event_title,
    nomor_dokumen: row.document_number,
    tanggal_kegiatan: formatJakartaDate(row.event_start_at),
    penyelenggara: row.organizer || env.ORGANIZATION_NAME || 'Puskesmas Sumbermanjing Kulon',
    link_verifikasi: `${baseUrl}/verifikasi/${row.verification_code}`,
  };

  const subject = sanitizeEmailSubject(
    renderEmailTemplate(params.manualOverride?.subject ?? parsedConfig.subject, vars),
  );
  const body = renderEmailTemplate(params.manualOverride?.body ?? parsedConfig.body, vars);

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let nextAttemptAt: string | null = null;

  if (!params.manualOverride) {
    const releaseCandidates: number[] = [];
    if (row.email_release_at) {
      const ts = Date.parse(row.email_release_at);
      if (Number.isFinite(ts) && ts > nowMs) releaseCandidates.push(ts);
    }
    if (parsedConfig.embargoUntilDownloadStart && row.download_start_at) {
      const ts = Date.parse(row.download_start_at);
      if (Number.isFinite(ts) && ts > nowMs) releaseCandidates.push(ts);
    }
    if (releaseCandidates.length > 0) {
      nextAttemptAt = new Date(Math.max(...releaseCandidates)).toISOString();
    }
  }

  const idempotencyKey = params.manualOverride?.manualKey
    ? `email:manual:${params.documentId}:${params.revisionId}:${params.manualOverride.manualKey}`
    : `email:auto:${params.documentId}:${params.revisionId}`;

  const result = await insertEmailJobIdempotent(db, {
    id: crypto.randomUUID(),
    documentId: params.documentId,
    revisionId: params.revisionId,
    recipientEmailEncrypted,
    emailTemplateJson: JSON.stringify({ subject, body }),
    idempotencyKey,
    nextAttemptAt,
    nowIso,
  });

  return {
    enqueued: result.inserted,
    jobId: result.jobId,
    immediate: result.inserted && nextAttemptAt === null,
  };
}

export async function processEmailJob(
  env: WorkerEnv,
  jobId: string,
  requestId: string,
): Promise<{ processed: boolean; status: string }> {
  const db = env.DB!;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const leaseExpiresIso = new Date(nowMs + EMAIL_LEASE_MS).toISOString();

  const claimed = await claimEmailJobAtomically(db, { jobId, nowIso, leaseExpiresIso });
  if (!claimed) {
    return { processed: false, status: 'not_claimable' };
  }

  const detail = await getEmailJobExecutionDetail(db, jobId);
  if (!detail) {
    return { processed: false, status: 'missing_record' };
  }

  if (detail.document_status === 'revoked') {
    await markEmailJobStatus(db, {
      jobId,
      status: 'cancelled',
      nextAttemptAt: null,
      errorCode: ERROR_CODES.DOCUMENT_REVOKED,
      safeErrorMessage: 'Pengiriman dibatalkan karena dokumen telah dicabut.',
      nowIso: new Date().toISOString(),
    });
    return { processed: true, status: 'cancelled' };
  }

  if (detail.document_status !== 'ready' || !detail.drive_file_id) {
    await markEmailJobStatus(db, {
      jobId,
      status: 'retry_wait',
      nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      errorCode: ERROR_CODES.GENERATION_PENDING,
      safeErrorMessage: 'Menunggu file PDF dokumen siap.',
      nowIso: new Date().toISOString(),
    });
    return { processed: true, status: 'retry_wait' };
  }

  try {
    if (!env.GAS_WEB_APP_URL || !env.GAS_SHARED_SECRET || !env.DATA_ENCRYPTION_KEY) {
      throw new GasIntegrationError('Konfigurasi layanan email GAS atau enkripsi belum lengkap.');
    }

    const to = await decryptSensitiveData(detail.recipient_email_encrypted, {
      v1: env.DATA_ENCRYPTION_KEY,
    });
    const template = parseEmailTemplateSnapshot(detail.email_template_json);

    const gas = new GoogleAppsScriptClient({
      webAppUrl: env.GAS_WEB_APP_URL,
      sharedSecret: env.GAS_SHARED_SECRET,
    });

    await gas.sendEmail(
      {
        jobId,
        to,
        subject: template.subject,
        body: template.body,
        driveFileId: detail.drive_file_id,
      },
      requestId,
    );

    await markEmailJobSent(db, jobId, new Date().toISOString());
    return { processed: true, status: 'sent' };
  } catch (err) {
    const failIso = new Date().toISOString();
    const isQuotaError =
      (err instanceof GasIntegrationError && err.code === 'EMAIL_QUOTA_EXCEEDED') ||
      (err instanceof Error && err.message.includes('EMAIL_QUOTA_EXCEEDED'));

    if (isQuotaError) {
      await markEmailJobStatus(db, {
        jobId,
        status: 'deferred_quota',
        nextAttemptAt: computeNextJakartaQuotaResetIso(),
        errorCode: 'EMAIL_QUOTA_EXCEEDED',
        safeErrorMessage:
          'Kuota email harian MailApp habis; dijadwalkan ulang setelah reset kuota.',
        nowIso: failIso,
      });
      return { processed: true, status: 'deferred_quota' };
    }

    const errorCode = err instanceof GasIntegrationError ? err.code : 'EMAIL_DELIVERY_FAILED';
    const safeMsg =
      err instanceof Error ? err.message.slice(0, 220) : 'Gagal mengirim email sertifikat.';
    const canRetry = detail.attempts < EMAIL_MAX_ATTEMPTS;
    const backoffMinutes = Math.min(60, 2 ** detail.attempts);

    await markEmailJobStatus(db, {
      jobId,
      status: canRetry ? 'retry_wait' : 'failed',
      nextAttemptAt: canRetry
        ? new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
        : null,
      errorCode,
      safeErrorMessage: safeMsg,
      nowIso: failIso,
    });

    return { processed: true, status: canRetry ? 'retry_wait' : 'failed' };
  }
}

export async function processDueEmailJobsBatch(
  env: WorkerEnv,
  maxJobs = 3,
): Promise<{ attempted: number; sent: number; deferredQuota: boolean }> {
  const db = env.DB;
  if (!db) return { attempted: 0, sent: 0, deferredQuota: false };

  const dueIds = await findDueEmailJobIds(db, new Date().toISOString(), maxJobs);
  let sent = 0;
  let deferredQuota = false;

  for (const id of dueIds) {
    const res = await processEmailJob(env, id, `cron-email-${id.slice(0, 8)}`);
    if (res.status === 'sent') sent += 1;
    if (res.status === 'deferred_quota') {
      deferredQuota = true;
      break;
    }
  }

  return { attempted: dueIds.length, sent, deferredQuota };
}

export async function getAdminEmailJobsList(
  env: WorkerEnv,
  params: { page: number; limit: number; status?: string },
): Promise<{ items: EmailJobItem[]; total: number }> {
  const { rows, total } = await listEmailJobs(env.DB!, params);
  const items: EmailJobItem[] = [];

  for (const row of rows) {
    let maskedEmail = '***';
    if (env.DATA_ENCRYPTION_KEY) {
      try {
        const plain = await decryptSensitiveData(row.recipient_email_encrypted, {
          v1: env.DATA_ENCRYPTION_KEY,
        });
        maskedEmail = maskEmailAddress(plain);
      } catch {
        maskedEmail = '***';
      }
    }
    const tpl = parseEmailTemplateSnapshot(row.email_template_json);
    items.push({
      id: row.id,
      documentId: row.document_id,
      documentNumber: row.document_number,
      eventTitle: row.event_title,
      maskedEmail,
      subject: tpl.subject,
      jobStatus: row.job_status,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      sentAt: row.sent_at,
      errorCode: row.error_code,
      safeErrorMessage: row.safe_error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  return { items, total };
}

export async function getAdminEmailJobsSummary(
  env: WorkerEnv,
  requestId: string,
): Promise<EmailJobsSummary> {
  const counts = await getEmailJobsStatusCounts(env.DB!);
  let remainingDailyQuota: number | null = null;
  let quotaCheckedAt: string | null = null;

  if (env.GAS_WEB_APP_URL && env.GAS_SHARED_SECRET) {
    try {
      const gas = new GoogleAppsScriptClient({
        webAppUrl: env.GAS_WEB_APP_URL,
        sharedSecret: env.GAS_SHARED_SECRET,
        timeoutMs: 8_000,
        maxRetries: 0,
      });
      const quota = await gas.getEmailQuota(requestId);
      remainingDailyQuota = quota.remainingDailyQuota;
      quotaCheckedAt = quota.checkedAt;
    } catch {
      remainingDailyQuota = null;
    }
  }

  return {
    queued: counts.queued,
    processing: counts.processing,
    sent: counts.sent,
    failed: counts.failed,
    deferredQuota: counts.deferred_quota,
    retryWait: counts.retry_wait,
    needsReview: counts.needs_review,
    cancelled: counts.cancelled,
    remainingDailyQuota,
    quotaCheckedAt,
  };
}

export async function manualResendDocumentEmail(
  env: WorkerEnv,
  params: {
    documentId: string;
    adminId: string;
    requestId: string;
    overrideSubject?: string;
    overrideBody?: string;
  },
): Promise<{ jobId: string }> {
  const db = env.DB!;
  const doc = await db
    .prepare(`SELECT id, current_revision_id, document_status FROM documents WHERE id = ?1 LIMIT 1`)
    .bind(params.documentId)
    .first<{ id: string; current_revision_id: string | null; document_status: string }>();

  if (!doc) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Dokumen tidak ditemukan.', 404);
  }
  if (doc.document_status !== 'ready' || !doc.current_revision_id) {
    throw new AppError(
      ERROR_CODES.GENERATION_PENDING,
      'Email hanya dapat dikirim untuk dokumen berstatus ready.',
      409,
    );
  }

  const enqueued = await enqueueCertificateEmailIfEnabled(env, {
    documentId: doc.id,
    revisionId: doc.current_revision_id,
    manualOverride: {
      subject: params.overrideSubject,
      body: params.overrideBody,
      manualKey: crypto.randomUUID(),
    },
  });

  if (!enqueued.enqueued || !enqueued.jobId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Alamat email penerima tidak tersedia untuk dokumen ini.',
      422,
    );
  }

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'email_job.manual_resend',
    entityType: 'document',
    entityId: doc.id,
    changeSummary: { emailJobId: enqueued.jobId },
    requestId: params.requestId,
  });

  return { jobId: enqueued.jobId };
}

export async function sendRecoveryOtpEmail(
  env: WorkerEnv,
  params: {
    emailEncrypted: string;
    eventTitle: string;
    otpCode: string;
    requestId: string;
  },
): Promise<void> {
  if (!env.GAS_WEB_APP_URL || !env.GAS_SHARED_SECRET || !env.DATA_ENCRYPTION_KEY) {
    return;
  }

  try {
    const to = await decryptSensitiveData(params.emailEncrypted, {
      v1: env.DATA_ENCRYPTION_KEY,
    });
    const orgName = env.ORGANIZATION_NAME ?? 'Puskesmas Sumbermanjing Kulon';
    const gas = new GoogleAppsScriptClient({
      webAppUrl: env.GAS_WEB_APP_URL,
      sharedSecret: env.GAS_SHARED_SECRET,
      timeoutMs: 12_000,
      maxRetries: 0,
    });

    await gas.sendEmail(
      {
        jobId: `otp-${crypto.randomUUID()}`,
        to,
        subject: sanitizeEmailSubject(`Kode OTP Akses Sertifikat - ${params.eventTitle}`),
        body: [
          'Halo,',
          '',
          `Berikut adalah kode OTP Anda untuk mengakses sertifikat kegiatan "${params.eventTitle}":`,
          '',
          params.otpCode,
          '',
          'Kode ini berlaku selama 5 menit dan hanya dapat digunakan maksimal 5 kali percobaan.',
          'Jika Anda tidak meminta kode ini, silakan abaikan email ini.',
          '',
          orgName,
        ].join('\n'),
      },
      params.requestId,
    );
  } catch {
    // Best-effort delivery; never expose email or OTP errors to unauthenticated callers
  }
}
