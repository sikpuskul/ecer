import { ERROR_CODES } from '../../../shared/constants/api';
import type {
  AdminParticipantItem,
  AdminWhitelistItem,
  PublicEventCard,
  PublicRegisterRequest,
  PublicRegisterResponse,
  SubmissionStatus,
} from '../../../shared/schemas/public';
import { computeEventEligibility } from '../../../shared/utils/event-status';
import { validateDynamicSubmission } from '../../../shared/utils/form-validator';
import type { WorkerEnv } from '../../env';
import { AppError } from '../../middleware/error-handler';
import {
  bytesToHex,
  computeLookupHmac,
  decryptSensitiveData,
  encryptSensitiveData,
  sha256Hex,
} from '../../security/crypto';
import { verifyPassword } from '../../security/password';
import { verifyTurnstileToken } from '../../security/turnstile';
import { insertAuditLog } from '../auth/repository';
import { queueDocumentForParticipant } from '../documents/service';
import { findEventRowById, type EventRow } from '../events/repository';
import { listFormVersionsByEvent } from '../forms/repository';
import { listSettings } from '../settings/repository';
import {
  countActiveParticipants,
  findParticipantById,
  findPublicEventBySlug,
  findUnusedWhitelistEntry,
  insertParticipantAndMarkWhitelist,
  insertWhitelistEntries,
  listParticipantsByEvent,
  listWhitelistByEvent,
  updateParticipantStatus,
} from './repository';

/**
 * Generates a cryptographically secure 128-bit recovery code formatted for readability (PRD §16.3).
 */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = bytesToHex(bytes).toUpperCase();
  return `ECER-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`;
}

export function mapPublicEventCard(row: EventRow): PublicEventCard {
  const participantCount = Number(row.participant_count ?? 0);
  const status = row.lifecycle_status === 'draft' ? 'closed' : row.lifecycle_status;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name ?? 'Lainnya',
    organizer: row.organizer,
    location: row.location,
    flyerUrl: row.flyer_key ? `/api/v1/public/assets/${row.flyer_key}` : null,
    eventStartAt: row.event_start_at,
    eventEndAt: row.event_end_at,
    registrationStartAt: row.registration_start_at,
    registrationEndAt: row.registration_end_at,
    downloadStartAt: row.download_start_at,
    downloadEndAt: row.download_end_at,
    quota: row.quota,
    participantCount,
    attendanceMode: row.attendance_mode,
    issuanceMode: row.issuance_mode,
    lifecycleStatus: status,
    searchKeyField: row.search_key_field,
    eligibility: computeEventEligibility({
      lifecycleStatus: row.lifecycle_status,
      registrationStartAt: row.registration_start_at,
      registrationEndAt: row.registration_end_at,
      downloadStartAt: row.download_start_at,
      downloadEndAt: row.download_end_at,
      quota: row.quota,
      participantCount,
    }),
  };
}

function getRequiredCryptoKeys(env: WorkerEnv): { encryptionKey: string; lookupHmacKey: string } {
  if (!env.DATA_ENCRYPTION_KEY || !env.LOOKUP_HMAC_KEY) {
    throw new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      'Kunci enkripsi data belum dikonfigurasi pada runtime ini.',
      500,
    );
  }
  return {
    encryptionKey: env.DATA_ENCRYPTION_KEY,
    lookupHmacKey: env.LOOKUP_HMAC_KEY,
  };
}

function lookupFieldValue(sanitized: Record<string, unknown>, fieldKey: string): string {
  const direct = sanitized[fieldKey];
  if (direct !== undefined && direct !== null) return String(direct).trim();

  const lowerTarget = fieldKey.trim().toLowerCase();
  const lowerDirect = sanitized[lowerTarget];
  if (lowerDirect !== undefined && lowerDirect !== null) return String(lowerDirect).trim();

  for (const [k, v] of Object.entries(sanitized)) {
    if (k.trim().toLowerCase() === lowerTarget && v !== undefined && v !== null) {
      return String(v).trim();
    }
  }
  return '';
}

