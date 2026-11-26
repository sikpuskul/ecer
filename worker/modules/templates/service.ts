import { ERROR_CODES } from '../../../shared/constants/api';
import {
  buildDefaultMappings,
  extractGoogleDocIdFromUrl,
  type ImportTemplateInput,
  type UpdateTemplateInput,
} from '../../../shared/schemas/templates';
import type { WorkerEnv } from '../../env';
import {
  GasIntegrationError,
  GoogleAppsScriptClient,
} from '../../integrations/google-apps-script/client';
import { AppError } from '../../middleware/error-handler';
import { insertAuditLog } from '../auth/repository';
import {
  countTemplateReferences,
  deleteTemplateRecords,
  findTemplateById,
  insertNewTemplateVersion,
  insertTemplateAndVersion,
  listTemplatesWithLatestVersion,
  updateTemplateMetadataAndMapping,
  updateTemplateVersionSnapshot,
} from './repository';

function createGasClient(env: WorkerEnv): GoogleAppsScriptClient {
  if (!env.GAS_WEB_APP_URL || !env.GAS_SHARED_SECRET) {
    throw new AppError(
      ERROR_CODES.INTEGRATION_UNAVAILABLE,
      'Konfigurasi Google Apps Script belum lengkap.',
      503,
    );
  }
  return new GoogleAppsScriptClient({
    webAppUrl: env.GAS_WEB_APP_URL,
    sharedSecret: env.GAS_SHARED_SECRET,
  });
}

export async function listTemplates(db: D1Database) {
  return listTemplatesWithLatestVersion(db);
}

export async function getTemplateDetail(db: D1Database, id: string) {
  const found = await findTemplateById(db, id);
  if (!found) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Template tidak ditemukan.', 404);
  }
  return found;
}

export async function importTemplateFromGoogleDocs(
  env: WorkerEnv,
  params: {
    adminId: string;
    input: ImportTemplateInput;
    requestId: string;
  },
) {
  const db = env.DB!;
  const googleDocId = extractGoogleDocIdFromUrl(params.input.googleDocsUrl);
  if (!googleDocId) {
    throw new AppError(ERROR_CODES.TEMPLATE_INVALID, 'URL Google Docs tidak valid.', 422);
  }

  const gas = createGasClient(env);
  let inspected: { googleDocId: string; title: string; placeholders: string[]; warnings: string[] };

  try {
    inspected = await gas.inspectTemplate(googleDocId, params.requestId);
  } catch (error) {
    if (error instanceof GasIntegrationError) {
      const status = error.code === 'TEMPLATE_ACCESS_DENIED' ? 403 : 503;
      throw new AppError(
        error.code === 'TEMPLATE_ACCESS_DENIED'
          ? ERROR_CODES.TEMPLATE_ACCESS_DENIED
          : ERROR_CODES.INTEGRATION_UNAVAILABLE,
        error.message,
        status,
      );
    }
    throw new AppError(
      ERROR_CODES.INTEGRATION_UNAVAILABLE,
      'Gagal membaca template dari Google Docs.',
      503,
    );
  }

  const mappings = buildDefaultMappings(inspected.placeholders);
  const validationStatus = inspected.warnings.length > 0 ? 'warning' : 'pending';
  const templateId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  await insertTemplateAndVersion(db, {
    templateId,
    versionId,
    name: params.input.name,
    description: params.input.description ?? '',
    documentType: params.input.documentType,
    googleDocId,
    placeholders: inspected.placeholders,
    mappings,
    validationStatus,
    adminId: params.adminId,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'template.import',
    entityType: 'template',
    entityId: templateId,
    changeSummary: {
      documentType: params.input.documentType,
      placeholderCount: inspected.placeholders.length,
      warningsCount: inspected.warnings.length,
    },
    requestId: params.requestId,
  });

  const detail = await getTemplateDetail(db, templateId);
  return { ...detail, warnings: inspected.warnings, sourceTitle: inspected.title };
}

export async function updateTemplate(
  db: D1Database,
  params: {
    adminId: string;
    templateId: string;
    input: UpdateTemplateInput;
    requestId: string;
  },
) {
  const existing = await getTemplateDetail(db, params.templateId);
  const nowIso = new Date().toISOString();

  await updateTemplateMetadataAndMapping(db, {
    templateId: existing.template.id,
    name: params.input.name ?? existing.template.name,
    description: params.input.description ?? existing.template.description,
    isActive: params.input.isActive ?? existing.template.isActive,
    latestVersionId: existing.template.latestVersion?.id,
    mappings: params.input.mappings,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'template.update',
    entityType: 'template',
    entityId: existing.template.id,
    changeSummary: { mappingsUpdated: Boolean(params.input.mappings) },
    requestId: params.requestId,
  });

  return getTemplateDetail(db, existing.template.id);
}

