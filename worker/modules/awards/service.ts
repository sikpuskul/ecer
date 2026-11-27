import { ERROR_CODES } from '../../../shared/constants/api';
import type {
  AdminAwardItem,
  BulkAwardRow,
  CreateManualAwardInput,
  ImportAwardsFromParticipantsInput,
} from '../../../shared/schemas/awards';
import { sanitizeSpreadsheetCell } from '../../../shared/utils/csv-awards';
import { buildSafeDocumentFilename } from '../../../shared/utils/numbering';
import type { WorkerEnv } from '../../env';
import { AppError } from '../../middleware/error-handler';
import {
  decryptSensitiveData,
  encryptSensitiveData,
  generateOpaqueToken,
} from '../../security/crypto';
import { insertAuditLog } from '../auth/repository';
import { allocateNextDocumentNumber, findNumberingRuleById } from '../numbering/repository';
import {
  findAwardEventTemplateById,
  findParticipantsByIdsForEvent,
  listAdminAwardRows,
} from './repository';

function slugifyKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function createAwardDocumentRecord(
  env: WorkerEnv,
  params: {
    eventId: string;
    eventCode: string;
    eventTemplateId: string;
    templateVersionId: string;
    numberingRuleId: string;
    participantId: string | null;
    issuanceKey: string;
    row: BulkAwardRow;
    adminId: string;
  },
): Promise<{ documentId: string; documentNumber: string; jobId: string; alreadyExisted: boolean }> {
  const db = env.DB!;
  if (!env.DATA_ENCRYPTION_KEY) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Kunci enkripsi data belum dikonfigurasi.', 500);
  }

  const existing = await db
    .prepare(`SELECT id, document_number FROM documents WHERE issuance_key = ?1 LIMIT 1`)
    .bind(params.issuanceKey)
    .first<{ id: string; document_number: string }>();

  if (existing) {
    return {
      documentId: existing.id,
      documentNumber: existing.document_number,
      jobId: '',
      alreadyExisted: true,
    };
  }

  const rule = await findNumberingRuleById(db, params.numberingRuleId);
  if (!rule) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      'Aturan penomoran template piagam tidak ditemukan.',
      404,
    );
  }

  const { documentNumber } = await allocateNextDocumentNumber(db, {
    rule,
    eventId: params.eventId,
    eventCode: params.eventCode,
  });

  const cleanName = sanitizeSpreadsheetCell(params.row.recipientName);
  const cleanCategory = sanitizeSpreadsheetCell(params.row.awardCategory);
  const cleanInstitution = sanitizeSpreadsheetCell(params.row.institution ?? '');
  const cleanNotes = sanitizeSpreadsheetCell(params.row.notes ?? '');
  const cleanEmail = (params.row.email ?? '').trim().toLowerCase();

  const payloadObj: Record<string, string> = {
    nama_lengkap: cleanName,
    kategori_penghargaan: cleanCategory,
    peran: cleanCategory,
    instansi: cleanInstitution,
    keterangan: cleanNotes,
    ...(cleanEmail ? { email: cleanEmail } : {}),
  };

  const encryptedData = await encryptSensitiveData(
    JSON.stringify(payloadObj),
    env.DATA_ENCRYPTION_KEY,
    'v1',
  );

  const documentId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const publicId = generateOpaqueToken(16);
  const verificationCode = generateOpaqueToken(16);
  const filename = buildSafeDocumentFilename({
    documentType: 'award',
    recipientName: cleanName,
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
          ?7, 'award', ?8, ?9, ?10,
          ?11, NULL, 'queued',
          NULL, NULL, NULL, ?12, ?13, ?13
        )`,
      )
      .bind(
        documentId,
        publicId,
        params.eventId,
        params.participantId,
        params.eventTemplateId,
        params.templateVersionId,
        params.numberingRuleId,
        documentNumber,
        verificationCode,
        params.issuanceKey,
        encryptedData,
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
        params.templateVersionId,
        encryptedData,
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

  return { documentId, documentNumber, jobId, alreadyExisted: false };
}

export async function issueManualAward(
  env: WorkerEnv,
  params: { input: CreateManualAwardInput; adminId: string; requestId: string },
): Promise<{ documentId: string; documentNumber: string; jobId: string }> {
  const db = env.DB!;
  const link = await findAwardEventTemplateById(
    db,
    params.input.eventId,
    params.input.eventTemplateId,
  );
  if (!link) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      'Template piagam aktif tidak ditemukan pada kegiatan tersebut.',
      404,
    );
  }

  const issuanceKey = `award:manual:${link.eventId}:${link.eventTemplateId}:${crypto.randomUUID()}`;
  const result = await createAwardDocumentRecord(env, {
    eventId: link.eventId,
    eventCode: link.eventCode,
    eventTemplateId: link.eventTemplateId,
    templateVersionId: link.templateVersionId,
    numberingRuleId: link.numberingRuleId,
    participantId: null,
    issuanceKey,
    row: params.input,
    adminId: params.adminId,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'award.issued',
    entityType: 'document',
    entityId: result.documentId,
    changeSummary: {
      eventId: link.eventId,
      awardCategory: params.input.awardCategory,
      documentNumber: result.documentNumber,
    },
    requestId: params.requestId,
  });

  return {
    documentId: result.documentId,
    documentNumber: result.documentNumber,
    jobId: result.jobId,
  };
}

export async function bulkImportAwards(
  env: WorkerEnv,
  params: {
    eventId: string;
    eventTemplateId: string;
    rows: BulkAwardRow[];
    adminId: string;
    requestId: string;
  },
): Promise<{ issuedCount: number; jobIds: string[] }> {
  const db = env.DB!;
  const link = await findAwardEventTemplateById(db, params.eventId, params.eventTemplateId);
  if (!link) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      'Template piagam aktif tidak ditemukan pada kegiatan tersebut.',
      404,
    );
  }

  const jobIds: string[] = [];
  for (const row of params.rows) {
    const issuanceKey = `award:bulk:${link.eventId}:${link.eventTemplateId}:${crypto.randomUUID()}`;
    const created = await createAwardDocumentRecord(env, {
      eventId: link.eventId,
      eventCode: link.eventCode,
      eventTemplateId: link.eventTemplateId,
      templateVersionId: link.templateVersionId,
      numberingRuleId: link.numberingRuleId,
      participantId: null,
      issuanceKey,
      row,
      adminId: params.adminId,
    });
    if (created.jobId) jobIds.push(created.jobId);
  }

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'award.bulk_import',
    entityType: 'event',
    entityId: link.eventId,
    changeSummary: { issuedCount: jobIds.length },
    requestId: params.requestId,
  });

  return { issuedCount: jobIds.length, jobIds };
}

export async function importAwardsFromParticipants(
  env: WorkerEnv,
  params: {
    input: ImportAwardsFromParticipantsInput;
    adminId: string;
    requestId: string;
  },
): Promise<{ issuedCount: number; skippedCount: number; jobIds: string[] }> {
  const db = env.DB!;
  if (!env.DATA_ENCRYPTION_KEY) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Kunci enkripsi data belum dikonfigurasi.', 500);
  }

  const link = await findAwardEventTemplateById(
    db,
    params.input.eventId,
    params.input.eventTemplateId,
  );
  if (!link) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      'Template piagam aktif tidak ditemukan pada kegiatan tersebut.',
      404,
    );
  }

  const participants = await findParticipantsByIdsForEvent(
    db,
    params.input.eventId,
    params.input.participantIds,
  );

  const jobIds: string[] = [];
  let skippedCount = 0;
  const catSlug = slugifyKey(params.input.awardCategory);

  for (const p of participants) {
    let data: Record<string, unknown> = {};
    try {
      const decrypted = await decryptSensitiveData(p.encrypted_data, {
        v1: env.DATA_ENCRYPTION_KEY,
      });
      data = JSON.parse(decrypted) as Record<string, unknown>;
    } catch {
      skippedCount += 1;
      continue;
    }

    const recipientName = String(data.nama_lengkap ?? data.nama ?? data.full_name ?? '').trim();
    if (recipientName.length < 2) {
      skippedCount += 1;
      continue;
    }

    const email = typeof data.email === 'string' ? data.email.trim() : '';
    const institution = String(data.instansi ?? data.unit_kerja ?? '').trim();

    const issuanceKey = `award:participant:${link.eventId}:${p.id}:${link.eventTemplateId}:${catSlug}`;
    const created = await createAwardDocumentRecord(env, {
      eventId: link.eventId,
      eventCode: link.eventCode,
      eventTemplateId: link.eventTemplateId,
      templateVersionId: link.templateVersionId,
      numberingRuleId: link.numberingRuleId,
      participantId: p.id,
      issuanceKey,
      row: {
        recipientName,
        awardCategory: params.input.awardCategory,
        institution,
        email,
        notes: params.input.notes ?? '',
      },
      adminId: params.adminId,
    });

    if (created.alreadyExisted) {
      skippedCount += 1;
    } else if (created.jobId) {
      jobIds.push(created.jobId);
    }
  }

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'award.import_from_participants',
    entityType: 'event',
    entityId: link.eventId,
    changeSummary: {
      issuedCount: jobIds.length,
      skippedCount,
      awardCategory: params.input.awardCategory,
    },
    requestId: params.requestId,
  });

  return { issuedCount: jobIds.length, skippedCount, jobIds };
}

export async function getAdminAwardsList(
  env: WorkerEnv,
  params: { page: number; limit: number; eventId?: string; status?: string },
): Promise<{ items: AdminAwardItem[]; total: number }> {
  const { rows, total } = await listAdminAwardRows(env.DB!, params);
  const items: AdminAwardItem[] = [];

  for (const row of rows) {
    let recipientName = '(Terenkripsi)';
    let awardCategory = '-';
    let institution = '';
    if (env.DATA_ENCRYPTION_KEY) {
      try {
        const plain = await decryptSensitiveData(row.recipient_data_encrypted, {
          v1: env.DATA_ENCRYPTION_KEY,
        });
        const parsed = JSON.parse(plain) as Record<string, unknown>;
        recipientName = String(parsed.nama_lengkap ?? parsed.nama ?? '(Tanpa Nama)');
        awardCategory = String(parsed.kategori_penghargaan ?? parsed.peran ?? '-');
        institution = String(parsed.instansi ?? '');
      } catch {
        recipientName = '(Gagal dekripsi)';
      }
    }

    items.push({
      id: row.id,
      publicId: row.public_id,
      eventId: row.event_id,
      eventTitle: row.event_title,
      documentNumber: row.document_number,
      verificationCode: row.verification_code,
      recipientName,
      awardCategory,
      institution,
      documentStatus: row.document_status,
      issuedAt: row.issued_at,
      revokedAt: row.revoked_at,
      revisionCount: Number(row.revision_count ?? 0),
      createdAt: row.created_at,
    });
  }

  return { items, total };
}