export async function registerPublicParticipant(
  env: WorkerEnv,
  params: {
    slug: string;
    input: PublicRegisterRequest;
    remoteIp?: string | null;
    requestId: string;
  },
): Promise<{ response: PublicRegisterResponse; generationJobId: string | null }> {
  const db = env.DB!;
  const eventRow = await findPublicEventBySlug(db, params.slug);
  if (!eventRow) {
    throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
  }

  // 1. Server-side period, lifecycle, and quota enforcement (AC-04, AC-09)
  const card = mapPublicEventCard(eventRow);
  if (
    card.eligibility.computedState === 'closed' ||
    card.eligibility.computedState === 'archived'
  ) {
    throw new AppError(ERROR_CODES.EVENT_CLOSED, 'Kegiatan telah ditutup.', 409);
  }
  if (card.eligibility.computedState === 'upcoming') {
    throw new AppError(
      ERROR_CODES.REGISTRATION_NOT_STARTED,
      'Periode pengisian sertifikat belum dibuka.',
      409,
    );
  }
  if (card.eligibility.computedState === 'quota_full') {
    throw new AppError(ERROR_CODES.QUOTA_FULL, 'Kuota peserta kegiatan telah penuh.', 409);
  }
  if (!card.eligibility.canRegister) {
    throw new AppError(
      ERROR_CODES.REGISTRATION_CLOSED,
      'Periode pengisian sertifikat telah berakhir.',
      409,
    );
  }

  // 2. Turnstile verification
  const turnstile = await verifyTurnstileToken({
    secretKey: env.TURNSTILE_SECRET_KEY,
    token: params.input.turnstileToken,
    remoteIp: params.remoteIp,
    appEnv: env.APP_ENV,
  });
  if (!turnstile.ok) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Verifikasi keamanan Turnstile gagal. Silakan coba lagi.',
      422,
    );
  }

  // 3. Attendance PIN validation (if attendance_mode === 'pin')
  if (eventRow.attendance_mode === 'pin') {
    if (!params.input.attendancePin || !eventRow.event_pin_hash) {
      throw new AppError(ERROR_CODES.INVALID_ATTENDANCE, 'PIN kegiatan tidak valid.', 403);
    }
    const pinOk = await verifyPassword(params.input.attendancePin, eventRow.event_pin_hash);
    if (!pinOk) {
      throw new AppError(ERROR_CODES.INVALID_ATTENDANCE, 'PIN kegiatan tidak valid.', 403);
    }
  }

  // 4. Active published form validation
  const formVersions = await listFormVersionsByEvent(db, eventRow.id);
  const activeForm = formVersions.find((v) => v.status === 'published');
  if (!activeForm) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Formulir kegiatan belum dipublikasikan oleh panitia.',
      409,
    );
  }

  const validation = validateDynamicSubmission(activeForm.fields, params.input.values);
  if (!validation.valid) {
    const firstMsg = Object.values(validation.errors)[0] ?? 'Data formulir belum valid.';
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, firstMsg, 422);
  }

  const uniqueRaw = lookupFieldValue(validation.sanitized, eventRow.unique_key_field);
  const searchRaw = lookupFieldValue(validation.sanitized, eventRow.search_key_field) || uniqueRaw;
  if (!uniqueRaw) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `Field kunci unik (${eventRow.unique_key_field}) wajib diisi.`,
      422,
    );
  }

  const { encryptionKey, lookupHmacKey } = getRequiredCryptoKeys(env);
  const uniqueKeyHash = await computeLookupHmac(lookupHmacKey, uniqueRaw);
  const searchKeyHash = await computeLookupHmac(lookupHmacKey, searchRaw);

  // 5. Whitelist check (if attendance_mode === 'whitelist')
  let whitelistId: string | undefined;
  if (eventRow.attendance_mode === 'whitelist') {
    const wl = await findUnusedWhitelistEntry(db, eventRow.id, uniqueKeyHash);
    if (!wl || wl.used_by_participant_id !== null) {
      throw new AppError(
        ERROR_CODES.INVALID_ATTENDANCE,
        'Data Anda tidak terdaftar pada daftar peserta yang diizinkan atau sudah digunakan.',
        403,
      );
    }
    whitelistId = wl.id;
  }

  // 6. Re-check quota right before insert
  if (eventRow.quota !== null) {
    const currentCount = await countActiveParticipants(db, eventRow.id);
    if (currentCount >= eventRow.quota) {
      throw new AppError(ERROR_CODES.QUOTA_FULL, 'Kuota peserta kegiatan telah penuh.', 409);
    }
  }

  // 7. Encrypt PII & generate 128-bit recovery code
  const encryptedData = await encryptSensitiveData(
    JSON.stringify(validation.sanitized),
    encryptionKey,
    'v1',
  );
  const rawEmail = typeof validation.sanitized.email === 'string' ? validation.sanitized.email : '';
  const emailEncrypted = rawEmail
    ? await encryptSensitiveData(rawEmail, encryptionKey, 'v1')
    : null;

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await sha256Hex(recoveryCode);

  const settings = await listSettings(db);
  const submissionStatus: SubmissionStatus =
    eventRow.issuance_mode === 'manual_approval' ? 'pending_review' : 'approved';
  const participantId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  try {
    await insertParticipantAndMarkWhitelist(db, {
      id: participantId,
      eventId: eventRow.id,
      formVersionId: activeForm.id,
      uniqueKeyHash,
      searchKeyHash,
      encryptedData,
      emailEncrypted,
      recoveryCodeHash,
      submissionStatus,
      consentVersion: settings.privacy_notice_version || '1.0',
      nowIso,
      whitelistId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.toLowerCase().includes('unique')) {
      // PRD §12.2: Generic anti-enumeration duplicate response
      throw new AppError(
        ERROR_CODES.DUPLICATE_PARTICIPANT,
        'Pengajuan tidak dapat diproses karena data sudah terdaftar. Gunakan kode pemulihan pada fitur Cari Sertifikat atau hubungi panitia.',
        409,
      );
    }
    throw err;
  }

  let generationJobId: string | null = null;
  if (submissionStatus === 'approved') {
    const recipientName =
      lookupFieldValue(validation.sanitized, 'nama_lengkap') ||
      lookupFieldValue(validation.sanitized, 'nama') ||
      'Peserta';
    try {
      const queued = await queueDocumentForParticipant(env, {
        eventId: eventRow.id,
        eventCode: eventRow.event_code,
        participantId,
        recipientDataEncrypted: encryptedData,
        recipientName,
        adminId: null,
      });
      generationJobId = queued?.jobId || null;
    } catch {
      // Never fail registration if document queueing encounters an issue
    }
  }

  return {
    response: {
      participantId,
      submissionStatus,
      recoveryCode,
      message:
        submissionStatus === 'pending_review'
          ? 'Data Anda berhasil dikirim dan sedang menunggu persetujuan panitia. Simpan kode pemulihan di bawah ini.'
          : 'Data Anda berhasil dikirim. Simpan kode pemulihan di bawah ini untuk mengakses atau mengunduh sertifikat Anda.',
    },
    generationJobId,
  };
}