export async function refreshTemplateFromSource(
  env: WorkerEnv,
  params: { adminId: string; templateId: string; requestId: string },
) {
  const db = env.DB!;
  const existing = await getTemplateDetail(db, params.templateId);
  const gas = createGasClient(env);

  const inspected = await gas.inspectTemplate(existing.template.googleDocId, params.requestId);
  const previousMappings = new Map(
    (existing.template.latestVersion?.mappings ?? []).map((m) => [m.placeholder, m]),
  );

  const mergedMappings = buildDefaultMappings(inspected.placeholders).map(
    (def) => previousMappings.get(def.placeholder) ?? def,
  );

  const nextVersionNumber = (existing.template.latestVersion?.versionNumber ?? 0) + 1;
  const versionId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  await insertNewTemplateVersion(db, {
    versionId,
    templateId: existing.template.id,
    versionNumber: nextVersionNumber,
    placeholders: inspected.placeholders,
    mappings: mergedMappings,
    validationStatus: inspected.warnings.length > 0 ? 'warning' : 'pending',
    adminId: params.adminId,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'template.refresh',
    entityType: 'template',
    entityId: existing.template.id,
    changeSummary: { versionNumber: nextVersionNumber },
    requestId: params.requestId,
  });

  const detail = await getTemplateDetail(db, existing.template.id);
  return { ...detail, warnings: inspected.warnings };
}

export async function validateAndSnapshotTemplate(
  env: WorkerEnv,
  params: { adminId: string; templateId: string; requestId: string },
) {
  const db = env.DB!;
  const existing = await getTemplateDetail(db, params.templateId);
  const latest = existing.template.latestVersion;
  if (!latest) {
    throw new AppError(ERROR_CODES.TEMPLATE_INVALID, 'Template belum memiliki versi.', 422);
  }

  // Ensure every extracted placeholder has a mapping
  const mappedSet = new Set(latest.mappings.map((m) => m.placeholder));
  const unmapped = latest.placeholders.filter((p) => !mappedSet.has(p));
  if (unmapped.length > 0) {
    throw new AppError(
      ERROR_CODES.TEMPLATE_INVALID,
      `Placeholder belum dipetakan: ${unmapped.join(', ')}`,
      422,
    );
  }

  const gas = createGasClient(env);
  const snapshotName = `ECER_SNAP_${existing.template.id.slice(0, 8)}_v${latest.versionNumber}`;
  const snap = await gas.snapshotTemplate(
    { googleDocId: existing.template.googleDocId, snapshotName },
    params.requestId,
  );

  await updateTemplateVersionSnapshot(db, {
    versionId: latest.id,
    snapshotDocId: snap.snapshotDocId,
    validationStatus: 'valid',
  });

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'template.validate_snapshot',
    entityType: 'template',
    entityId: existing.template.id,
    changeSummary: { versionNumber: latest.versionNumber },
    requestId: params.requestId,
  });

  return getTemplateDetail(db, existing.template.id);
}

export async function testGenerateTemplate(
  env: WorkerEnv,
  params: { adminId: string; templateId: string; requestId: string },
) {
  const db = env.DB!;
  const existing = await getTemplateDetail(db, params.templateId);
  const latest = existing.template.latestVersion;
  if (!latest) {
    throw new AppError(ERROR_CODES.TEMPLATE_INVALID, 'Template belum memiliki versi.', 422);
  }

  const targetDocId = latest.snapshotDocId ?? existing.template.googleDocId;
  const dummyValues: Record<string, string> = {};
  for (const m of latest.mappings) {
    if (m.source === 'verification_qr') continue;
    if (m.source === 'static_value') {
      dummyValues[m.placeholder] = m.staticValue || '[NILAI STATIS]';
    } else if (m.source === 'document_number') {
      dummyValues[m.placeholder] = 'TEST-PREVIEW/000/PKM-SMK/2026';
    } else {
      dummyValues[m.placeholder] = `Contoh ${m.placeholder.replace(/_/g, ' ')}`;
    }
  }

  const gas = createGasClient(env);
  const jobId = `test_${crypto.randomUUID()}`;
  const generated = await gas.generateDocument(
    {
      jobId,
      snapshotDocId: targetDocId,
      documentType: existing.template.documentType,
      eventId: 'template-test-preview',
      year: String(new Date().getFullYear()),
      filename: `PREVIEW_TEST_${existing.template.name}.pdf`,
      placeholders: dummyValues,
    },
    params.requestId,
  );

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'template.test_generate',
    entityType: 'template',
    entityId: existing.template.id,
    changeSummary: { versionNumber: latest.versionNumber, fileSize: generated.fileSize },
    requestId: params.requestId,
  });

  return {
    filename: generated.filename,
    fileSize: generated.fileSize,
    mimeType: generated.mimeType,
    isPreview: true,
  };
}

export async function deleteTemplate(
  db: D1Database,
  params: { adminId: string; templateId: string; requestId: string },
) {
  const existing = await getTemplateDetail(db, params.templateId);
  const refCount = await countTemplateReferences(db, existing.template.id);
  if (refCount > 0) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Template yang sudah ditautkan ke kegiatan atau dokumen tidak boleh dihapus.',
      409,
    );
  }

  await deleteTemplateRecords(db, existing.template.id);

  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'template.delete',
    entityType: 'template',
    entityId: existing.template.id,
    requestId: params.requestId,
  });
}
