/**
 * DriveService.gs — Pengelolaan folder & berkas Google Drive privat milik aplikasi.
 */
var MAX_PDF_FETCH_BYTES = 2 * 1024 * 1024; // 2 MiB (PRD §15.3)

function getOrCreateSubfolder_(parentFolder, name) {
  var safeName = String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  var iter = parentFolder.getFoldersByName(safeName);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(safeName);
}

function getManagedDocumentFolder_(documentType, year, eventId) {
  var rootId = getRequiredProperty_(ECER_CONFIG_KEYS.DRIVE_ROOT_FOLDER_ID);
  var rootFolder = DriveApp.getFolderById(rootId);
  var envFolder = getOrCreateSubfolder_(rootFolder, getAppEnv_());
  var bucketName = documentType === 'award' ? 'awards' : 'certificates';
  var typeFolder = getOrCreateSubfolder_(envFolder, bucketName);
  var yearFolder = getOrCreateSubfolder_(typeFolder, String(year));
  return getOrCreateSubfolder_(yearFolder, String(eventId));
}

function isFileInsideManagedRoot_(file) {
  var managedRoots = {};
  managedRoots[getRequiredProperty_(ECER_CONFIG_KEYS.DRIVE_ROOT_FOLDER_ID)] = true;
  var snapshotId = getOptionalProperty_(ECER_CONFIG_KEYS.TEMPLATE_SNAPSHOT_FOLDER_ID, '');
  if (snapshotId) managedRoots[snapshotId] = true;
  var tempId = getOptionalProperty_(ECER_CONFIG_KEYS.TEMP_FOLDER_ID, '');
  if (tempId) managedRoots[tempId] = true;

  var queue = [];
  var parents = file.getParents();
  while (parents.hasNext()) {
    queue.push(parents.next());
  }

  var depth = 0;
  while (queue.length > 0 && depth < 12) {
    var current = queue.shift();
    if (managedRoots[current.getId()]) {
      return true;
    }
    var nextParents = current.getParents();
    while (nextParents.hasNext()) {
      queue.push(nextParents.next());
    }
    depth++;
  }
  return false;
}

function ensurePrivateFile_(file) {
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
}

function handleFetchPdf_(payload) {
  var driveFileId = String(payload.driveFileId || '').trim();
  if (!driveFileId) {
    throw new Error('VALIDATION_ERROR:driveFileId wajib diisi.');
  }

  var file = DriveApp.getFileById(driveFileId);
  if (!isFileInsideManagedRoot_(file)) {
    throw new Error('FORBIDDEN:File tidak berada dalam folder terkelola ECER.');
  }

  var blob = file.getBlob();
  var bytes = blob.getBytes();
  if (bytes.length > MAX_PDF_FETCH_BYTES) {
    throw new Error('GENERATION_FAILED:Ukuran PDF melebihi batas 2 MiB.');
  }

  return {
    driveFileId: file.getId(),
    filename: file.getName(),
    mimeType: 'application/pdf',
    fileSize: bytes.length,
    contentBase64: Utilities.base64Encode(bytes),
  };
}

function handleDeleteManagedFile_(payload) {
  var driveFileId = String(payload.driveFileId || '').trim();
  if (!driveFileId) {
    throw new Error('VALIDATION_ERROR:driveFileId wajib diisi.');
  }
  var file = DriveApp.getFileById(driveFileId);
  if (!isFileInsideManagedRoot_(file)) {
    throw new Error('FORBIDDEN:File tidak berada dalam folder terkelola ECER.');
  }
  file.setTrashed(true);
  return {
    driveFileId: driveFileId,
    deleted: true,
  };
}