export async function getAdminParticipants(
  env: WorkerEnv,
  params: { eventId: string; status?: string; page: number; limit: number },
): Promise<{ items: AdminParticipantItem[]; total: number }> {
  const db = env.DB!;
  const { encryptionKey } = getRequiredCryptoKeys(env);
  const { rows, total } = await listParticipantsByEvent(db, params);

  const items: AdminParticipantItem[] = [];
  for (const row of rows) {
    let data: Record<string, unknown> = {};
    let email: string | null = null;
    try {
      const dec = await decryptSensitiveData(row.encrypted_data, { v1: encryptionKey });
      data = JSON.parse(dec) as Record<string, unknown>;
    } catch {
      data = { _error: 'Gagal mendekripsi data' };
    }
    if (row.email_encrypted) {
      try {
        email = await decryptSensitiveData(row.email_encrypted, { v1: encryptionKey });
      } catch {
        email = null;
      }
    }
    items.push({
      id: row.id,
      eventId: row.event_id,
      formVersionId: row.form_version_id,
      submissionStatus: row.submission_status,
      data,
      email,
      submittedAt: row.submitted_at,
      approvedAt: row.approved_at,
    });
  }

  return { items, total };
}

export async function transitionParticipantStatus(
  env: WorkerEnv,
  params: {
    participantId: string;
    targetStatus: 'approved' | 'rejected' | 'cancelled';
    adminId: string;
    requestId: string;
  },
): Promise<{ generationJobId: string | null }> {
  const db = env.DB!;
  const existing = await findParticipantById(db, params.participantId);
  if (!existing) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Data peserta tidak ditemukan.', 404);
  }

  const nowIso = new Date().toISOString();
  await updateParticipantStatus(db, {
    id: existing.id,
    status: params.targetStatus,
    adminId: params.adminId,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: `participant.${params.targetStatus}`,
    entityType: 'participant',
    entityId: existing.id,
    changeSummary: {
      eventId: existing.event_id,
      from: existing.submission_status,
      to: params.targetStatus,
    },
    requestId: params.requestId,
  });

  let generationJobId: string | null = null;
  if (params.targetStatus === 'approved') {
    const event = await findEventRowById(db, existing.event_id);
    if (event) {
      let recipientName = 'Peserta';
      if (env.DATA_ENCRYPTION_KEY) {
        try {
          const dec = await decryptSensitiveData(existing.encrypted_data, {
            v1: env.DATA_ENCRYPTION_KEY,
          });
          const parsed = JSON.parse(dec) as Record<string, unknown>;
          recipientName =
            lookupFieldValue(parsed, 'nama_lengkap') ||
            lookupFieldValue(parsed, 'nama') ||
            'Peserta';
        } catch {
          recipientName = 'Peserta';
        }
      }
      const queued = await queueDocumentForParticipant(env, {
        eventId: event.id,
        eventCode: event.event_code,
        participantId: existing.id,
        recipientDataEncrypted: existing.encrypted_data,
        recipientName,
        adminId: params.adminId,
      });
      generationJobId = queued?.jobId || null;
    }
  }

  return { generationJobId };
}

