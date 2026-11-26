/**
 * Response.gs — Standard JSON envelope untuk ContentService.
 */
function jsonSuccess_(requestId, data) {
  var payload = {
    success: true,
    requestId: requestId || 'unknown',
    data: data,
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function jsonError_(requestId, code, message) {
  var payload = {
    success: false,
    requestId: requestId || 'unknown',
    error: {
      code: code || 'INTERNAL_ERROR',
      message: message || 'Terjadi kesalahan pada layanan dokumen.',
    },
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
