/**
 * TemplateService.gs — Inspeksi placeholder Google Docs dan pembuatan snapshot.
 */
function handleInspectTemplate_(payload) {
  var googleDocId = String(payload.googleDocId || '').trim();
  if (!googleDocId) {
    throw new Error('VALIDATION_ERROR:googleDocId wajib diisi.');
  }

  var doc;
  try {
    doc = DocumentApp.openById(googleDocId);
  } catch (err) {
    throw new Error('TEMPLATE_ACCESS_DENIED:Template Google Docs tidak dapat diakses.');
  }

  var extracted = extractPlaceholdersFromDoc_(doc);
  return {
    googleDocId: googleDocId,
    title: doc.getName(),
    placeholders: extracted.placeholders,
    warnings: extracted.warnings,
  };
}

function handleSnapshotTemplate_(payload) {
  var googleDocId = String(payload.googleDocId || '').trim();
  var snapshotName = String(payload.snapshotName || 'template_snapshot').trim();
  if (!googleDocId) {
    throw new Error('VALIDATION_ERROR:googleDocId wajib diisi.');
  }

  var snapshotFolderId = getRequiredProperty_(ECER_CONFIG_KEYS.TEMPLATE_SNAPSHOT_FOLDER_ID);
  var snapshotFolder = DriveApp.getFolderById(snapshotFolderId);
  var sourceFile = DriveApp.getFileById(googleDocId);
  var copy = sourceFile.makeCopy(snapshotName, snapshotFolder);
  ensurePrivateFile_(copy);

  return {
    sourceDocId: googleDocId,
    snapshotDocId: copy.getId(),
    snapshotName: copy.getName(),
  };
}
