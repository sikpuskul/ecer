import { ERROR_CODES } from '../../../shared/constants/api';
import {
  EventEmailConfigSchema,
  EventRetentionConfigSchema,
  type AdminEventItem,
  type CreateEventInput,
  type PublishCheckItem,
  type UpdateEventInput,
} from '../../../shared/schemas/events';
import { AppError } from '../../middleware/error-handler';
import { hashPassword } from '../../security/password';
import { insertAuditLog } from '../auth/repository';
import { isValidFlyerKey } from '../storage/routes';
import {
  countEventParticipantsAndDocuments,
  countEventsUsingFlyerKey,
  deleteEventRecord,
  findEventBySlugOrCode,
  findEventRowById,
  insertEventRecord,
  listEvents,
  mapEventRow,
  updateEventLifecycle,
  updateEventRecord,
} from './repository';

function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${base || 'kegiatan'}-${suffix}`;
}

function generateEventCode(title: string): string {
  const letters = title
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `${letters || 'EVT'}-${suffix}`;
}

function assertValidPeriods(params: {
  eventStartAt: string;
  eventEndAt: string;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  downloadStartAt: string | null;
  downloadEndAt: string | null;
}): void {
  if (Date.parse(params.eventStartAt) > Date.parse(params.eventEndAt)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Tanggal mulai kegiatan tidak boleh melebihi tanggal selesai.',
      422,
    );
  }
  if (
    params.registrationStartAt &&
    params.registrationEndAt &&
    Date.parse(params.registrationStartAt) >= Date.parse(params.registrationEndAt)
  ) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Waktu mulai pengisian harus lebih awal daripada waktu akhir pengisian.',
      422,
    );
  }
  if (
    params.downloadStartAt &&
    params.downloadEndAt &&
    Date.parse(params.downloadStartAt) >= Date.parse(params.downloadEndAt)
  ) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Waktu mulai pengunduhan harus lebih awal daripada waktu akhir pengunduhan.',
      422,
    );
  }
}

export function evaluatePublishChecklist(event: AdminEventItem): PublishCheckItem[] {
  const checks: PublishCheckItem[] = [];

  const eventDatesValid = Date.parse(event.eventStartAt) <= Date.parse(event.eventEndAt);
  checks.push({
    key: 'event_dates',
    label: 'Tanggal kegiatan valid',
    passed: eventDatesValid,
    message: eventDatesValid ? undefined : 'Tanggal mulai tidak boleh setelah tanggal selesai.',
  });

  const regPeriodValid =
    Boolean(event.registrationStartAt && event.registrationEndAt) &&
    Date.parse(event.registrationStartAt!) < Date.parse(event.registrationEndAt!);
  checks.push({
    key: 'registration_period',
    label: 'Periode pengisian sertifikat dikonfigurasi',
    passed: regPeriodValid,
    message: regPeriodValid ? undefined : 'Atur waktu mulai dan akhir pengisian yang valid.',
  });

  const dlPeriodValid =
    Boolean(event.downloadStartAt && event.downloadEndAt) &&
    Date.parse(event.downloadStartAt!) < Date.parse(event.downloadEndAt!);
  checks.push({
    key: 'download_period',
    label: 'Periode pengunduhan sertifikat dikonfigurasi',
    passed: dlPeriodValid,
    message: dlPeriodValid ? undefined : 'Atur waktu mulai dan akhir pengunduhan yang valid.',
  });

  const keysValid = Boolean(event.uniqueKeyField.trim() && event.searchKeyField.trim());
  checks.push({
    key: 'participant_keys',
    label: 'Unique key & search key peserta terkonfigurasi',
    passed: keysValid,
    message: keysValid ? undefined : 'Tentukan unique key dan search key peserta.',
  });

  const attendanceValid = event.attendanceMode !== 'pin' || event.hasEventPin;
  checks.push({
    key: 'attendance_validation',
    label: 'Metode validasi kehadiran lengkap',
    passed: attendanceValid,
    message: attendanceValid
      ? undefined
      : 'Mode kehadiran PIN memerlukan PIN kegiatan yang sudah ditetapkan.',
  });

  const emailValid =
    !event.emailConfig.autoSend ||
    Boolean(event.emailConfig.subject.trim() && event.emailConfig.body.trim());
  checks.push({
    key: 'email_config',
    label: 'Konfigurasi email valid',
    passed: emailValid,
    message: emailValid ? undefined : 'Subject dan isi email wajib diisi jika auto-email aktif.',
  });

  return checks;
}

export async function getAdminEventsList(
  db: D1Database,
  params: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    status?: string;
  },
) {
  return listEvents(db, params);
}

export async function getAdminEventDetail(db: D1Database, id: string): Promise<AdminEventItem> {
  const row = await findEventRowById(db, id);
  if (!row) {
    throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
  }
  const item = mapEventRow(row);
  return {
    ...item,
    publishChecklist: evaluatePublishChecklist(item),
  };
}

export async function createEvent(
  db: D1Database,
  params: {
    adminId: string;
    input: CreateEventInput;
    requestId: string;
  },
): Promise<AdminEventItem> {
  const { input } = params;

  if (input.flyerKey && !isValidFlyerKey(input.flyerKey)) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Key flyer tidak valid.', 422);
  }

  assertValidPeriods({
    eventStartAt: input.eventStartAt,
    eventEndAt: input.eventEndAt,
    registrationStartAt: input.registrationStartAt ?? null,
    registrationEndAt: input.registrationEndAt ?? null,
    downloadStartAt: input.downloadStartAt ?? null,
    downloadEndAt: input.downloadEndAt ?? null,
  });

  const slug = input.slug ?? slugifyTitle(input.title);
  const eventCode = input.eventCode ?? generateEventCode(input.title);

  const conflict = await findEventBySlugOrCode(db, slug, eventCode);
  if (conflict) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      conflict.slug === slug ? 'Slug kegiatan sudah digunakan.' : 'Kode kegiatan sudah digunakan.',
      409,
    );
  }

  const eventPinHash = input.eventPin ? (await hashPassword(input.eventPin)).hash : null;
  const emailConfig = EventEmailConfigSchema.parse(input.emailConfig ?? {});
  const retentionConfig = EventRetentionConfigSchema.parse(input.retentionConfig ?? {});

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  await insertEventRecord(db, {
    id,
    categoryId: input.categoryId,
    slug,
    eventCode,
    title: input.title,
    description: input.description ?? '',
    organizer: input.organizer ?? 'Puskesmas Sumbermanjing Kulon',
    location: input.location ?? '',
    flyerKey: input.flyerKey ?? null,
    eventStartAt: input.eventStartAt,
    eventEndAt: input.eventEndAt,
    registrationStartAt: input.registrationStartAt ?? null,
    registrationEndAt: input.registrationEndAt ?? null,
    downloadStartAt: input.downloadStartAt ?? null,
    downloadEndAt: input.downloadEndAt ?? null,
    emailReleaseAt: input.emailReleaseAt ?? null,
    quota: input.quota ?? null,
    attendanceMode: input.attendanceMode ?? 'open',
    issuanceMode: input.issuanceMode ?? 'auto',
    uniqueKeyField: input.uniqueKeyField ?? 'nomor_peserta',
    searchKeyField: input.searchKeyField ?? 'nomor_peserta',
    eventPinHash,
    emailConfigJson: JSON.stringify(emailConfig),
    retentionConfigJson: JSON.stringify(retentionConfig),
    adminId: params.adminId,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'event.create',
    entityType: 'event',
    entityId: id,
    changeSummary: { slug, eventCode, title: input.title },
    requestId: params.requestId,
  });

  return getAdminEventDetail(db, id);
}

export async function updateEvent(
  db: D1Database,
  params: {
    adminId: string;
    eventId: string;
    input: UpdateEventInput;
    flyerBucket?: R2Bucket;
    requestId: string;
  },
): Promise<AdminEventItem> {
  const existing = await findEventRowById(db, params.eventId);
  if (!existing) {
    throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
  }

  const { input } = params;
  const nextFlyerKey = input.flyerKey !== undefined ? input.flyerKey : existing.flyer_key;
  if (nextFlyerKey && !isValidFlyerKey(nextFlyerKey)) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Key flyer tidak valid.', 422);
  }

  const nextStart = input.eventStartAt ?? existing.event_start_at;
  const nextEnd = input.eventEndAt ?? existing.event_end_at;
  const nextRegStart =
    input.registrationStartAt !== undefined
      ? input.registrationStartAt
      : existing.registration_start_at;
  const nextRegEnd =
    input.registrationEndAt !== undefined ? input.registrationEndAt : existing.registration_end_at;
  const nextDlStart =
    input.downloadStartAt !== undefined ? input.downloadStartAt : existing.download_start_at;
  const nextDlEnd =
    input.downloadEndAt !== undefined ? input.downloadEndAt : existing.download_end_at;

  assertValidPeriods({
    eventStartAt: nextStart,
    eventEndAt: nextEnd,
    registrationStartAt: nextRegStart,
    registrationEndAt: nextRegEnd,
    downloadStartAt: nextDlStart,
    downloadEndAt: nextDlEnd,
  });

  const nextSlug = input.slug ?? existing.slug;
  const nextCode = input.eventCode ?? existing.event_code;
  if (nextSlug !== existing.slug || nextCode !== existing.event_code) {
    const conflict = await findEventBySlugOrCode(db, nextSlug, nextCode, existing.id);
    if (conflict) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        conflict.slug === nextSlug
          ? 'Slug kegiatan sudah digunakan.'
          : 'Kode kegiatan sudah digunakan.',
        409,
      );
    }
  }

  let nextPinHash = existing.event_pin_hash;
  if (input.clearEventPin) {
    nextPinHash = null;
  } else if (input.eventPin) {
    nextPinHash = (await hashPassword(input.eventPin)).hash;
  }

  const currentMapped = mapEventRow(existing);
  const nextEmailConfig = EventEmailConfigSchema.parse({
    ...currentMapped.emailConfig,
    ...(input.emailConfig ?? {}),
  });
  const nextRetentionConfig = EventRetentionConfigSchema.parse({
    ...currentMapped.retentionConfig,
    ...(input.retentionConfig ?? {}),
  });

  const nowIso = new Date().toISOString();

  await updateEventRecord(db, {
    id: existing.id,
    categoryId: input.categoryId ?? existing.category_id,
    slug: nextSlug,
    eventCode: nextCode,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    organizer: input.organizer ?? existing.organizer,
    location: input.location ?? existing.location,
    flyerKey: nextFlyerKey,
    eventStartAt: nextStart,
    eventEndAt: nextEnd,
    registrationStartAt: nextRegStart,
    registrationEndAt: nextRegEnd,
    downloadStartAt: nextDlStart,
    downloadEndAt: nextDlEnd,
    emailReleaseAt:
      input.emailReleaseAt !== undefined ? input.emailReleaseAt : existing.email_release_at,
    quota: input.quota !== undefined ? input.quota : existing.quota,
    attendanceMode: input.attendanceMode ?? existing.attendance_mode,
    issuanceMode: input.issuanceMode ?? existing.issuance_mode,
    uniqueKeyField: input.uniqueKeyField ?? existing.unique_key_field,
    searchKeyField: input.searchKeyField ?? existing.search_key_field,
    eventPinHash: nextPinHash,
    emailConfigJson: JSON.stringify(nextEmailConfig),
    retentionConfigJson: JSON.stringify(nextRetentionConfig),
    adminId: params.adminId,
    nowIso,
  });

  // PRD §28.5: Cleanup old replaced flyer if no other event references it
  if (existing.flyer_key && existing.flyer_key !== nextFlyerKey && params.flyerBucket) {
    const refCount = await countEventsUsingFlyerKey(db, existing.flyer_key, existing.id);
    if (refCount === 0) {
      await params.flyerBucket.delete(existing.flyer_key).catch(() => undefined);
    }
  }

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'event.update',
    entityType: 'event',
    entityId: existing.id,
    changeSummary: {
      pinUpdated: Boolean(input.eventPin || input.clearEventPin),
      flyerChanged: existing.flyer_key !== nextFlyerKey,
    },
    requestId: params.requestId,
  });

  return getAdminEventDetail(db, existing.id);
}

export async function deleteDraftEvent(
  db: D1Database,
  params: {
    adminId: string;
    eventId: string;
    flyerBucket?: R2Bucket;
    requestId: string;
  },
): Promise<void> {
  const existing = await findEventRowById(db, params.eventId);
  if (!existing) {
    throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
  }
  if (existing.lifecycle_status !== 'draft') {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Hanya kegiatan berstatus draft yang dapat dihapus.',
      409,
    );
  }

  const counts = await countEventParticipantsAndDocuments(db, existing.id);
  if (counts.participants > 0 || counts.documents > 0) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Kegiatan yang sudah memiliki peserta atau dokumen tidak dapat dihapus.',
      409,
    );
  }

  await deleteEventRecord(db, existing.id);

  if (existing.flyer_key && params.flyerBucket) {
    const refCount = await countEventsUsingFlyerKey(db, existing.flyer_key, existing.id);
    if (refCount === 0) {
      await params.flyerBucket.delete(existing.flyer_key).catch(() => undefined);
    }
  }

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'event.delete',
    entityType: 'event',
    entityId: existing.id,
    changeSummary: { slug: existing.slug },
    requestId: params.requestId,
  });
}

export async function publishEvent(
  db: D1Database,
  params: { adminId: string; eventId: string; requestId: string },
): Promise<AdminEventItem> {
  const detail = await getAdminEventDetail(db, params.eventId);
  if (detail.lifecycleStatus === 'archived') {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Kegiatan yang sudah diarsipkan tidak dapat dipublikasikan kembali.',
      409,
    );
  }

  const failedChecks = (detail.publishChecklist ?? []).filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      failedChecks[0]?.message ?? 'Kegiatan belum memenuhi syarat publikasi.',
      422,
    );
  }

  const nowIso = new Date().toISOString();
  await updateEventLifecycle(db, {
    id: detail.id,
    lifecycleStatus: 'published',
    publishAt: detail.publishAt ?? nowIso,
    adminId: params.adminId,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'event.publish',
    entityType: 'event',
    entityId: detail.id,
    requestId: params.requestId,
  });

  return getAdminEventDetail(db, detail.id);
}

export async function transitionEventLifecycle(
  db: D1Database,
  params: {
    adminId: string;
    eventId: string;
    action: 'close' | 'reopen' | 'archive';
    requestId: string;
  },
): Promise<AdminEventItem> {
  const existing = await findEventRowById(db, params.eventId);
  if (!existing) {
    throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
  }

  const targetStatus =
    params.action === 'close' ? 'closed' : params.action === 'reopen' ? 'published' : 'archived';

  if (params.action === 'reopen' && existing.lifecycle_status !== 'closed') {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Hanya kegiatan yang ditutup manual yang dapat dibuka kembali.',
      409,
    );
  }

  const nowIso = new Date().toISOString();
  await updateEventLifecycle(db, {
    id: existing.id,
    lifecycleStatus: targetStatus,
    adminId: params.adminId,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: `event.${params.action}`,
    entityType: 'event',
    entityId: existing.id,
    changeSummary: { from: existing.lifecycle_status, to: targetStatus },
    requestId: params.requestId,
  });

  return getAdminEventDetail(db, existing.id);
}

export async function duplicateEvent(
  db: D1Database,
  params: { adminId: string; eventId: string; requestId: string },
): Promise<AdminEventItem> {
  const source = await findEventRowById(db, params.eventId);
  if (!source) {
    throw new AppError(ERROR_CODES.EVENT_NOT_FOUND, 'Kegiatan tidak ditemukan.', 404);
  }

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const newTitle = `${source.title} (Salinan)`.slice(0, 200);
  const newSlug = slugifyTitle(source.slug);
  const newCode = generateEventCode(source.event_code);

  // PRD §8.5: Always draft; NEVER copy participants, documents, audit logs, jobs, or old event_pin_hash
  await insertEventRecord(db, {
    id,
    categoryId: source.category_id,
    slug: newSlug,
    eventCode: newCode,
    title: newTitle,
    description: source.description,
    organizer: source.organizer,
    location: source.location,
    flyerKey: source.flyer_key,
    eventStartAt: source.event_start_at,
    eventEndAt: source.event_end_at,
    registrationStartAt: source.registration_start_at,
    registrationEndAt: source.registration_end_at,
    downloadStartAt: source.download_start_at,
    downloadEndAt: source.download_end_at,
    emailReleaseAt: source.email_release_at,
    quota: source.quota,
    attendanceMode: source.attendance_mode,
    issuanceMode: source.issuance_mode,
    uniqueKeyField: source.unique_key_field,
    searchKeyField: source.search_key_field,
    eventPinHash: null,
    emailConfigJson: source.email_config_json,
    retentionConfigJson: source.retention_config_json,
    adminId: params.adminId,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'event.duplicate',
    entityType: 'event',
    entityId: id,
    changeSummary: { sourceEventId: source.id, slug: newSlug },
    requestId: params.requestId,
  });

  return getAdminEventDetail(db, id);
}
