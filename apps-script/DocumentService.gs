/**
 * DocumentService.gs — Generasi PDF idempoten dari snapshot template Google Docs.
 */
function handleGenerateDocument_(payload) {
  var jobId = String(payload.jobId || '').trim();
  var snapshotDocId = String(payload.snapshotDocId || '').trim();
  var documentType = payload.documentType === 'award' ? 'award' : 'certificate';
  var eventId = String(payload.eventId || '').trim();
  var year = String(payload.year || new Date().getFullYear());
  var filename = sanitizeFilename_(payload.filename || 'sertifikat.pdf');

  if (!jobId || !snapshotDocId || !eventId) {
    throw new Error('VALIDATION_ERROR:jobId, snapshotDocId, dan eventId wajib diisi.');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    throw new Error('INTEGRATION_UNAVAILABLE:Gagal memperoleh lock pemrosesan dokumen.');
  }

  var tempFile = null;
  try {
    var existing = getJobResult_(jobId);
    if (existing) {
      return Object.assign({}, existing, { reusedFromRegistry: true });
    }

    var tempFolderId = getRequiredProperty_(ECER_CONFIG_KEYS.TEMP_FOLDER_ID);
    var tempFolder = DriveApp.getFolderById(tempFolderId);
    var snapshotFile = DriveApp.getFileById(snapshotDocId);
    tempFile = snapshotFile.makeCopy('tmp_' + jobId, tempFolder);
    ensurePrivateFile_(tempFile);

    var doc = DocumentApp.openById(tempFile.getId());
    replacePlaceholdersInDoc_(doc, payload.placeholders || {});
    if (payload.qrPngBase64) {
      insertQrCodeInDoc_(doc, payload.qrPngBase64, 110);
    }
    doc.saveAndClose();

    var pdfBlob = tempFile.getAs(MimeType.PDF).setName(filename);
    var targetFolder = getManagedDocumentFolder_(documentType, year, eventId);
    var pdfFile = targetFolder.createFile(pdfBlob);
    ensurePrivateFile_(pdfFile);

    var pdfBytes = pdfBlob.getBytes();
    var checksum = bytesToHex_(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pdfBytes),
    );

    var result = {
      jobId: jobId,
      driveFileId: pdfFile.getId(),
      filename: pdfFile.getName(),
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      checksum: checksum,
      reusedFromRegistry: false,
    };

    saveJobResult_(jobId, result);
    return result;
  } finally {
    if (tempFile) {
      try {
        tempFile.setTrashed(true);
      } catch (cleanupErr) {
        safeLog_('temp_cleanup_warning', { jobId: jobId });
      }
    }
    lock.releaseLock();
  }
}

function handleGetGenerationResult_(payload) {
  var jobId = String(payload.jobId || '').trim();
  if (!jobId) {
    throw new Error('VALIDATION_ERROR:jobId wajib diisi.');
  }
  var existing = getJobResult_(jobId);
  if (!existing) {
    throw new Error('NOT_FOUND:Hasil generasi untuk jobId tersebut belum tersedia.');
  }
  return Object.assign({}, existing, { reusedFromRegistry: true });
}