export async function getAdminWhitelist(
  env: WorkerEnv,
  eventId: string,
): Promise<AdminWhitelistItem[]> {
  const db = env.DB!;
  const { encryptionKey } = getRequiredCryptoKeys(env);
  const rows = await listWhitelistByEvent(db, eventId);

  const items: AdminWhitelistItem[] = [];
  for (const row of rows) {
    let label = 'Peserta terdaftar';
    if (row.encrypted_data) {
      try {
        label = await decryptSensitiveData(row.encrypted_data, { v1: encryptionKey });
      } catch {
        label = 'Peserta terdaftar';
      }
    }
    items.push({
      id: row.id,
      label,
      usedByParticipantId: row.used_by_participant_id,
      createdAt: row.created_at,
    });
  }
  return items;
}

export async function addAdminWhitelistEntries(
  env: WorkerEnv,
  params: {
    eventId: string;
    entries: Array<{ key: string; label?: string }>;
    adminId: string;
    requestId: string;
  },
): Promise<{ addedCount: number }> {
  const db = env.DB!;
  const { encryptionKey, lookupHmacKey } = getRequiredCryptoKeys(env);
  const nowIso = new Date().toISOString();

  const prepared = [];
  for (const item of params.entries) {
    const keyHash = await computeLookupHmac(lookupHmacKey, item.key);
    const labelText = item.label?.trim() || `${item.key.slice(0, 3)}***`;
    const encryptedData = await encryptSensitiveData(labelText, encryptionKey, 'v1');
    prepared.push({
      id: crypto.randomUUID(),
      eventId: params.eventId,
      keyHash,
      encryptedData,
      nowIso,
    });
  }

  await insertWhitelistEntries(db, prepared);

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'event_whitelist.add',
    entityType: 'event',
    entityId: params.eventId,
    changeSummary: { count: prepared.length },
    requestId: params.requestId,
  });

  return { addedCount: prepared.length };
}
